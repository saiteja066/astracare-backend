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

/* ================= HELPERS ================= */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
      headers: {
        "Content-Type": "text/plain",
      },
    },
  );

  return res.data;
}

/* ================= 🚨 EMERGENCY ================= */
app.post("/api/hospitals/emergency", async (req, res) => {
  const { lat, lng } = req.body;

  try {
    let data = await callOverpass(lat, lng, 4000);

    if (!data.elements?.length) {
      await delay(800);
      data = await callOverpass(lat, lng, 8000);
    }

    const hospitals = data.elements.map((el) => ({
      name: el.tags?.name || "Unnamed Hospital",
      lat: el.lat || el.center?.lat,
      lng: el.lon || el.center?.lon,
    }));

    res.json({ hospitals });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});

/* ================= 🔎 SEARCH ================= */
app.post("/api/hospitals/search", async (req, res) => {
  const { lat, lng, query } = req.body;

  try {
    let data = await callOverpass(lat, lng, 10000);

    const hospitals = data.elements
      .map((el) => ({
        name: el.tags?.name || "Unnamed Hospital",
        lat: el.lat || el.center?.lat,
        lng: el.lon || el.center?.lon,
      }))
      .filter((h) => h.name.toLowerCase().includes(query.toLowerCase()));

    res.json({ hospitals });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});

/* ================= SERVER ================= */
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
