import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as triggerResponses from "../services/triggerResponses.js";

const router = express.Router();

/**
 * GET /api/trigger-responses
 * List all trigger-response pairs.
 * Auth: required.
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const list = await triggerResponses.getAll();
    res.json({ ok: true, triggerResponses: list });
  } catch (err) {
    console.error("GET /api/trigger-responses error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to list trigger-responses" });
  }
});

/**
 * GET /api/trigger-responses/triggers
 * List unique trigger strings (for bot to match against message content).
 * Auth: required.
 */
router.get("/triggers", authenticate, async (req, res) => {
  try {
    const triggers = await triggerResponses.getTriggerList();
    res.json({ ok: true, triggers });
  } catch (err) {
    console.error("GET /api/trigger-responses/triggers error:", err);
    res.status(500).json({ ok: false, error: "Failed to list triggers" });
  }
});

/**
 * GET /api/trigger-responses/random?trigger=xxx
 * Return one random response string for the given trigger. Used by bot when message matches a trigger.
 * Auth: required.
 */
router.get("/random", authenticate, async (req, res) => {
  try {
    const trigger = req.query.trigger;
    if (!trigger || typeof trigger !== "string" || !trigger.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Query parameter 'trigger' (non-empty string) is required",
      });
    }
    const row = await triggerResponses.getRandomResponse(trigger.trim());
    if (!row) {
      return res
        .status(404)
        .json({ ok: false, error: "No responses found for this trigger" });
    }
    res.json({ ok: true, response: row.response_string, id: row.id });
  } catch (err) {
    console.error("GET /api/trigger-responses/random error:", err);
    res.status(500).json({ ok: false, error: "Failed to get random response" });
  }
});

/**
 * GET /api/trigger-responses/:id
 * Get one trigger-response pair by id.
 * Auth: required.
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const row = await triggerResponses.getById(id);
    if (!row) {
      return res
        .status(404)
        .json({ ok: false, error: "Trigger-response not found" });
    }
    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("GET /api/trigger-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to get trigger-response" });
  }
});

/**
 * POST /api/trigger-responses
 * Create a trigger-response pair.
 * Body: { trigger_string, response_string, response_order?, selection_mode? }
 * Auth: required.
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const { trigger_string, response_string, response_order, selection_mode } =
      req.body ?? {};
    if (
      trigger_string == null ||
      response_string == null ||
      typeof trigger_string !== "string" ||
      typeof response_string !== "string" ||
      !trigger_string.trim() ||
      !response_string.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "trigger_string and response_string (non-empty strings) are required",
      });
    }
    const id = await triggerResponses.create(
      trigger_string.trim(),
      response_string.trim(),
      response_order,
      selection_mode,
    );
    if (id == null) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to create trigger-response" });
    }
    const row = await triggerResponses.getById(id);
    res.status(201).json({ ok: true, ...row });
  } catch (err) {
    console.error("POST /api/trigger-responses error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to create trigger-response" });
  }
});

/**
 * PUT /api/trigger-responses/:id
 * Update a trigger-response pair.
 * Body: { trigger_string?, response_string?, response_order?, selection_mode? }
 * Auth: required.
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const { trigger_string, response_string, response_order, selection_mode } =
      req.body ?? {};
    const updates = {};
    if (typeof trigger_string === "string" && trigger_string.trim())
      updates.trigger_string = trigger_string.trim();
    if (typeof response_string === "string" && response_string.trim())
      updates.response_string = response_string.trim();
    if (response_order !== undefined)
      updates.response_order =
        response_order === null || response_order === ""
          ? null
          : parseInt(response_order, 10);
    if (typeof selection_mode === "string" && selection_mode.trim())
      updates.selection_mode = selection_mode.trim();
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        error:
          "Provide at least one of trigger_string, response_string, response_order, or selection_mode to update",
      });
    }
    const updated = await triggerResponses.update(id, updates);
    if (!updated) {
      return res
        .status(404)
        .json({ ok: false, error: "Trigger-response not found" });
    }
    const row = await triggerResponses.getById(id);
    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("PUT /api/trigger-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to update trigger-response" });
  }
});

/**
 * DELETE /api/trigger-responses/:id
 * Delete a trigger-response pair.
 * Auth: required.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const deleted = await triggerResponses.remove(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ ok: false, error: "Trigger-response not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/trigger-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to delete trigger-response" });
  }
});

export default router;
