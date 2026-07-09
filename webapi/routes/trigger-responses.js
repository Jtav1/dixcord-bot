import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import * as triggerResponses from "../services/triggerResponses.js";
import * as triggerLottoPrizes from "../services/triggerLottoPrizes.js";

const router = express.Router();

/**
 * GET /api/trigger-responses
 * List all trigger-response pairs.
 * Auth: required.
 * @openapi
 * /api/trigger-responses:
 *   get:
 *     operationId: listTriggerResponses
 *     tags: [Trigger Responses]
 *     summary: List all trigger-response pairs
 *     description: Flat list of every trigger/response junction row, joined with its trigger and response text.
 *     responses:
 *       '200':
 *         description: All trigger-response pairs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 triggerResponses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, description: Junction (trigger_response) row id }
 *                       trigger_id: { type: integer }
 *                       response_id: { type: integer }
 *                       trigger_string: { type: string }
 *                       response_string: { type: string }
 *                       response_order: { type: integer, nullable: true }
 *                       weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *                       selection_mode: { type: string, enum: [random, ordered, weighted] }
 *                       created_at: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/trigger-responses/triggers:
 *   get:
 *     operationId: listTriggerStrings
 *     tags: [Trigger Responses]
 *     summary: List unique trigger strings
 *     description: Bare trigger text only (no ids), for the bot to match against message content.
 *     responses:
 *       '200':
 *         description: All trigger strings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 triggers:
 *                   type: array
 *                   items: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/trigger-responses/triggers/list:
 *   get:
 *     operationId: listTriggersWithMode
 *     tags: [Trigger Responses]
 *     summary: List all triggers with id and selection_mode
 *     description: >
 *       CRUD-oriented listing (unlike GET /api/trigger-responses/triggers, which returns bare strings).
 *       Registered before /triggers/{id} so the literal "list" segment is not shadowed by the id param route.
 *     responses:
 *       '200':
 *         description: All triggers.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 triggers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       trigger_string: { type: string }
 *                       selection_mode: { type: string, enum: [random, ordered, weighted] }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/trigger-responses/triggers/responses:
 *   get:
 *     operationId: listResponsesForTrigger
 *     tags: [Trigger Responses]
 *     summary: Get all responses for a trigger, by trigger text or trigger id
 *     description: >
 *       Exactly one of `trigger` or `triggerId` must be supplied; `triggerId` takes precedence if both
 *       are present. Returns 400 if neither is given. Registered before /triggers/{id} so the literal
 *       "responses" segment is not shadowed by the id param route.
 *     parameters:
 *       - name: trigger
 *         in: query
 *         required: false
 *         description: Trigger text. Ignored if triggerId is also given.
 *         schema: { type: string }
 *       - name: triggerId
 *         in: query
 *         required: false
 *         description: Trigger id. Takes precedence over trigger if both are given.
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The trigger and its responses.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 trigger_id: { type: integer }
 *                 trigger_string: { type: string }
 *                 selection_mode: { type: string, enum: [random, ordered, weighted] }
 *                 responses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, description: responses.id }
 *                       response_string: { type: string }
 *                       order: { type: integer, nullable: true }
 *                       weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *                       linkId: { type: integer, description: trigger_response junction row id }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/trigger-responses/triggers/{id}:
 *   get:
 *     operationId: getTrigger
 *     tags: [Trigger Responses]
 *     summary: Get one trigger by id, with its responses
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The trigger and its responses.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 trigger_string: { type: string }
 *                 selection_mode: { type: string, enum: [random, ordered, weighted] }
 *                 created_at: { type: string }
 *                 responses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, description: responses.id }
 *                       response_string: { type: string }
 *                       order: { type: integer, nullable: true }
 *                       weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *                       linkId: { type: integer, description: trigger_response junction row id }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/trigger-responses/triggers:
 *   post:
 *     operationId: createTrigger
 *     tags: [Trigger Responses]
 *     summary: Create a trigger with a batch of responses
 *     description: >
 *       Requires the admin role. If trigger_string already exists, reuses that trigger (and updates its
 *       selection_mode) rather than creating a duplicate; response_string values are deduped the same way.
 *       Entries in responses missing a non-empty response_string are silently skipped.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trigger_string, responses]
 *             properties:
 *               trigger_string: { type: string }
 *               selection_mode:
 *                 type: string
 *                 enum: [random, ordered, weighted]
 *                 default: random
 *                 description: Falls back to "random" if omitted or not one of the valid values.
 *               responses:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [response_string]
 *                   properties:
 *                     response_string: { type: string }
 *                     order: { type: integer, nullable: true, description: Used when selection_mode is "ordered". }
 *                     weight: { type: integer, nullable: true, minimum: 0, maximum: 100, description: Used when selection_mode is "weighted". }
 *     responses:
 *       '201':
 *         description: Created (or reused) trigger with its responses.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 trigger_string: { type: string }
 *                 selection_mode: { type: string, enum: [random, ordered, weighted] }
 *                 created_at: { type: string }
 *                 responses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, description: responses.id }
 *                       response_string: { type: string }
 *                       order: { type: integer, nullable: true }
 *                       weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *                       linkId: { type: integer, description: trigger_response junction row id }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/triggers", authenticate, requireAdmin, async (req, res) => {
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
 * @openapi
 * /api/trigger-responses/triggers/{id}:
 *   put:
 *     operationId: updateTrigger
 *     tags: [Trigger Responses]
 *     summary: Update a trigger's selection_mode and/or its response list
 *     description: >
 *       Requires the admin role. Each entry in `responses` is either `{ id: linkId, order?, weight? }` to
 *       update an existing trigger_response link's order/weight, or `{ response_string, order?, weight? }`
 *       to add a new response (deduped by response_string) to this trigger. Entries matching neither shape
 *       are silently skipped. Both fields are optional; an empty body is a no-op that still returns 200.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selection_mode:
 *                 type: string
 *                 enum: [random, ordered, weighted]
 *                 description: Falls back to "random" if not one of the valid values.
 *               responses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: integer, description: Existing trigger_response link id to update. }
 *                     response_string: { type: string, description: Adds a new response when id is not given. }
 *                     order: { type: integer, nullable: true }
 *                     weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *     responses:
 *       '200':
 *         description: The updated trigger with its responses.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 trigger_string: { type: string }
 *                 selection_mode: { type: string, enum: [random, ordered, weighted] }
 *                 created_at: { type: string }
 *                 responses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, description: responses.id }
 *                       response_string: { type: string }
 *                       order: { type: integer, nullable: true }
 *                       weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *                       linkId: { type: integer, description: trigger_response junction row id }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/triggers/:id", authenticate, requireAdmin, async (req, res) => {
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
 * DELETE /api/trigger-responses/triggers/:id
 * Delete a trigger and remove orphaned responses that are no longer linked to any trigger.
 * Auth: required.
 * @openapi
 * /api/trigger-responses/triggers/{id}:
 *   delete:
 *     operationId: deleteTrigger
 *     tags: [Trigger Responses]
 *     summary: Delete a trigger
 *     description: >
 *       Requires the admin role. Removes all trigger_response links for this trigger, then deletes any
 *       responses that are left with no remaining links (orphan cleanup).
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/triggers/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid trigger id" });
    }
    const deleted = await triggerResponses.deleteTrigger(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Trigger not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/trigger-responses/triggers/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete trigger" });
  }
});

/**
 * GET /api/trigger-responses/random?trigger=xxx
 * Return one response for the given trigger (selection_mode: random, weighted, ordered, or lotto is handled in service).
 * Auth: required.
 * @openapi
 * /api/trigger-responses/random:
 *   get:
 *     operationId: getRandomResponse
 *     tags: [Trigger Responses]
 *     summary: Get one selected response for a trigger
 *     description: >
 *       Looks up the trigger by exact trigger_string and picks one response per its selection_mode:
 *       "random" (uniform DB-side random pick), "ordered" (round-robin by response_order, tracked in
 *       trigger_response_state), or "weighted" (weighted roll against each link's weight, 0-100).
 *       Selecting a response increments frequency counters on the trigger, response, and link rows.
 *     parameters:
 *       - name: trigger
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The selected response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 response: { type: string, description: The chosen response_string. }
 *                 id: { type: integer, description: responses.id of the chosen response. }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         description: No trigger matching trigger_string, or it has no responses.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
    res.json({
      ok: true,
      response: row.response_string,
      id: row.id,
      ...(row.lotto_prize ? { lotto_prize: row.lotto_prize } : {}),
    });
  } catch (err) {
    console.error("GET /api/trigger-responses/random error:", err);
    res.status(500).json({ ok: false, error: "Failed to get random response" });
  }
});

/**
 * GET /api/trigger-responses/responses/:id
 * Get one response by id (responses table).
 * Auth: required.
 * @openapi
 * /api/trigger-responses/responses/{id}:
 *   get:
 *     operationId: getResponse
 *     tags: [Trigger Responses]
 *     summary: Get one response by id
 *     description: Reads directly from the responses table (not the trigger_response junction).
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 response_string: { type: string }
 *                 created_at: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/trigger-responses/responses/{id}:
 *   put:
 *     operationId: updateResponse
 *     tags: [Trigger Responses]
 *     summary: Update a response's text
 *     description: >
 *       Requires the admin role. Updates the shared responses row directly, so the new text applies to
 *       every trigger this response is linked to.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response_string]
 *             properties:
 *               response_string: { type: string }
 *     responses:
 *       '200':
 *         description: The updated response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 response_string: { type: string }
 *                 created_at: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/responses/:id", authenticate, requireAdmin, async (req, res) => {
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
 * @openapi
 * /api/trigger-responses/responses/{id}:
 *   delete:
 *     operationId: deleteResponse
 *     tags: [Trigger Responses]
 *     summary: Delete a response
 *     description: >
 *       Requires the admin role. Deletes the shared responses row; trigger_response links referencing it
 *       are removed via ON DELETE CASCADE, so this unlinks the response from every trigger that used it.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/responses/:id", authenticate, requireAdmin, async (req, res) => {
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
 * GET /api/trigger-responses/lotto-prizes
 * List lotto prize catalog rows (id, prize_string, frequency).
 * Auth: required.
 */
