import express from "express";
import { authenticate, isAdminRole, requireBotOrAdmin, requireOwnGuildOrAdmin } from "../middleware/auth.js";
import { getChatMemberAppConfig } from "../services/chatMemberMapping.js";
import { deleteOrphanedImageFiles } from "../services/emojiFiles.js";
import {
  deleteRow,
  getByAppGuildName,
  getByAppId,
  getByInternalId,
  listByGuild,
  updateRow,
} from "../services/guildEmojis.js";
import { parseLimit } from "../services/leaderboards.js";
import { recordAudit } from "../services/auditLog.js";

const router = express.Router();

/**
 * Pull and validate the (app, id) pair shared by the bare-query-param routes.
 * @param {Record<string, unknown>} source req.query or req.body
 * @returns {{ ok: true, app: string, id: string } | { ok: false, error: string }}
 */
function parseAppIdKey(source) {
  const app = String(source?.app ?? "").trim();
  const id = String(source?.id ?? "").trim();
  if (!getChatMemberAppConfig(app)) return { ok: false, error: "Unsupported or missing app" };
  if (!id) return { ok: false, error: "id is required" };
  return { ok: true, app, id };
}

/**
 * Pull and validate the (app, guildId, name) triple shared by the /by-name routes.
 * @param {Record<string, unknown>} source req.query or req.body
 * @returns {{ ok: true, app: string, guildId: string, name: string } | { ok: false, error: string }}
 */
function parseByNameKey(source) {
  const app = String(source?.app ?? "").trim();
  const guildId = String(source?.guildId ?? "").trim();
  const name = String(source?.name ?? "").trim();
  if (!getChatMemberAppConfig(app)) return { ok: false, error: "Unsupported or missing app" };
  if (!guildId || !name) return { ok: false, error: "guildId and name are required" };
  return { ok: true, app, guildId, name };
}

/**
 * For routes with no `guildId` up front (`/:internalId`, bare `?app=&id=`): enforce the same
 * guild restriction `requireOwnGuildOrAdmin` would, now that the row (and its guildId) is known.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{ guildId: string|null }} row
 * @returns {boolean} true if allowed (caller should continue); false if a 403 was already sent
 */
function enforceOwnGuildOrAdmin(req, res, row) {
  if (isAdminRole(req.user?.role)) return true;
  if (req.user?.guild_id == null) return true;
  if (row.guildId !== req.user.guild_id) {
    res.status(403).json({ ok: false, error: "Forbidden: row does not belong to this service account's guild" });
    return false;
  }
  return true;
}

/**
 * Validate a PUT body's mutable fields (`name`, `imagePath`); at least one required.
 * @param {Record<string, unknown>} body
 * @returns {{ ok: true, fields: { name?: string, imagePath?: string|null } } | { ok: false, error: string }}
 */
function parseUpdateFields(body) {
  const fields = {};
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { ok: false, error: "name must be a non-empty string" };
    fields.name = name;
  }
  if (body?.imagePath !== undefined) {
    if (body.imagePath !== null && typeof body.imagePath !== "string") {
      return { ok: false, error: "imagePath must be a string or null" };
    }
    fields.imagePath = body.imagePath;
  }
  if (Object.keys(fields).length === 0) {
    return { ok: false, error: "At least one of name, imagePath is required" };
  }
  return { ok: true, fields };
}

