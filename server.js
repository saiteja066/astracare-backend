const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

/* 🔥 HTTP SERVER (IMPORTANT) */
const server = http.createServer(app);

/* 🔥 SOCKET */
const io = new Server(server, {
  cors: { origin: "*" },
});

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL || "mongodb://127.0.0.1:27017/traffic");

mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));

/* ================= MODEL ================= */
const Vehicle = mongoose.model("Vehicle", {
  lat: Number,
  lng: Number,
  type: String,
});

/* ================= SEED ================= */
async function seedVehicles() {
  const count = await Vehicle.countDocuments();

  if (count === 0) {
    await Vehicle.insertMany([
      { lat: 17.22, lng: 78.22, type: "car" },
      { lat: 17.24, lng: 78.23, type: "car" },
      { lat: 17.26, lng: 78.25, type: "ambulance" },
      { lat: 17.23, lng: 78.21, type: "car" },
      { lat: 17.25, lng: 78.27, type: "car" },
    ]);

    console.log("🚗 Vehicles seeded");
  }
}

seedVehicles();

/* ================= TEST ================= */
app.get("/", (req, res) => {
  res.send("🚀 AstraCare Backend Running");
});

/* ================= HOSPITAL API ================= */

const cache = new Map();
const TTL = 5 * 60 * 1000;

function keyOf(lat, lng) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callOverpass(lat, lng, radius) {
  const query = `
    [out:json][timeout:25];
    node["amenity"="hospital"](around:${radius},${lat},${lng});
    out;
  `;

  const res = await axios.post(
    "https://overpass-api.de/api/interpreter",
    query,
    {
      timeout: 15000,
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": "astracare-app",
      },
    },
  );

  return res.data;
}

app.post("/hospitals", async (req, res) => {
  const { lat, lng } = req.body;

  if (!lat || !lng) return res.status(400).send("Missing coordinates");

  const key = keyOf(lat, lng);

  if (cache.has(key)) {
    const cached = cache.get(key);
    if (Date.now() - cached.time < TTL) {
      return res.json(cached.data);
    }
  }

  try {
    let data = await callOverpass(lat, lng, 4000);

    if (!data.elements?.length) {
      await delay(800);
      data = await callOverpass(lat, lng, 8000);
    }

    if (!data.elements?.length) {
      await delay(1200);
      data = await callOverpass(lat, lng, 15000);
    }

    const result = { elements: data.elements || [] };

    cache.set(key, {
      data: result,
      time: Date.now(),
    });

    res.json(result);
  } catch (err) {
    console.log("❌ Overpass error:", err.message);
    res.status(503).send("Overpass busy, try again");
  }
});

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
  console.log("🔌 Client connected");

  const interval = setInterval(async () => {
    let vehicles = await Vehicle.find();

    vehicles = vehicles.map((v) => ({
      ...v._doc,
      lat: v.lat + (Math.random() - 0.5) * 0.001,
      lng: v.lng + (Math.random() - 0.5) * 0.001,
      speed: Math.random() * 40,
    }));

    console.log("📡 Sending vehicles:", vehicles.length);

    io.emit("vehicleUpdate", vehicles);
  }, 2000);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
    clearInterval(interval);
  });
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
