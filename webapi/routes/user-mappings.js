import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  createUserMapping,
  deleteUserMapping,
  getUserMappingById,
  listUserMappings,
} from "../services/userMappings.js";
import { guildMemberExists, isGuildMemberLinked, setPrimaryAlias } from "../services/guildMembers.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";
import { recordAudit } from "../services/auditLog.js";

const router = express.Router();

/**
 * GET /api/user-mappings
 * List user mappings with pagination.
 * Query: ?app=discord&limit=&offset=&search=
 * Auth: required (admin or bot).
 * @openapi
 * /api/user-mappings:
 *   get:
 *     operationId: listUserMappings
 *     tags: [User Mappings]
 *     summary: List user mappings with pagination
 *     parameters:
 *       - name: app
 *         in: query
 *         required: true
 *         description: Chat app, validated but otherwise unused — chat_member_mapping is no longer app-scoped. Currently "discord" and "fluxer" are supported.
 *         schema: { type: string, enum: [discord, fluxer] }
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Max rows to return (default 50).
 *         schema: { type: integer, default: 50 }
 *       - name: offset
 *         in: query
 *         required: false
 *         description: Rows to skip (default 0).
 *         schema: { type: integer, default: 0 }
 *       - name: search
 *         in: query
 *         required: false
 *         description: Case-insensitive substring match against the mapping's default alias handle.
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Matching user mappings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 userMappings:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       handle: { type: string, nullable: true, description: "Resolved from this mapping's default alias (member_aliases.default_alias) -> guild_members.handle. Null if the mapping has no aliases yet." }
 *                       app: { type: string, nullable: true, description: "The default alias's app." }
 *                       defaultGuildMemberId: { type: integer, nullable: true }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : 0;
    const search = req.query.search;

    const { rows, total } = await listUserMappings({ limit, offset, search });
    res.json({ ok: true, userMappings: rows, total, limit, offset });
  } catch (err) {
    console.error("GET /api/user-mappings error:", err);
    res.status(500).json({ ok: false, error: "Failed to list user mappings" });
  }
});

/**
 * GET /api/user-mappings/:id
 * Get one user mapping by id.
 * Query: ?app=discord
 * Auth: required (admin or bot).
 * @openapi
 * /api/user-mappings/{id}:
 *   get:
 *     operationId: getUserMapping
 *     tags: [User Mappings]
 *     summary: Get one user mapping by id
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: app
 *         in: query
 *         required: true
 *         description: Chat app, validated but otherwise unused — chat_member_mapping is no longer app-scoped. Currently "discord" and "fluxer" are supported.
 *         schema: { type: string, enum: [discord, fluxer] }
 *     responses:
 *       '200':
 *         description: The user mapping.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 userMapping:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     handle: { type: string, nullable: true, description: "Resolved from this mapping's default alias (member_aliases.default_alias) -> guild_members.handle. Null if the mapping has no aliases yet." }
 *                     app: { type: string, nullable: true, description: "The default alias's app." }
 *                     defaultGuildMemberId: { type: integer, nullable: true }
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
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const row = await getUserMappingById(id);
    if (!row) {
      return res.status(404).json({ ok: false, error: "User mapping not found" });
    }
    res.json({ ok: true, userMapping: row });
  } catch (err) {
    console.error("GET /api/user-mappings/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get user mapping" });
  }
});

/**
 * POST /api/user-mappings
 * Create a user mapping by linking it to an unlinked guild_member in one atomic action — that
 * guild_member becomes the mapping's sole (and therefore default) alias.
 * Body: { guildMemberId }
 * Auth: admin required.
 * @openapi
 * /api/user-mappings:
 *   post:
 *     operationId: createUserMapping
 *     tags: [User Mappings]
 *     summary: Create a user mapping
 *     description: >
 *       Requires the admin role. Creates a new identity and immediately links it to the given
 *       guild_member (must not already be linked to any mapping).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guildMemberId]
 *             properties:
 *               guildMemberId: { type: integer }
 *     responses:
 *       '201':
 *         description: Created user mapping.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 userMapping:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     handle: { type: string, nullable: true }
 *                     app: { type: string, nullable: true }
 *                     defaultGuildMemberId: { type: integer, nullable: true }
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
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const guildMemberId = parseInt(req.body?.guildMemberId, 10);
    if (Number.isNaN(guildMemberId)) {
      return res.status(400).json({ ok: false, error: "guildMemberId is required" });
    }
    if (!(await guildMemberExists(guildMemberId))) {
      return res.status(404).json({ ok: false, error: "Guild member not found" });
    }
    if (await isGuildMemberLinked(guildMemberId)) {
      return res.status(400).json({ ok: false, error: "Guild member is already linked to a mapping" });
    }

    const id = await createUserMapping({ guildMemberId });
    const row = await getUserMappingById(id);
    await recordAudit(req.user.id, "create", "chat_member_mapping", id, { guildMemberId });
    res.status(201).json({ ok: true, userMapping: row });
  } catch (err) {
    console.error("POST /api/user-mappings error:", err);
    res.status(500).json({ ok: false, error: "Failed to create user mapping" });
  }
});

/**
 * POST /api/user-mappings/:id/primary-alias
 * Designate one of this mapping's already-linked guild_members aliases as its default alias
 * (member_aliases.default_alias), overriding the normal "newest alias wins" rule.
 * Body: { guildMemberId }
 * Auth: admin required.
 * @openapi
 * /api/user-mappings/{id}/primary-alias:
 *   post:
 *     operationId: setUserMappingPrimaryAlias
 *     tags: [User Mappings]
 *     summary: Set a user mapping's default alias
 *     description: >
 *       Requires the admin role. guildMemberId must already be linked to this mapping via
 *       member_aliases (link it first with POST /api/guild-members/{guildMemberId}/link).
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
 *             required: [guildMemberId]
 *             properties:
 *               guildMemberId: { type: integer }
 *     responses:
 *       '200':
 *         description: Updated user mapping.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 userMapping:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     handle: { type: string, nullable: true }
 *                     app: { type: string, nullable: true }
 *                     defaultGuildMemberId: { type: integer, nullable: true }
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
router.post("/:id/primary-alias", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const guildMemberId = parseInt(req.body?.guildMemberId, 10);
    if (Number.isNaN(guildMemberId)) {
      return res.status(400).json({ ok: false, error: "guildMemberId is required" });
    }

    const existing = await getUserMappingById(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "User mapping not found" });
    }

    const result = await setPrimaryAlias(id, guildMemberId);
    if (!result) {
      return res.status(404).json({ ok: false, error: "Guild member is not an alias of this mapping" });
    }

    const row = await getUserMappingById(id);
    await recordAudit(req.user.id, "set-primary", "chat_member_mapping", id, { guildMemberId });
    res.json({ ok: true, userMapping: row });
  } catch (err) {
    console.error("POST /api/user-mappings/:id/primary-alias error:", err);
    res.status(500).json({ ok: false, error: "Failed to set primary alias" });
  }
});

/**
 * DELETE /api/user-mappings/:id
 * Delete a user mapping.
 * Query: ?app=discord
 * Auth: admin required.
 * @openapi
 * /api/user-mappings/{id}:
 *   delete:
 *     operationId: deleteUserMapping
 *     tags: [User Mappings]
 *     summary: Delete a user mapping
 *     description: Requires the admin role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: app
 *         in: query
 *         required: true
 *         description: Chat app, validated but otherwise unused. Currently "discord" and "fluxer" are supported.
 *         schema: { type: string, enum: [discord, fluxer] }
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
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const existing = await getUserMappingById(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "User mapping not found" });
    }

    const deleted = await deleteUserMapping(id);
    if (!deleted) {
      return res.status(500).json({ ok: false, error: "Failed to delete user mapping" });
    }

    await recordAudit(req.user.id, "delete", "chat_member_mapping", id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/user-mappings/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete user mapping" });
  }
});

export default router;
