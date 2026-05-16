import express from "express";
import axios from "axios";

const router = express.Router();

/* SAFE OVERPASS */
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
  } catch {
    return { elements: [] };
  }
}

/* SEARCH */
router.post("/search", async (req, res) => {
  const { lat, lng, query } = req.body;

  if (!lat || !lng) {
    return res.json({ hospitals: [] });
  }

  try {
    let hospitals = [];

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

    if (hospitals.length > 0) {
      return res.json({ hospitals });
    }

    /* FALLBACK */
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
  } catch {
    return res.json({ hospitals: [] });
  }
});

/* EMERGENCY */
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
  } catch {
    return res.json({ hospitals: [] });
  }
});

export default router;
