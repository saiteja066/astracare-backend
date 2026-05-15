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
app.post("/hospitals", async (req, res) => {
  const { lat, lng } = req.body;

  try {
    // 🔥 helper function
    const fetchData = async (radius) => {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `
            [out:json];
            node["amenity"="hospital"](around:${radius},${lat},${lng});
            out;
          `,
      });

      return await response.json();
    };

    // 🔹 try small radius
    let data = await fetchData(4000);

    // 🔹 fallback bigger radius
    if (!data.elements?.length) {
      data = await fetchData(15000);
    }

    return res.json(data);
  } catch (err) {
    console.log("❌ Overpass failed, using fallback");

    // 🔥 fallback dummy hospitals (IMPORTANT)
    return res.json({
      elements: [
        {
          lat: lat + 0.01,
          lon: lng + 0.01,
          tags: { name: "Nearby Hospital", operator: "Private" },
        },
        {
          lat: lat - 0.01,
          lon: lng - 0.01,
          tags: { name: "City Care Hospital", operator: "Government" },
        },
      ],
    });
  }
});

server.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
