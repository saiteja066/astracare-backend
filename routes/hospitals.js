import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/nearby", async (req, res) => {
  const { lat, lng } = req.query;

  try {
    const query = `
      [out:json];
      (
        node["amenity"="hospital"](around:5000,${lat},${lng});
      );
      out;
    `;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });

    const data = await response.json();

    const hospitals = data.elements.map((el) => ({
      name: el.tags?.name || "Unnamed Hospital",
      lat: el.lat,
      lng: el.lon,
    }));

    res.json(hospitals);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
