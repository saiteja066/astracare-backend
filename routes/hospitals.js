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
