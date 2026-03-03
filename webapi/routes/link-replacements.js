import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as linkReplacements from "../services/linkReplacements.js";

const router = express.Router();

/**
 * GET /api/link-replacements
 * List all link replacements (source_host -> target_host).
 * Auth: none.
 */
router.get("/", async (req, res) => {
  try {
    const list = await linkReplacements.getAll();
    res.json({ ok: true, linkReplacements: list });
  } catch (err) {
    console.error("GET /api/link-replacements error:", err);
    res.status(500).json({ ok: false, error: "Failed to list link replacements" });
  }
});

/**
 * GET /api/link-replacements/:id
 * Get one link replacement by id.
 * Auth: none.
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const row = await linkReplacements.getById(id);
    if (!row) {
      return res.status(404).json({ ok: false, error: "Link replacement not found" });
    }
    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("GET /api/link-replacements/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get link replacement" });
  }
});

/**
 * POST /api/link-replacements
 * Create a link replacement.
 * Body: { source_host, target_host }
 * Auth: required.
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const { source_host, target_host } = req.body ?? {};
    if (!source_host || !target_host || typeof source_host !== "string" || typeof target_host !== "string") {
      return res.status(400).json({
        ok: false,
        error: "source_host and target_host (non-empty strings) are required",
      });
    }
    const id = await linkReplacements.create(
      source_host.trim(),
      target_host.trim()
    );
    if (id == null) {
      return res.status(500).json({ ok: false, error: "Failed to create link replacement" });
    }
    const row = await linkReplacements.getById(id);
    res.status(201).json({ ok: true, ...row });
  } catch (err) {
    console.error("POST /api/link-replacements error:", err);
    if (err.code === "ER_DUP_ENTRY" || err.message?.includes("UNIQUE")) {
      return res.status(409).json({ ok: false, error: "A replacement for this source_host already exists" });
    }
    res.status(500).json({ ok: false, error: "Failed to create link replacement" });
  }
});

/**
 * PUT /api/link-replacements/:id
 * Update a link replacement.
 * Body: { source_host?, target_host? }
 * Auth: required.
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const { source_host, target_host } = req.body ?? {};
    const updates = {};
    if (typeof source_host === "string" && source_host.trim()) updates.source_host = source_host.trim();
    if (typeof target_host === "string" && target_host.trim()) updates.target_host = target_host.trim();
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: "Provide at least one of source_host or target_host to update" });
    }
    const updated = await linkReplacements.update(id, updates);
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Link replacement not found" });
    }
    const row = await linkReplacements.getById(id);
    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("PUT /api/link-replacements/:id error:", err);
    if (err.code === "ER_DUP_ENTRY" || err.message?.includes("UNIQUE")) {
      return res.status(409).json({ ok: false, error: "A replacement for this source_host already exists" });
    }
    res.status(500).json({ ok: false, error: "Failed to update link replacement" });
  }
});

/**
 * DELETE /api/link-replacements/:id
 * Delete a link replacement.
 * Auth: required.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const deleted = await linkReplacements.remove(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Link replacement not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/link-replacements/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete link replacement" });
  }
});

export default router;
