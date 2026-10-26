import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import reviewRoutes from "./routes/review.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "200kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, max: 20 })); // protects your API quota

app.get("/api/health", (_req, res) => res.json({ ok: true, history: app.locals.historyEnabled }));
app.use("/api/review", reviewRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;

async function start() {
  app.locals.historyEnabled = false;
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      app.locals.historyEnabled = true;
      console.log("MongoDB connected. Review history enabled.");
    } catch (e) {
      console.warn("MongoDB connection failed. History disabled:", e.message);
    }
  } else {
    console.log("MONGODB_URI is empty. Review history disabled.");
  }
  app.listen(PORT, () => console.log(`CodeLens API running at http://localhost:${PORT}`));
}
start();
