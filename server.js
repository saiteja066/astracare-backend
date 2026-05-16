import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import hospitalRoutes from "./routes/hospitals.js";

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL);
mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));

app.get("/", (req, res) => {
  res.send("🚀 Backend Running");
});

/* 🔥 ONLY THIS */
app.use("/api/hospitals", hospitalRoutes);

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
