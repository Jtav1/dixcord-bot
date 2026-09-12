import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  listGuildMembers,
  listServersForUser,
  upsertGuildMembers,
} from "../services/guildMembers.js";

const router = express.Router();

/**
 * POST /api/guild-members/sync
 * Full-replace sync of one server's membership list.
 * Body: { app, guildId, members: [{ platformUserId, nickname?, roles?, joinedAt? }] }
 * Auth: required.
 * @openapi
 * /api/guild-members/sync:
 *   post:
 *     operationId: syncGuildMembers
 *     tags: [Guild Members]
 *     summary: Push a full server membership list
 *     description: >
 *       Full-replace: deletes and reinserts every guild_members row for this (app, guildId).
 *       Entries whose platformUserId isn't yet known to chat_member_mapping are skipped
 *       (best-effort) rather than failing the whole sync.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, members]
 *             properties:
 *               app: { type: string, example: discord }
 *               guildId: { type: string }
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [platformUserId]
 *                   properties:
 *                     platformUserId: { type: string }
 *                     nickname: { type: string, nullable: true }
 *                     roles: { type: array, items: { type: string }, description: "guild_roles.id values held in this server." }
 *                     joinedAt: { type: string, format: date-time, nullable: true }
 *     responses:
 *       '200':
 *         description: Sync result.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 imported: { type: integer }
 *                 skipped: { type: integer, description: "Entries skipped because platformUserId wasn't found in chat_member_mapping." }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/sync", authenticate, async (req, res) => {
  try {
    const { app, guildId, members } = req.body ?? {};
    const gid = String(guildId ?? "").trim();
    if (!gid) return res.status(400).json({ ok: false, error: "guildId is required" });
    const result = await upsertGuildMembers(app, gid, members);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    res.json({ ok: true, imported: result.imported, skipped: result.skipped });
  } catch (err) {
    console.error("POST /api/guild-members/sync error:", err);
    res.status(500).json({ ok: false, error: "Failed to sync guild members" });
  }
});

/**
 * GET /api/guild-members/user/:chatMemberMappingId
 * Every server this internal user id belongs to.
 * Auth: required.
 * @openapi
 * /api/guild-members/user/{chatMemberMappingId}:
 *   get:
 *     operationId: listServersForUser
 *     tags: [Guild Members]
 *     summary: List every server a given internal user id belongs to
 *     description: >
 *       Reverse lookup for chat_member_mapping.id, joined with guild_info for display name.
 *       This is the primitive a cross-server feature (e.g. delivering a reminder to every
 *       server a user is in) would use; registered before any bare /{id} route so this
 *       literal "user" segment isn't shadowed.
 *     parameters:
 *       - name: chatMemberMappingId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Servers this user belongs to.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 servers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       app: { type: string }
 *                       guildId: { type: string }
 *                       guildName: { type: string, nullable: true }
 *                       nickname: { type: string, nullable: true }
 *                       roles: { type: array, items: { type: string } }
 *                       joinedAt: { type: string, nullable: true }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/user/:chatMemberMappingId", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.chatMemberMappingId, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid chatMemberMappingId" });
    }
    const servers = await listServersForUser(id);
    res.json({ ok: true, servers });
  } catch (err) {
    console.error("GET /api/guild-members/user/:chatMemberMappingId error:", err);
    res.status(500).json({ ok: false, error: "Failed to list servers for user" });
  }
});

/**
 * GET /api/guild-members?app=&guildId=
 * List one server's members.
 * Auth: required.
 * @openapi
 * /api/guild-members:
 *   get:
 *     operationId: listGuildMembers
 *     tags: [Guild Members]
 *     summary: List one server's members
 *     parameters:
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, example: discord }
 *       - name: guildId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Members of this server.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, description: chat_member_mapping.id }
 *                       name: { type: string }
 *                       handle: { type: string }
 *                       platformUserId: { type: string }
 *                       nickname: { type: string, nullable: true }
 *                       roles: { type: array, items: { type: string } }
 *                       joinedAt: { type: string, nullable: true }
 *                       syncedAt: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const { app, guildId } = req.query;
    const gid = String(guildId ?? "").trim();
    if (!gid) return res.status(400).json({ ok: false, error: "guildId is required" });
    const members = await listGuildMembers(app, gid);
    if (members == null) {
      return res.status(400).json({ ok: false, error: "Unsupported or missing app" });
    }
    res.json({ ok: true, members });
  } catch (err) {
    console.error("GET /api/guild-members error:", err);
    res.status(500).json({ ok: false, error: "Failed to list guild members" });
  }
});

export default router;
