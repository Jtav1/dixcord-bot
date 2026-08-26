import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import * as linkReplacements from "../services/linkReplacements.js";

const router = express.Router();

/**
 * Validate source/target hosts for create or update.
 * @param {{ source_host?: string, target_host?: string }} fields
 * @returns {string|null} Error message, or null when valid.
 */
function validateLinkReplacementFields(fields) {
  if (fields.source_host !== undefined) {
    const err = linkReplacements.validateLinkReplacementHost(
      fields.source_host,
      "source",
    );
    if (err) return err;
  }
  if (fields.target_host !== undefined) {
    const err = linkReplacements.validateLinkReplacementHost(
      fields.target_host,
      "target",
    );
    if (err) return err;
  }
  return null;
}

/**
 * GET /api/link-replacements
 * List all link replacements (source_host -> target_host).
 * Auth: required.
 * @openapi
 * /api/link-replacements:
 *   get:
 *     operationId: listLinkReplacements
 *     tags: [Link Replacements]
 *     summary: List all link replacements
 *     responses:
 *       '200':
 *         description: All link replacements.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 linkReplacements:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       source_host: { type: string }
 *                       target_host: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
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
 * Auth: required.
 * @openapi
 * /api/link-replacements/{id}:
 *   get:
 *     operationId: getLinkReplacement
 *     tags: [Link Replacements]
 *     summary: Get one link replacement by id
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The link replacement.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 source_host: { type: string }
 *                 target_host: { type: string }
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
 * @openapi
 * /api/link-replacements:
 *   post:
 *     operationId: createLinkReplacement
 *     tags: [Link Replacements]
 *     summary: Create a link replacement
 *     description: Requires the admin role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [source_host, target_host]
 *             properties:
 *               source_host: { type: string, description: "Hostname to rewrite (no scheme, path, or port)." }
 *               target_host: { type: string, description: "Replacement hostname (no scheme, path, or port)." }
 *     responses:
 *       '201':
 *         description: Created link replacement.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 source_host: { type: string }
 *                 target_host: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '409':
 *         description: A replacement for this source_host already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { source_host, target_host } = req.body ?? {};
    if (!source_host || !target_host || typeof source_host !== "string" || typeof target_host !== "string") {
      return res.status(400).json({
        ok: false,
        error: "source_host and target_host (non-empty strings) are required",
      });
    }
    const validationError = validateLinkReplacementFields({
      source_host: source_host.trim(),
      target_host: target_host.trim(),
    });
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
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
 * @openapi
 * /api/link-replacements/{id}:
 *   put:
 *     operationId: updateLinkReplacement
 *     tags: [Link Replacements]
 *     summary: Update a link replacement
 *     description: Requires the admin role. At least one of source_host or target_host must be provided.
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
 *               source_host: { type: string, description: "Hostname to rewrite (no scheme, path, or port)." }
 *               target_host: { type: string, description: "Replacement hostname (no scheme, path, or port)." }
 *     responses:
 *       '200':
 *         description: Updated link replacement.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: integer }
 *                 source_host: { type: string }
 *                 target_host: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         description: A replacement for this source_host already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
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
    const validationError = validateLinkReplacementFields(updates);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
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
 * @openapi
 * /api/link-replacements/{id}:
 *   delete:
 *     operationId: deleteLinkReplacement
 *     tags: [Link Replacements]
 *     summary: Delete a link replacement
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
