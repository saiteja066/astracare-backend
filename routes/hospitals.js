import express from "express";
import axios from "axios";

const router = express.Router();

/* 🔥 SAFE OVERPASS CALL */
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
    console.log("Overpass error:", err.message);
    return { elements: [] };
  }
}

/* 🔎 SEARCH HOSPITALS */
router.post("/search", async (req, res) => {
  const { lat, lng, query } = req.body;

  if (!lat || !lng) {
    return res.json({ hospitals: [] });
  }

  try {
    /* 1️⃣ Get hospitals from Overpass */
    const data = await callOverpass(lat, lng, 10000);

    let hospitals = (data.elements || []).map((el) => ({
      name: el.tags?.name || "Unnamed Hospital",
      lat: el.lat || el.center?.lat,
      lng: el.lon || el.center?.lon,
    }));

    /* 2️⃣ Soft filter (optional search) */
    if (query && query.trim() !== "") {
      const q = query.toLowerCase();

      const filtered = hospitals.filter((h) =>
        h.name.toLowerCase().includes(q),
      );

      if (filtered.length > 0) {
        return res.json({ hospitals: filtered });
      }
    }

    /* 3️⃣ If Overpass has data → return all */
    if (hospitals.length > 0) {
      return res.json({ hospitals });
    }

    /* 4️⃣ Fallback (Nominatim) */
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: (query || "") + " hospital",
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
    console.log("Search error:", err.message);

    /* 🔥 NEVER FAIL UI */
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

    /* 👉 If empty → fallback */
    if (hospitals.length === 0) {
      return res.json({
        hospitals: [
          {
            name: "Nearby Hospital",
            lat,
            lng,
          },
        ],
      });
    }

    return res.json({ hospitals });
  } catch (err) {
    console.log("Emergency error:", err.message);

    return res.json({
      hospitals: [
        {
          name: "Nearby Hospital",
          lat,
          lng,
        },
      ],
    });
  }
});

export default router;
