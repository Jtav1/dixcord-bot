import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import * as milestones from "../services/milestones.js";
import { MILESTONE_TYPES, isMilestoneTypeSupported } from "../services/milestoneTypes.js";

const router = express.Router();

/**
 * Validate quantity/type/item/message/object for create/update, returning an error string or null.
 * @private
 */
function validateMilestoneFields({ quantity, type, item, message, object }, { partial = false } = {}) {
  if (!partial || quantity !== undefined) {
    if (!Number.isInteger(quantity) || quantity < 0) {
      return "quantity must be a non-negative integer";
    }
  }
  if (!partial || type !== undefined) {
    if (!isMilestoneTypeSupported(type)) {
      return "type must be one of the supported milestone types (see GET /api/milestones/types)";
    }
    const itemRequired = MILESTONE_TYPES[type].itemRequired;
    if (itemRequired && (item == null || String(item).trim() === "")) {
      return "item is required for this type";
    }
    if (!itemRequired && item != null && String(item).trim() !== "") {
      return "item must be omitted/null for this type";
    }
  }
  if (!partial || message !== undefined) {
    if (typeof message !== "string" || !message.trim()) {
      return "message (non-empty string) is required";
    }
  }
  if (!partial || object !== undefined) {
    if (typeof object !== "string" || !object.trim()) {
      return "object (non-empty string) is required";
    }
  }
  return null;
}

