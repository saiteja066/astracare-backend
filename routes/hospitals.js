import express from "express";
import axios from "axios";

const router = express.Router();

/* 🔥 HELPER */
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
    { headers: { "Content-Type": "text/plain" } },
  );

  return res.data;
}

/* 🚨 EMERGENCY */
router.post("/emergency", async (req, res) => {
  const { lat, lng } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing coordinates" });
  }

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
    res.status(500).json({ error: "Server error" });
  }
});

/* 🔎 SEARCH */
router.post("/search", async (req, res) => {
  const { lat, lng, query } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing coordinates" });
  }

  try {
    let data = await callOverpass(lat, lng, 10000);

    const hospitals = data.elements
      .map((el) => ({
        name: el.tags?.name || "Unnamed Hospital",
        lat: el.lat || el.center?.lat,
        lng: el.lon || el.center?.lon,
      }))
      .filter((h) =>
        query ? h.name.toLowerCase().includes(query.toLowerCase()) : true,
      );

    if (hospitals.length > 0) {
      return res.json({ hospitals });
    }

    /* 🔥 FALLBACK */
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: query + " hospital",
          format: "json",
          limit: 5,
        },
      },
    );

    const fallback = response.data.map((d) => ({
      name: d.display_name.split(",")[0],
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));

    res.json({ hospitals: fallback });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