router.get("/lotto-prizes", authenticate, async (req, res) => {
  try {
    const lottoPrizes = await triggerLottoPrizes.getAll();
    res.json({ ok: true, lottoPrizes });
  } catch (err) {
    console.error("GET /api/trigger-responses/lotto-prizes error:", err);
    res.status(500).json({ ok: false, error: "Failed to list lotto prizes" });
  }
});

/**
 * GET /api/trigger-responses/:id
 * Get one trigger-response link (junction) by id.
 * Auth: required.
 * @openapi
 * /api/trigger-responses/{id}:
 *   get:
 *     operationId: getTriggerResponseLink
 *     tags: [Trigger Responses]
 *     summary: Get one trigger-response link by id
 *     description: >
 *       Registered last among the GET routes on this router so more specific literal segments
 *       (/triggers, /triggers/list, /triggers/responses, /random, /responses/{id}) are matched first.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: trigger_response junction row id (not a trigger id or response id).
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The trigger-response link.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer, description: Junction (trigger_response) row id }
 *                 trigger_id: { type: integer }
 *                 response_id: { type: integer }
 *                 trigger_string: { type: string }
 *                 response_string: { type: string }
 *                 response_order: { type: integer, nullable: true }
 *                 weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *                 selection_mode: { type: string, enum: [random, ordered, weighted] }
 *                 created_at: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * Body: { trigger_string, response_string, response_order?, selection_mode?, weight?, lotto_prize? }
 * Auth: required.
 * @openapi
 * /api/trigger-responses:
 *   post:
 *     operationId: createTriggerResponseLink
 *     tags: [Trigger Responses]
 *     summary: Create a single trigger-response pair
 *     description: >
 *       Requires the admin role. Convenience one-shot alternative to POST /api/trigger-responses/triggers:
 *       gets-or-creates the trigger (by trigger_string) and the response (by response_string), then links
 *       them with a new trigger_response row. Setting selection_mode here updates the trigger's mode.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trigger_string, response_string]
 *             properties:
 *               trigger_string: { type: string }
 *               response_string: { type: string }
 *               response_order: { type: integer, nullable: true }
 *               selection_mode:
 *                 type: string
 *                 enum: [random, ordered, weighted]
 *                 default: random
 *               weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *     responses:
 *       '201':
 *         description: The created trigger-response link.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer, description: Junction (trigger_response) row id }
 *                 trigger_id: { type: integer }
 *                 response_id: { type: integer }
 *                 trigger_string: { type: string }
 *                 response_string: { type: string }
 *                 response_order: { type: integer, nullable: true }
 *                 weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *                 selection_mode: { type: string, enum: [random, ordered, weighted] }
 *                 created_at: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      trigger_string,
      response_string,
      response_order,
      selection_mode,
      weight,
      lotto_prize,
    } = req.body ?? {};
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
      lotto_prize,
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
 * Body: { trigger_string?, response_string?, response_order?, selection_mode?, weight?, lotto_prize? }
 * Auth: required.
 * @openapi
 * /api/trigger-responses/{id}:
 *   put:
 *     operationId: updateTriggerResponseLink
 *     tags: [Trigger Responses]
 *     summary: Update a trigger-response link
 *     description: >
 *       Requires the admin role. All fields are optional but at least one must be given (400 otherwise).
 *       Setting trigger_string or response_string re-points the link at a get-or-created trigger/response
 *       (by string, deduped) rather than renaming the existing one in place. selection_mode is applied to
 *       the link's trigger. response_order and weight may be set to null to clear them.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: trigger_response junction row id.
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               trigger_string: { type: string, description: Re-points the link at this (get-or-created) trigger. }
 *               response_string: { type: string, description: Re-points the link at this (get-or-created) response. }
 *               response_order: { type: integer, nullable: true }
 *               selection_mode: { type: string, enum: [random, ordered, weighted] }
 *               weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *     responses:
 *       '200':
 *         description: The updated trigger-response link.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer, description: Junction (trigger_response) row id }
 *                 trigger_id: { type: integer }
 *                 response_id: { type: integer }
 *                 trigger_string: { type: string }
 *                 response_string: { type: string }
 *                 response_order: { type: integer, nullable: true }
 *                 weight: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *                 selection_mode: { type: string, enum: [random, ordered, weighted] }
 *                 created_at: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const {
      trigger_string,
      response_string,
      response_order,
      selection_mode,
      weight,
      lotto_prize,
    } = req.body ?? {};
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
    if (lotto_prize !== undefined) updates.lotto_prize = lotto_prize;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        error:
          "Provide at least one of trigger_string, response_string, response_order, selection_mode, weight, or lotto_prize to update",
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
 * @openapi
 * /api/trigger-responses/{id}:
 *   delete:
 *     operationId: deleteTriggerResponseLink
 *     tags: [Trigger Responses]
 *     summary: Delete a trigger-response link
 *     description: >
 *       Requires the admin role. Removes only the trigger_response junction row; the underlying trigger
 *       and response rows are left in place (unlike DELETE /triggers/{id}, which also prunes orphaned
 *       responses).
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: trigger_response junction row id.
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
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
