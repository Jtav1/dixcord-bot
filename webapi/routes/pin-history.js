import express from "express";
import { authenticate } from "../middleware/auth.js";
import { getPinHistoryById, listIncompletePinHistory, listPinHistory, updatePinHistory } from "../services/pinHistory.js";

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

/**
 * GET /api/pin-history/incomplete
 * List pin_history rows not yet hydrated (`hydrated = false`).
 * Query: ?limit=&offset=
 * Auth: required (admin or bot).
 */
router.get("/incomplete", authenticate, async (req, res) => {
  try {
    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : 0;
    const { entries, total } = await listIncompletePinHistory({ limit, offset });
    res.json({ ok: true, pinHistory: entries, total, limit, offset });
  } catch (err) {
    console.error("GET /api/pin-history/incomplete error:", err);
    res.status(500).json({ ok: false, error: "Failed to list incomplete pin history" });
  }
});

/**
 * GET /api/pin-history/:id
 * Get one pin history entry by primary key.
 * Auth: required (admin or bot).
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const entry = await getPinHistoryById(id);
    if (!entry) {
      return res.status(404).json({ ok: false, error: "Pin not found" });
    }
    res.json({ ok: true, pin: entry });
  } catch (err) {
    console.error("GET /api/pin-history/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get pin history entry" });
  }
});

/**
 * PUT /api/pin-history/:id
 * Update one pin history entry (partial body supported).
 * Body fields: app?, author?, authorId?, contents?, attachments?, channelId?, channelName?, pinners?, pinnerIds?
 * Auth: required (admin or bot).
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const result = await updatePinHistory(id, req.body ?? {});
    if (!result.ok) {
      const status = result.notFound ? 404 : 400;
      return res.status(status).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, pin: result.pin });
  } catch (err) {
    console.error("PUT /api/pin-history/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to update pin history entry" });
  }
});

export default router;
