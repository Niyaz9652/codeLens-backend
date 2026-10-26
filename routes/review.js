import { Router } from "express";
import Review from "../models/Review.js";
import { reviewCode } from "../services/gemini.js";

const router = Router();
const MAX_CHARS = 20000;

router.post("/", async (req, res) => {
  const { code, language = "javascript" } = req.body || {};
  if (typeof code !== "string" || !code.trim())
    return res.status(400).json({ error: "Paste some code to review." });
  if (code.length > MAX_CHARS)
    return res.status(400).json({ error: `Code is too long. Limit is ${MAX_CHARS} characters.` });
  if (!process.env.GEMINI_API_KEY)
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in backend/.env" });

  try {
    const result = await reviewCode({ code, language });
    if (req.app.locals.historyEnabled) {
      const saved = await Review.create({ code, language, result });
      return res.json({ id: saved._id, result });
    }
    res.json({ result });
  } catch (e) {
    console.error("Review failed:", e.message);
    const busy = e.status === 503 || e.status === 429;
    res.status(busy ? 503 : 500).json({
      error: busy
        ? "The AI service is busy or over quota. Wait a moment and try again."
        : "The review failed. Check the server console for details.",
    });
  }
});

router.get("/history", async (req, res) => {
  if (!req.app.locals.historyEnabled) return res.json({ enabled: false, items: [] });
  const items = await Review.find().sort({ createdAt: -1 }).limit(20).select("language code result.summary createdAt");
  res.json({ enabled: true, items });
});

router.get("/:id", async (req, res) => {
  if (!req.app.locals.historyEnabled) return res.status(404).json({ error: "History is disabled." });
  const item = await Review.findById(req.params.id).catch(() => null);
  if (!item) return res.status(404).json({ error: "Review not found." });
  res.json(item);
});

router.delete("/:id", async (req, res) => {
  if (!req.app.locals.historyEnabled) return res.status(404).json({ error: "History is disabled." });
  await Review.findByIdAndDelete(req.params.id).catch(() => null);
  res.json({ ok: true });
});

export default router;
