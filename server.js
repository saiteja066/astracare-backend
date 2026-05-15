const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.get("/", (req, res) => {
  res.send("🚀 AstraCare Backend Running");
});
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

/* ================= DB (ATLAS) ================= */

// 🔥 REPLACE THIS WITH YOUR URL
mongoose.connect(process.env.MONGO_URL);

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB Atlas connected");
});

mongoose.connection.on("error", (err) => {
  console.log("❌ DB Error:", err);
});

/* ================= MODELS ================= */

// 🚗 Vehicle
const Vehicle = mongoose.model("Vehicle", {
  lat: Number,
  lng: Number,
  type: String,
});

// 👤 User
const User = mongoose.model("User", {
  email: String,
  password: String,
});

/* ================= SEED ================= */

async function seed() {
  const count = await Vehicle.countDocuments();
  if (count === 0) {
    await Vehicle.insertMany([
      { lat: 17.2, lng: 78.2, type: "ambulance" },
      { lat: 17.25, lng: 78.25, type: "car" },
    ]);
    console.log("🚗 Vehicles seeded");
  }
}
seed();

/* ================= AUTH ROUTES ================= */

// 🔥 REGISTER
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const existing = await User.findOne({ email });

    if (existing) {
      return res.send("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.send("✅ Registered successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Register failed");
  }
});

// 🔥 LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.send("User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.send("Invalid password");
    }

    const token = jwt.sign({ id: user._id }, "secretkey", {
      expiresIn: "1d",
    });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Login failed");
  }
});

/* ================= SOCKET ================= */

io.on("connection", (socket) => {
  console.log("🔌 Client connected");

  setInterval(async () => {
    let vehicles = await Vehicle.find();

    vehicles = vehicles.map((v) => {
      v.lat += (Math.random() - 0.5) * 0.001;
      v.lng += (Math.random() - 0.5) * 0.001;
      return v;
    });

    io.emit("vehicleUpdate", vehicles);
  }, 2000);
});

/* ================= SERVER ================= */
const axios = require("axios");

app.post("/hospitals", async (req, res) => {
  const { lat, lng } = req.body;

  try {
    // 🔥 TRY OVERPASS FIRST
    try {
      const overpass = await axios.post(
        "https://overpass-api.de/api/interpreter",
        `
        [out:json];
        node["amenity"="hospital"](around:4000,${lat},${lng});
        out;
        `,
        { timeout: 8000 },
      );

      if (overpass.data.elements?.length) {
        return res.json(overpass.data);
      }
    } catch (err) {
      console.log("⚠️ Overpass failed");
    }

    // 🔥 FALLBACK → NOMINATIM
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=hospital&limit=10&viewbox=${lng - 0.2},${lat + 0.2},${lng + 0.2},${lat - 0.2}`;

    const nominatim = await axios.get(url, {
      headers: {
        "User-Agent": "astracare-app",
      },
      timeout: 8000,
    });

    const hospitals = nominatim.data.map((h) => {
      const parts = h.display_name.split(",");

      return {
        lat: parseFloat(h.lat),
        lon: parseFloat(h.lon),
        tags: {
          name: parts[0],
          operator: parts[1] || "Hospital",
        },
      };
    });

    return res.json({ elements: hospitals });
  } catch (err) {
    console.log("❌ BOTH APIs FAILED:", err.message);
    res.status(500).send("Hospital fetch failed");
  }
});
server.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
