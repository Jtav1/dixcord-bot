import express from "express";
import { authenticate } from "../middleware/auth.js";
import { getDatabaseStatistics } from "../services/statistics.js";

const router = express.Router();

/**
 * GET /api/statistics
 * Aggregate row counts and usage totals across core tracking tables.
 * Auth: required (admin, bot, or webview).
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const statistics = await getDatabaseStatistics();
    res.json({ ok: true, statistics });
  } catch (err) {
    console.error("GET /api/statistics error:", err);
    res.status(500).json({ ok: false, error: "Failed to get statistics" });
  }
});

export default router;
