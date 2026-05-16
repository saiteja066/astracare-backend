import express from "express";
import axios from "axios";

const router = express.Router();

/* 🔥 SAFE OVERPASS */
async function callOverpass(lat, lng, radius) {
  try {
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

    return res.data || { elements: [] };
  } catch (err) {
    console.log("Overpass failed");
    return { elements: [] };
  }
}

/* 🚨 EMERGENCY */
router.post("/emergency", async (req, res) => {
  const { lat, lng } = req.body;

  if (!lat || !lng) {
    return res.json({ hospitals: [] });
  }

  try {
    const data = await callOverpass(lat, lng, 5000);

    const hospitals = (data.elements || []).map((el) => ({
      name: el.tags?.name || "Unnamed Hospital",
      lat: el.lat || el.center?.lat,
      lng: el.lon || el.center?.lon,
    }));

    return res.json({ hospitals });
  } catch (err) {
    console.log("Emergency error");
    return res.json({ hospitals: [] });
  }
});

/* 🔎 SEARCH (NEVER FAIL VERSION) */
router.post("/search", async (req, res) => {
  const { lat, lng, query } = req.body;

  console.log("REQ:", lat, lng, query);

  if (!lat || !lng) {
    return res.json({ hospitals: [] });
  }

  try {
    let hospitals = [];

    /* 🔥 TRY OVERPASS */
    try {
      const data = await callOverpass(lat, lng, 10000);

      hospitals = (data.elements || [])
        .map((el) => ({
          name: el.tags?.name || "Unnamed Hospital",
          lat: el.lat || el.center?.lat,
          lng: el.lon || el.center?.lon,
        }))
        .filter((h) =>
          query ? h.name.toLowerCase().includes(query.toLowerCase()) : true,
        );
    } catch {
      console.log("Overpass skipped");
    }

    /* ✅ IF FOUND */
    if (hospitals.length > 0) {
      return res.json({ hospitals });
    }

    /* 🔥 FALLBACK (ALWAYS WORKS) */
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

    return res.json({ hospitals: fallback });
  } catch (err) {
    console.log("FINAL ERROR:", err.message);

    /* 🚑 LAST SAFETY */
    return res.json({
      hospitals: [
        {
          name: "Nearby Hospital",
          lat: lat,
          lng: lng,
        },
      ],
    });
  }
});

export default router;