/**
 * GET /api/guild-emojis/by-guild
 * List every guild_emojis row owned by one guild (emoji + sticker catalog).
 * Query: { app, guildId, type?, limit?, offset? }
 * Auth: bot or admin, restricted to its own guild.
 * @openapi
 * /api/guild-emojis/by-guild:
 *   get:
 *     operationId: listGuildEmojisByGuild
 *     tags: [Guild Emojis]
 *     summary: List a guild's emoji/sticker catalog rows
 *     parameters:
 *       - { name: app, in: query, required: true, schema: { type: string, example: discord } }
 *       - { name: guildId, in: query, required: true, schema: { type: string } }
 *       - { name: type, in: query, schema: { type: string, enum: [emoji, sticker] } }
 *       - { name: limit, in: query, schema: { type: integer, default: 50, maximum: 50 } }
 *       - { name: offset, in: query, schema: { type: integer, default: 0 } }
 *     responses:
 *       '200':
 *         description: Paginated catalog rows.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 guildEmojis:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/GuildEmoji' }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/by-guild", authenticate, requireBotOrAdmin, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const app = String(req.query.app ?? "").trim();
    const guildId = String(req.query.guildId ?? "").trim();
    const type = req.query.type;
    if (!getChatMemberAppConfig(app)) {
      return res.status(400).json({ ok: false, error: "Unsupported or missing app" });
    }
    if (!guildId) {
      return res.status(400).json({ ok: false, error: "guildId is required" });
    }
    if (type !== undefined && type !== "emoji" && type !== "sticker") {
      return res.status(400).json({ ok: false, error: "type must be emoji or sticker" });
    }
    const limit = parseLimit(req.query.limit, 50, 50);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const { rows, total } = await listByGuild(app, guildId, { type, limit, offset });
    res.json({ ok: true, guildEmojis: rows, total, limit, offset });
  } catch (err) {
    console.error("GET /api/guild-emojis/by-guild error:", err);
    res.status(500).json({ ok: false, error: "Failed to list guild emojis" });
  }
});

/**
 * GET /api/guild-emojis/by-name
 * Look up one catalog row by (app, guildId, name).
 * Query: { app, guildId, name }
 * Auth: bot or admin, restricted to its own guild.
 * @openapi
 * /api/guild-emojis/by-name:
 *   get:
 *     operationId: getGuildEmojiByName
 *     tags: [Guild Emojis]
 *     summary: Get a catalog row by (app, guildId, name)
 *     parameters:
 *       - { name: app, in: query, required: true, schema: { type: string, example: discord } }
 *       - { name: guildId, in: query, required: true, schema: { type: string } }
 *       - { name: name, in: query, required: true, schema: { type: string } }
 *     responses:
 *       '200':
 *         description: The row.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 guildEmoji: { $ref: '#/components/schemas/GuildEmoji' }
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
router.get("/by-name", authenticate, requireBotOrAdmin, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const key = parseByNameKey(req.query);
    if (!key.ok) return res.status(400).json({ ok: false, error: key.error });
    const row = await getByAppGuildName(key.app, key.guildId, key.name);
    if (!row) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    res.json({ ok: true, guildEmoji: row });
  } catch (err) {
    console.error("GET /api/guild-emojis/by-name error:", err);
    res.status(500).json({ ok: false, error: "Failed to get guild emoji" });
  }
});

/**
 * PUT /api/guild-emojis/by-name
 * Update name/imagePath of the row at (app, guildId, name).
 * Body: { app, guildId, name, name?, imagePath? }
 * Auth: bot or admin, restricted to its own guild.
 * @openapi
 * /api/guild-emojis/by-name:
 *   put:
 *     operationId: updateGuildEmojiByName
 *     tags: [Guild Emojis]
 *     summary: Update a catalog row looked up by (app, guildId, name)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, name]
 *             properties:
 *               app: { type: string, example: discord }
 *               guildId: { type: string }
 *               name: { type: string, description: "Current name, used to locate the row." }
 *               imagePath: { type: string, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { ok: { type: boolean, enum: [true] } } }
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
router.put("/by-name", authenticate, requireBotOrAdmin, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const key = parseByNameKey(req.body);
    if (!key.ok) return res.status(400).json({ ok: false, error: key.error });
    const parsed = parseUpdateFields(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

    const updated = await updateRow(
      "app = ? AND guild_id = ? AND name = ?",
      [key.app, key.guildId, key.name],
      parsed.fields,
    );
    if (!updated) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    await recordAudit(req.user.id, "update_guild_emoji", "guild_emojis", null, { ...key, ...parsed.fields });
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/guild-emojis/by-name error:", err);
    res.status(500).json({ ok: false, error: "Failed to update guild emoji" });
  }
});

/**
 * DELETE /api/guild-emojis/by-name
 * Hard-delete the row at (app, guildId, name), regardless of frequency.
 * Body: { app, guildId, name }
 * Auth: bot or admin, restricted to its own guild.
 * @openapi
 * /api/guild-emojis/by-name:
 *   delete:
 *     operationId: deleteGuildEmojiByName
 *     tags: [Guild Emojis]
 *     summary: Delete a catalog row looked up by (app, guildId, name)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, name]
 *             properties:
 *               app: { type: string, example: discord }
 *               guildId: { type: string }
 *               name: { type: string }
 *     responses:
 *       '200':
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { ok: { type: boolean, enum: [true] } } }
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
router.delete("/by-name", authenticate, requireBotOrAdmin, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const key = parseByNameKey(req.body);
    if (!key.ok) return res.status(400).json({ ok: false, error: key.error });
    const imagePath = await deleteRow("app = ? AND guild_id = ? AND name = ?", [key.app, key.guildId, key.name]);
    if (imagePath === undefined) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    if (imagePath) await deleteOrphanedImageFiles([imagePath]);
    await recordAudit(req.user.id, "delete_guild_emoji", "guild_emojis", null, key);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/guild-emojis/by-name error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete guild emoji" });
  }
});

/**
 * GET /api/guild-emojis
 * Look up one catalog row by (app, id).
 * Query: { app, id }
 * Auth: bot or admin; a guild-restricted service account is checked against the loaded row.
 * @openapi
 * /api/guild-emojis:
 *   get:
 *     operationId: getGuildEmojiByAppId
 *     tags: [Guild Emojis]
 *     summary: Get a catalog row by (app, id)
 *     parameters:
 *       - { name: app, in: query, required: true, schema: { type: string, example: discord } }
 *       - { name: id, in: query, required: true, schema: { type: string } }
 *     responses:
 *       '200':
 *         description: The row.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 guildEmoji: { $ref: '#/components/schemas/GuildEmoji' }
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
router.get("/", authenticate, requireBotOrAdmin, async (req, res) => {
  try {
    const key = parseAppIdKey(req.query);
    if (!key.ok) return res.status(400).json({ ok: false, error: key.error });
    const row = await getByAppId(key.app, key.id);
    if (!row) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    if (!enforceOwnGuildOrAdmin(req, res, row)) return;
    res.json({ ok: true, guildEmoji: row });
  } catch (err) {
    console.error("GET /api/guild-emojis error:", err);
    res.status(500).json({ ok: false, error: "Failed to get guild emoji" });
  }
});

/**
 * PUT /api/guild-emojis
 * Update name/imagePath of the row at (app, id).
 * Body: { app, id, name?, imagePath? }
 * Auth: bot or admin; a guild-restricted service account is checked against the loaded row.
 * @openapi
 * /api/guild-emojis:
 *   put:
 *     operationId: updateGuildEmojiByAppId
 *     tags: [Guild Emojis]
 *     summary: Update a catalog row looked up by (app, id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, id]
 *             properties:
 *               app: { type: string, example: discord }
 *               id: { type: string }
 *               name: { type: string }
 *               imagePath: { type: string, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { ok: { type: boolean, enum: [true] } } }
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
router.put("/", authenticate, requireBotOrAdmin, async (req, res) => {
  try {
    const key = parseAppIdKey(req.body);
    if (!key.ok) return res.status(400).json({ ok: false, error: key.error });
    const existing = await getByAppId(key.app, key.id);
    if (!existing) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    if (!enforceOwnGuildOrAdmin(req, res, existing)) return;

    const parsed = parseUpdateFields(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

    await updateRow("app = ? AND id = ?", [key.app, key.id], parsed.fields);
    await recordAudit(req.user.id, "update_guild_emoji", "guild_emojis", null, { ...key, ...parsed.fields });
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/guild-emojis error:", err);
    res.status(500).json({ ok: false, error: "Failed to update guild emoji" });
  }
});

/**
 * DELETE /api/guild-emojis
 * Hard-delete the row at (app, id), regardless of frequency.
 * Body: { app, id }
 * Auth: bot or admin; a guild-restricted service account is checked against the loaded row.
 * @openapi
 * /api/guild-emojis:
 *   delete:
 *     operationId: deleteGuildEmojiByAppId
 *     tags: [Guild Emojis]
 *     summary: Delete a catalog row looked up by (app, id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, id]
 *             properties:
 *               app: { type: string, example: discord }
 *               id: { type: string }
 *     responses:
 *       '200':
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { ok: { type: boolean, enum: [true] } } }
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
router.delete("/", authenticate, requireBotOrAdmin, async (req, res) => {
  try {
    const key = parseAppIdKey(req.body);
    if (!key.ok) return res.status(400).json({ ok: false, error: key.error });
    const existing = await getByAppId(key.app, key.id);
    if (!existing) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    if (!enforceOwnGuildOrAdmin(req, res, existing)) return;

    const imagePath = await deleteRow("app = ? AND id = ?", [key.app, key.id]);
    if (imagePath) await deleteOrphanedImageFiles([imagePath]);
    await recordAudit(req.user.id, "delete_guild_emoji", "guild_emojis", null, key);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/guild-emojis error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete guild emoji" });
  }
});

/**
 * GET /api/guild-emojis/:internalId
 * Look up one catalog row by its surrogate internal_id.
 * Auth: bot or admin; a guild-restricted service account is checked against the loaded row.
 * @openapi
 * /api/guild-emojis/{internalId}:
 *   get:
 *     operationId: getGuildEmojiByInternalId
 *     tags: [Guild Emojis]
 *     summary: Get a catalog row by internal id
 *     parameters:
 *       - { name: internalId, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       '200':
 *         description: The row.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 guildEmoji: { $ref: '#/components/schemas/GuildEmoji' }
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
router.get("/:internalId", authenticate, requireBotOrAdmin, async (req, res) => {
  try {
    const internalId = parseInt(req.params.internalId, 10);
    if (Number.isNaN(internalId)) return res.status(400).json({ ok: false, error: "Invalid internalId" });
    const row = await getByInternalId(internalId);
    if (!row) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    if (!enforceOwnGuildOrAdmin(req, res, row)) return;
    res.json({ ok: true, guildEmoji: row });
  } catch (err) {
    console.error("GET /api/guild-emojis/:internalId error:", err);
    res.status(500).json({ ok: false, error: "Failed to get guild emoji" });
  }
});

/**
 * PUT /api/guild-emojis/:internalId
 * Update name/imagePath of the row at this internal_id.
 * Body: { name?, imagePath? }
 * Auth: bot or admin; a guild-restricted service account is checked against the loaded row.
 * @openapi
 * /api/guild-emojis/{internalId}:
 *   put:
 *     operationId: updateGuildEmojiByInternalId
 *     tags: [Guild Emojis]
 *     summary: Update a catalog row by internal id
 *     parameters:
 *       - { name: internalId, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               imagePath: { type: string, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { ok: { type: boolean, enum: [true] } } }
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
router.put("/:internalId", authenticate, requireBotOrAdmin, async (req, res) => {
  try {
    const internalId = parseInt(req.params.internalId, 10);
    if (Number.isNaN(internalId)) return res.status(400).json({ ok: false, error: "Invalid internalId" });
    const existing = await getByInternalId(internalId);
    if (!existing) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    if (!enforceOwnGuildOrAdmin(req, res, existing)) return;

    const parsed = parseUpdateFields(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

    await updateRow("internal_id = ?", [internalId], parsed.fields);
    await recordAudit(req.user.id, "update_guild_emoji", "guild_emojis", internalId, parsed.fields);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/guild-emojis/:internalId error:", err);
    res.status(500).json({ ok: false, error: "Failed to update guild emoji" });
  }
});

/**
 * DELETE /api/guild-emojis/:internalId
 * Hard-delete the row at this internal_id, regardless of frequency.
 * Auth: bot or admin; a guild-restricted service account is checked against the loaded row.
 * @openapi
 * /api/guild-emojis/{internalId}:
 *   delete:
 *     operationId: deleteGuildEmojiByInternalId
 *     tags: [Guild Emojis]
 *     summary: Delete a catalog row by internal id
 *     parameters:
 *       - { name: internalId, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       '200':
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { ok: { type: boolean, enum: [true] } } }
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
router.delete("/:internalId", authenticate, requireBotOrAdmin, async (req, res) => {
  try {
    const internalId = parseInt(req.params.internalId, 10);
    if (Number.isNaN(internalId)) return res.status(400).json({ ok: false, error: "Invalid internalId" });
    const existing = await getByInternalId(internalId);
    if (!existing) return res.status(404).json({ ok: false, error: "Guild emoji not found" });
    if (!enforceOwnGuildOrAdmin(req, res, existing)) return;

    const imagePath = await deleteRow("internal_id = ?", [internalId]);
    if (imagePath) await deleteOrphanedImageFiles([imagePath]);
    await recordAudit(req.user.id, "delete_guild_emoji", "guild_emojis", internalId, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/guild-emojis/:internalId error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete guild emoji" });
  }
});

export default router;
