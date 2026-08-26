import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import * as eightBall from "../services/eightBallResponses.js";
import { recordAudit } from "../services/auditLog.js";

const router = express.Router();

/**
 * GET /api/eight-ball-responses
 * List all eight-ball responses.
 * Auth: required (admin or bot).
 * @openapi
 * /api/eight-ball-responses:
 *   get:
 *     operationId: listEightBallResponses
 *     tags: [Eight Ball Responses]
 *     summary: List all eight-ball responses
 *     responses:
 *       '200':
 *         description: All eight-ball responses.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 eightBallResponses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       response_string: { type: string }
 *                       sentiment: { type: string, enum: [positive, negative, neutral] }
 *                       frequency: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const list = await eightBall.getAll();
    res.json({ ok: true, eightBallResponses: list });
  } catch (err) {
    console.error("GET /api/eight-ball-responses error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to list eight-ball responses" });
  }
});

/**
 * GET /api/eight-ball-responses/:id
 * Get one eight-ball response by id.
 * Auth: required (admin or bot).
 * @openapi
 * /api/eight-ball-responses/{id}:
 *   get:
 *     operationId: getEightBallResponse
 *     tags: [Eight Ball Responses]
 *     summary: Get one eight-ball response by id
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The eight-ball response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 eightBallResponse:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     response_string: { type: string }
 *                     sentiment: { type: string, enum: [positive, negative, neutral] }
 *                     frequency: { type: integer }
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
    const row = await eightBall.getById(id);
    if (!row) {
      return res
        .status(404)
        .json({ ok: false, error: "Eight-ball response not found" });
    }
    res.json({ ok: true, eightBallResponse: row });
  } catch (err) {
    console.error("GET /api/eight-ball-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to get eight-ball response" });
  }
});

/**
 * POST /api/eight-ball-responses
 * Create an eight-ball response.
 * Body: { response_string: string, sentiment: "positive"|"negative"|"neutral" }
 * Auth: admin required.
 * @openapi
 * /api/eight-ball-responses:
 *   post:
 *     operationId: createEightBallResponse
 *     tags: [Eight Ball Responses]
 *     summary: Create an eight-ball response
 *     description: Requires the admin role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response_string, sentiment]
 *             properties:
 *               response_string: { type: string }
 *               sentiment: { type: string, enum: [positive, negative, neutral] }
 *     responses:
 *       '201':
 *         description: Created eight-ball response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 eightBallResponse:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     response_string: { type: string }
 *                     sentiment: { type: string, enum: [positive, negative, neutral] }
 *                     frequency: { type: integer }
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
    const responseString = req.body?.response_string;
    const sentiment = req.body?.sentiment;
    if (
      responseString == null ||
      typeof responseString !== "string" ||
      !responseString.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "response_string (non-empty string) is required",
      });
    }
    if (sentiment == null || !eightBall.VALID_SENTIMENTS.has(String(sentiment))) {
      return res.status(400).json({
        ok: false,
        error: 'sentiment must be "positive", "negative", or "neutral"',
      });
    }
    const id = await eightBall.create(responseString, sentiment);
    if (id == null) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to create eight-ball response" });
    }
    const row = await eightBall.getById(id);
    await recordAudit(req.user.id, "create", "eight_ball_responses", id, {
      response_string: row.response_string,
    });
    res.status(201).json({ ok: true, eightBallResponse: row });
  } catch (err) {
    console.error("POST /api/eight-ball-responses error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to create eight-ball response" });
  }
});

/**
 * PUT /api/eight-ball-responses/:id
 * Update an eight-ball response.
 * Body: { response_string?: string, sentiment?: string }
 * Auth: admin required.
 * @openapi
 * /api/eight-ball-responses/{id}:
 *   put:
 *     operationId: updateEightBallResponse
 *     tags: [Eight Ball Responses]
 *     summary: Update an eight-ball response
 *     description: Requires the admin role. Provide at least one of response_string or sentiment.
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
 *             properties:
 *               response_string: { type: string }
 *               sentiment: { type: string, enum: [positive, negative, neutral] }
 *     responses:
 *       '200':
 *         description: Updated eight-ball response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 eightBallResponse:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     response_string: { type: string }
 *                     sentiment: { type: string, enum: [positive, negative, neutral] }
 *                     frequency: { type: integer }
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
    const updated = await eightBall.update(id, {
      response_string: req.body?.response_string,
      sentiment: req.body?.sentiment,
    });
    if (!updated) {
      const existing = await eightBall.getById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ ok: false, error: "Eight-ball response not found" });
      }
      return res.status(400).json({
        ok: false,
        error: "Provide valid response_string and/or sentiment to update",
      });
    }
    const row = await eightBall.getById(id);
    await recordAudit(req.user.id, "update", "eight_ball_responses", id, {});
    res.json({ ok: true, eightBallResponse: row });
  } catch (err) {
    console.error("PUT /api/eight-ball-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to update eight-ball response" });
  }
});

/**
 * DELETE /api/eight-ball-responses/:id
 * Delete an eight-ball response.
 * Auth: admin required.
 * @openapi
 * /api/eight-ball-responses/{id}:
 *   delete:
 *     operationId: deleteEightBallResponse
 *     tags: [Eight Ball Responses]
 *     summary: Delete an eight-ball response
 *     description: Requires the admin role.
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
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const deleted = await eightBall.remove(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ ok: false, error: "Eight-ball response not found" });
    }
    await recordAudit(req.user.id, "delete", "eight_ball_responses", id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/eight-ball-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to delete eight-ball response" });
  }
});

export default router;
