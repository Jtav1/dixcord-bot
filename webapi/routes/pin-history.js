import express from "express";
import { authenticate } from "../middleware/auth.js";
import { listPinHistory } from "../services/pinHistory.js";

const router = express.Router();

/**
 * GET /api/pin-history
 * List pin history entries with pagination.
 * Query: ?limit=&offset=
 * Auth: required (admin or bot).
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : 0;
    const { entries, total } = await listPinHistory({ limit, offset });
    res.json({ ok: true, pinHistory: entries, total, limit, offset });
  } catch (err) {
    console.error("GET /api/pin-history error:", err);
    res.status(500).json({ ok: false, error: "Failed to list pin history" });
  }
});

export default router;