/**
 * GET /api/milestones
 * List milestones, optionally filtered by type/item/object/achieved.
 * Auth: required.
 * @openapi
 * /api/milestones:
 *   get:
 *     operationId: listMilestones
 *     tags: [Milestones]
 *     summary: List milestones
 *     parameters:
 *       - name: type
 *         in: query
 *         schema: { type: string }
 *       - name: item
 *         in: query
 *         schema: { type: string }
 *       - name: object
 *         in: query
 *         schema: { type: string }
 *       - name: achieved
 *         in: query
 *         schema: { type: boolean }
 *     responses:
 *       '200':
 *         description: All matching milestones.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 milestones:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Milestone' }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const { type, item, object } = req.query;
    const achieved =
      req.query.achieved === undefined ? undefined : req.query.achieved === "true";
    const list = await milestones.getAll({ type, item, object, achieved });
    res.json({ ok: true, milestones: list });
  } catch (err) {
    console.error("GET /api/milestones error:", err);
    res.status(500).json({ ok: false, error: "Failed to list milestones" });
  }
});

/**
 * GET /api/milestones/types
 * Return the fixed dictionary of valid milestones.type values.
 * Auth: required.
 * @openapi
 * /api/milestones/types:
 *   get:
 *     operationId: listMilestoneTypes
 *     tags: [Milestones]
 *     summary: List valid milestone type values
 *     responses:
 *       '200':
 *         description: The milestone type dictionary.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 types:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       itemRequired: { type: boolean }
 *                       description: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/types", authenticate, (req, res) => {
  res.json({ ok: true, types: MILESTONE_TYPES });
});

/**
 * GET /api/milestones/:id
 * Get one milestone by id.
 * Auth: required.
 * @openapi
 * /api/milestones/{id}:
 *   get:
 *     operationId: getMilestone
 *     tags: [Milestones]
 *     summary: Get one milestone by id
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The milestone.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { ok: { type: boolean, enum: [true] } }
 *                 - $ref: '#/components/schemas/Milestone'
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
    const row = await milestones.getById(id);
    if (!row) {
      return res.status(404).json({ ok: false, error: "Milestone not found" });
    }
    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("GET /api/milestones/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get milestone" });
  }
});

/**
 * POST /api/milestones
 * Create a milestone definition. `achieved` always starts false.
 * Body: { quantity: number, type: string, item?: string, message: string, object: string }
 * Auth: required, admin role.
 * @openapi
 * /api/milestones:
 *   post:
 *     operationId: createMilestone
 *     tags: [Milestones]
 *     summary: Create a milestone
 *     description: Requires the admin role. `achieved` always starts false.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity, type, message, object]
 *             properties:
 *               quantity: { type: integer, minimum: 0 }
 *               type: { type: string, description: "Must be one of the keys from GET /api/milestones/types." }
 *               item: { type: string, nullable: true, description: "Required or forbidden depending on the type; see GET /api/milestones/types." }
 *               message: { type: string }
 *               object: { type: string, description: "Free-form display category, not used for matching." }
 *     responses:
 *       '201':
 *         description: Created milestone.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { ok: { type: boolean, enum: [true] } }
 *                 - $ref: '#/components/schemas/Milestone'
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
    const { quantity, type, item = null, message, object } = req.body ?? {};
    const error = validateMilestoneFields({ quantity, type, item, message, object });
    if (error) {
      return res.status(400).json({ ok: false, error });
    }
    const normalizedItem = item == null || String(item).trim() === "" ? null : String(item).trim();
    const duplicate = await milestones.findDuplicate({ type, item: normalizedItem, quantity });
    if (duplicate) {
      return res.status(400).json({
        ok: false,
        error: "A milestone with this type/item/quantity already exists",
      });
    }
    const row = await milestones.create({
      quantity,
      type,
      item: normalizedItem,
      message: message.trim(),
      object: object.trim(),
    });
    res.status(201).json({ ok: true, ...row });
  } catch (err) {
    console.error("POST /api/milestones error:", err);
    res.status(500).json({ ok: false, error: "Failed to create milestone" });
  }
});

/**
 * PUT /api/milestones/:id
 * Update a milestone (partial). Can toggle `achieved` manually.
 * Auth: required, admin role.
 * @openapi
 * /api/milestones/{id}:
 *   put:
 *     operationId: updateMilestone
 *     tags: [Milestones]
 *     summary: Update a milestone
 *     description: Requires the admin role. Partial update; only provided fields change.
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
 *               quantity: { type: integer, minimum: 0 }
 *               type: { type: string }
 *               item: { type: string, nullable: true }
 *               message: { type: string }
 *               object: { type: string }
 *               achieved: { type: boolean }
 *     responses:
 *       '200':
 *         description: Updated milestone.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { ok: { type: boolean, enum: [true] } }
 *                 - $ref: '#/components/schemas/Milestone'
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
    const existing = await milestones.getById(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Milestone not found" });
    }

    const { quantity, type, item, message, object, achieved } = req.body ?? {};
    const error = validateMilestoneFields({ quantity, type, item, message, object }, { partial: true });
    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    const nextType = type !== undefined ? type : existing.type;
    const nextQuantity = quantity !== undefined ? quantity : existing.quantity;
    const nextItem =
      item !== undefined
        ? item == null || String(item).trim() === ""
          ? null
          : String(item).trim()
        : existing.item;

    const duplicate = await milestones.findDuplicate({
      type: nextType,
      item: nextItem,
      quantity: nextQuantity,
      excludeId: id,
    });
    if (duplicate) {
      return res.status(400).json({
        ok: false,
        error: "A milestone with this type/item/quantity already exists",
      });
    }

    const updated = await milestones.update(id, {
      quantity: quantity !== undefined ? quantity : undefined,
      type: type !== undefined ? type : undefined,
      item: item !== undefined ? nextItem : undefined,
      message: message !== undefined ? message.trim() : undefined,
      object: object !== undefined ? object.trim() : undefined,
      achieved: achieved !== undefined ? Boolean(achieved) : undefined,
    });
    res.json({ ok: true, ...updated });
  } catch (err) {
    console.error("PUT /api/milestones/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to update milestone" });
  }
});

/**
 * DELETE /api/milestones/:id
 * Delete a milestone.
 * Auth: required, admin role.
 * @openapi
 * /api/milestones/{id}:
 *   delete:
 *     operationId: deleteMilestone
 *     tags: [Milestones]
 *     summary: Delete a milestone
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
    const deleted = await milestones.remove(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Milestone not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/milestones/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete milestone" });
  }
});

export default router;
