import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import hospitalRoutes from "./routes/hospitals.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("🚀 Backend Running");
});

app.use("/api/hospitals", hospitalRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
