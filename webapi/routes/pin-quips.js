import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as pinQuips from "../services/pinQuips.js";

const router = express.Router();

/**
 * GET /api/pin-quips
 * List all pin quips.
 * Auth: required.
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const list = await pinQuips.getAll();
    res.json({ ok: true, pinQuips: list });
  } catch (err) {
    console.error("GET /api/pin-quips error:", err);
    res.status(500).json({ ok: false, error: "Failed to list pin quips" });
  }
});

/**
 * GET /api/pin-quips/random
 * Return one random pin quip (for bot to use when pinning).
 * Auth: required.
 */
router.get("/random", authenticate, async (req, res) => {
  try {
    const row = await pinQuips.getRandom();
    if (!row) {
      return res
        .status(404)
        .json({ ok: false, error: "No pin quips in database" });
    }
    res.json({ ok: true, quip: row.quip, id: row.id });
  } catch (err) {
    console.error("GET /api/pin-quips/random error:", err);
    res.status(500).json({ ok: false, error: "Failed to get random pin quip" });
  }
});

/**
 * GET /api/pin-quips/:id
 * Get one pin quip by id.
 * Auth: required.
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const row = await pinQuips.getById(id);
    if (!row) {
      return res.status(404).json({ ok: false, error: "Pin quip not found" });
    }
    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("GET /api/pin-quips/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get pin quip" });
  }
});

/**
 * POST /api/pin-quips
 * Create a pin quip.
 * Body: { quip: string }
 * Auth: required.
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const quip = req.body?.quip;
    if (
      quip == null ||
      typeof quip !== "string" ||
      !quip.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "quip (non-empty string) is required",
      });
    }
    const id = await pinQuips.create(quip.trim());
    if (id == null) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to create pin quip" });
    }
    const row = await pinQuips.getById(id);
    res.status(201).json({ ok: true, ...row });
  } catch (err) {
    console.error("POST /api/pin-quips error:", err);
    res.status(500).json({ ok: false, error: "Failed to create pin quip" });
  }
});

/**
 * PUT /api/pin-quips/:id
 * Update a pin quip.
 * Body: { quip: string }
 * Auth: required.
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const quip = req.body?.quip;
    if (quip == null || typeof quip !== "string" || !quip.trim()) {
      return res.status(400).json({
        ok: false,
        error: "quip (non-empty string) is required",
      });
    }
    const updated = await pinQuips.update(id, { quip: quip.trim() });
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Pin quip not found" });
    }
    const row = await pinQuips.getById(id);
    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("PUT /api/pin-quips/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to update pin quip" });
  }
});

/**
 * DELETE /api/pin-quips/:id
 * Delete a pin quip.
 * Auth: required.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const deleted = await pinQuips.remove(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Pin quip not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/pin-quips/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete pin quip" });
  }
});

export default router;
