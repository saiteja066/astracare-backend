import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import hospitalRoutes from "./routes/hospitals.js";

dotenv.config();

const app = express();

/* ✅ MIDDLEWARE */
app.use(cors());
app.use(express.json());

/* ✅ DATABASE (optional but safe) */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("DB Error:", err.message));

/* ✅ ROOT CHECK */
app.get("/", (req, res) => {
  res.send("🚀 AstraCare Backend Running");
});

/* ✅ MAIN ROUTES */
app.use("/api/hospitals", hospitalRoutes);

/* ✅ PORT FIX (IMPORTANT for Render) */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
