import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import axios from "axios";

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL);
mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));

/* ================= TEST ================= */
app.get("/", (req, res) => {
  res.send("🚀 AstraCare Backend Running");
});

/* ================= CACHE ================= */
const cache = new Map();
const TTL = 5 * 60 * 1000;

function keyOf(lat, lng) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ================= OVERPASS ================= */
async function callOverpass(lat, lng, radius) {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radius},${lat},${lng});
      way["amenity"="hospital"](around:${radius},${lat},${lng});
    );
    out center;
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

/* ================= MAIN API ================= */
app.post("/api/hospitals", async (req, res) => {
  const { lat, lng } = req.body;

  if (!lat || !lng) {
    return res.status(400).send("Missing coordinates");
  }

  const key = keyOf(lat, lng);

  /* ✅ CACHE */
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

    const hospitals = data.elements.map((el) => ({
      name: el.tags?.name || "Unnamed Hospital",
      lat: el.lat || el.center?.lat,
      lng: el.lon || el.center?.lon,
    }));

    const result = { hospitals };

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

/* ================= SERVER ================= */
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
