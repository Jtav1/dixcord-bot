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
 * GET /api/trigger-responses/triggers/list
 * List all triggers with id and selection_mode (for CRUD).
 * Auth: required.
 */
router.get("/triggers/list", authenticate, async (req, res) => {
  try {
    const list = await triggerResponses.getTriggers();
    res.json({ ok: true, triggers: list });
  } catch (err) {
    console.error("GET /api/trigger-responses/triggers/list error:", err);
    res.status(500).json({ ok: false, error: "Failed to list triggers" });
  }
});

/**
 * GET /api/trigger-responses/triggers/responses?trigger=xxx | ?triggerId=xxx
 * Get all responses for a trigger by trigger text or trigger id.
 * Auth: required.
 */
router.get("/triggers/responses", authenticate, async (req, res) => {
  try {
    const { trigger, triggerId } = req.query;
    const idParam = triggerId != null && triggerId !== "" ? parseInt(triggerId, 10) : null;
    const triggerParam = typeof trigger === "string" && trigger.trim() ? trigger.trim() : null;
    if (idParam != null && !Number.isNaN(idParam)) {
      const data = await triggerResponses.getResponsesForTrigger(idParam);
      if (!data) {
        return res.status(404).json({ ok: false, error: "Trigger not found" });
      }
      return res.json({ ok: true, ...data });
    }
    if (triggerParam) {
      const data = await triggerResponses.getResponsesForTrigger(triggerParam);
      if (!data) {
        return res.status(404).json({ ok: false, error: "Trigger not found" });
      }
      return res.json({ ok: true, ...data });
    }
    return res.status(400).json({
      ok: false,
      error: "Query parameter 'trigger' (trigger text) or 'triggerId' (trigger id) is required",
    });
  } catch (err) {
    console.error("GET /api/trigger-responses/triggers/responses error:", err);
    res.status(500).json({ ok: false, error: "Failed to get responses for trigger" });
  }
});

/**
 * GET /api/trigger-responses/triggers/:id
 * Get one trigger by id with its responses array (each response has id, response_string, order, linkId).
 * Auth: required.
 */
router.get("/triggers/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid trigger id" });
    }
    const trigger = await triggerResponses.getTriggerById(id);
    if (!trigger) {
      return res.status(404).json({ ok: false, error: "Trigger not found" });
    }
    res.json({ ok: true, ...trigger });
  } catch (err) {
    console.error("GET /api/trigger-responses/triggers/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get trigger" });
  }
});

/**
 * POST /api/trigger-responses/triggers
 * Create a trigger (if it doesn't exist) with selection_mode and an array of responses.
 * Body: { trigger_string, selection_mode?, responses: [ { response_string, order?, weight? } ] }
 * Auth: required.
 */
router.post("/triggers", authenticate, async (req, res) => {
  try {
    const { trigger_string, selection_mode, responses } = req.body ?? {};
    if (!trigger_string || typeof trigger_string !== "string" || !trigger_string.trim()) {
      return res.status(400).json({
        ok: false,
        error: "trigger_string (non-empty string) is required",
      });
    }
    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "responses (non-empty array of { response_string, order? }) is required",
      });
    }
    const trigger = await triggerResponses.createTriggerWithResponses({
      trigger_string: trigger_string.trim(),
      selection_mode,
      responses,
    });
    if (!trigger) {
      return res.status(500).json({ ok: false, error: "Failed to create trigger with responses" });
    }
    res.status(201).json({ ok: true, ...trigger });
  } catch (err) {
    console.error("POST /api/trigger-responses/triggers error:", err);
    res.status(500).json({ ok: false, error: "Failed to create trigger" });
  }
});

/**
 * PUT /api/trigger-responses/triggers/:id
 * Update trigger: selection_mode and/or responses (set order/weight by link id, or add new response).
 * Body: { selection_mode?, responses?: [ { id: linkId, order?, weight? } | { response_string, order?, weight? } ] }
 * Auth: required.
 */
router.put("/triggers/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid trigger id" });
    }
    const { selection_mode, responses } = req.body ?? {};
    const updated = await triggerResponses.updateTrigger(id, { selection_mode, responses });
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Trigger not found" });
    }
    const trigger = await triggerResponses.getTriggerById(id);
    res.json({ ok: true, ...trigger });
  } catch (err) {
    console.error("PUT /api/trigger-responses/triggers/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to update trigger" });
  }
});

/**
 * GET /api/trigger-responses/random?trigger=xxx
 * Return one response for the given trigger (selection_mode: random, weighted, or ordered is handled in service).
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
 * GET /api/trigger-responses/responses/:id
 * Get one response by id (responses table).
 * Auth: required.
 */
router.get("/responses/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid response id" });
    }
    const response = await triggerResponses.getResponseById(id);
    if (!response) {
      return res.status(404).json({ ok: false, error: "Response not found" });
    }
    res.json({ ok: true, ...response });
  } catch (err) {
    console.error("GET /api/trigger-responses/responses/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get response" });
  }
});

/**
 * PUT /api/trigger-responses/responses/:id
 * Update a response's text. Body: { response_string }
 * Auth: required.
 */
router.put("/responses/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid response id" });
    }
    const { response_string } = req.body ?? {};
    if (response_string == null || typeof response_string !== "string" || !response_string.trim()) {
      return res.status(400).json({ ok: false, error: "response_string (non-empty string) is required" });
    }
    const updated = await triggerResponses.updateResponse(id, { response_string });
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Response not found" });
    }
    const response = await triggerResponses.getResponseById(id);
    res.json({ ok: true, ...response });
  } catch (err) {
    console.error("PUT /api/trigger-responses/responses/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to update response" });
  }
});

/**
 * DELETE /api/trigger-responses/responses/:id
 * Delete a response (removes from all triggers via cascade).
 * Auth: required.
 */
router.delete("/responses/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid response id" });
    }
    const deleted = await triggerResponses.deleteResponse(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Response not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/trigger-responses/responses/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete response" });
  }
});

/**
 * GET /api/trigger-responses/:id
 * Get one trigger-response link (junction) by id.
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
 * Body: { trigger_string, response_string, response_order?, selection_mode?, weight? }
 * Auth: required.
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const { trigger_string, response_string, response_order, selection_mode, weight } =
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
      weight,
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
 * Body: { trigger_string?, response_string?, response_order?, selection_mode?, weight? }
 * Auth: required.
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const { trigger_string, response_string, response_order, selection_mode, weight } =
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
    if (weight !== undefined) updates.weight = weight;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        error:
          "Provide at least one of trigger_string, response_string, response_order, selection_mode, or weight to update",
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
