import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import * as pinQuips from "../services/pinQuips.js";

const router = express.Router();

/**
 * GET /api/pin-quips
 * List all pin quips.
 * Auth: required.
 * @openapi
 * /api/pin-quips:
 *   get:
 *     operationId: listPinQuips
 *     tags: [Pin Quips]
 *     summary: List all pin quips
 *     responses:
 *       '200':
 *         description: All pin quips.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 pinQuips:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       quip: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/pin-quips/random:
 *   get:
 *     operationId: getRandomPinQuip
 *     tags: [Pin Quips]
 *     summary: Get one random pin quip
 *     responses:
 *       '200':
 *         description: A random pin quip.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 quip: { type: string }
 *                 id: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         description: No pin quips exist yet.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/pin-quips/{id}:
 *   get:
 *     operationId: getPinQuip
 *     tags: [Pin Quips]
 *     summary: Get one pin quip by id
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The pin quip.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 quip: { type: string }
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
 * @openapi
 * /api/pin-quips:
 *   post:
 *     operationId: createPinQuip
 *     tags: [Pin Quips]
 *     summary: Create a pin quip
 *     description: Requires the admin role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quip]
 *             properties:
 *               quip: { type: string }
 *     responses:
 *       '201':
 *         description: Created pin quip.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 quip: { type: string }
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
 * @openapi
 * /api/pin-quips/{id}:
 *   put:
 *     operationId: updatePinQuip
 *     tags: [Pin Quips]
 *     summary: Update a pin quip
 *     description: Requires the admin role.
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
 *             required: [quip]
 *             properties:
 *               quip: { type: string }
 *     responses:
 *       '200':
 *         description: Updated pin quip.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 quip: { type: string }
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
 * @openapi
 * /api/pin-quips/{id}:
 *   delete:
 *     operationId: deletePinQuip
 *     tags: [Pin Quips]
 *     summary: Delete a pin quip
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
