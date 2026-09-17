import express from "express";
import { authenticate, requireAdmin, requireOwnGuildOrAdmin } from "../middleware/auth.js";
import {
  guildMemberExists,
  linkGuildMemberAlias,
  listAliasesForMapping,
  listAllGuildMembers,
  listAllGuildMemberRows,
  listGuildMembers,
  listServersForUser,
  listUnlinkedGuildMembers,
  unlinkGuildMemberAlias,
  upsertGuildMembers,
} from "../services/guildMembers.js";
import { getUserMappingById } from "../services/userMappings.js";
import { recordAudit } from "../services/auditLog.js";

const router = express.Router();

/**
 * POST /api/guild-members/sync
 * Upsert one server's membership list.
 * Body: { app, guildId, members: [{ platformUserId, handle?, nickname?, roles?, joinedAt? }] }
 * Auth: required. A guild-scoped bot account may only sync its own guildId.
 * @openapi
 * /api/guild-members/sync:
 *   post:
 *     operationId: syncGuildMembers
 *     tags: [Guild Members]
 *     summary: Upsert a server's membership list
 *     description: >
 *       Upserts each member keyed on (app, guildId, platformUserId), safe to call with either
 *       a full periodic roster push or a single incremental member (e.g. a join event) — never
 *       deletes, so a member who has left the guild keeps their row as a historical record.
 *       Never creates or links chat_member_mapping/member_aliases rows — identity linking is a
 *       separate, manual, future admin action. A guild-scoped bot account (users.guild_id set)
 *       may only sync its own guildId; admin and unrestricted (guild_id null) accounts may sync
 *       any guildId.
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
 *                     handle: { type: string, nullable: true, description: "Discord username." }
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
 *                 imported: { type: integer, description: "Every row upserted." }
 *                 skipped: { type: integer, description: "Entries dropped because they had no platformUserId at all (malformed input)." }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/sync", authenticate, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const { app, guildId, members } = req.body ?? {};
    const gid = String(guildId ?? "").trim();
    if (!gid) return res.status(400).json({ ok: false, error: "guildId is required" });
    const result = await upsertGuildMembers(app, gid, members);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    res.json({
      ok: true,
      imported: result.imported,
      skipped: result.skipped,
    });
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
 *                       roles: { type: array, items: { $ref: '#/components/schemas/GuildRole' } }
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
 * GET /api/guild-members/unlinked?app=&guildId=
 * List guild_members rows with no resolved identity link (no member_aliases row) yet.
 * Auth: admin required.
 * @openapi
 * /api/guild-members/unlinked:
 *   get:
 *     operationId: listUnlinkedGuildMembers
 *     tags: [Guild Members]
 *     summary: List membership rows with no resolved identity link
 *     description: >
 *       Admin manual-link workflow: these rows were synced but have no member_aliases row
 *       linking them to a chat_member_mapping identity. Read-only; linking/merging is a
 *       future capability.
 *     parameters:
 *       - name: app
 *         in: query
 *         required: false
 *         schema: { type: string, example: discord }
 *       - name: guildId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: search
 *         in: query
 *         required: false
 *         description: Case-insensitive substring match against handle or nickname.
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Unlinked membership rows.
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
 *                       id: { type: integer, description: "guild_members.id — pass this to POST /api/guild-members/:guildMemberId/link." }
 *                       app: { type: string }
 *                       guildId: { type: string }
 *                       platformUserId: { type: string }
 *                       handle: { type: string, nullable: true }
 *                       nickname: { type: string, nullable: true }
 *                       roles: { type: array, items: { $ref: '#/components/schemas/GuildRole' } }
 *                       joinedAt: { type: string, nullable: true }
 *                       syncedAt: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/unlinked", authenticate, requireAdmin, async (req, res) => {
  try {
    const { app, guildId, search } = req.query;
    const members = await listUnlinkedGuildMembers({
      app: typeof app === "string" ? app : undefined,
      guildId: typeof guildId === "string" ? guildId : undefined,
      search: typeof search === "string" ? search : undefined,
    });
    res.json({ ok: true, members });
  } catch (err) {
    console.error("GET /api/guild-members/unlinked error:", err);
    res.status(500).json({ ok: false, error: "Failed to list unlinked guild members" });
  }
});

/**
 * GET /api/guild-members/all?app=&guildId=&search=
 * List every guild_members row (linked or not) for the admin manual-link picker.
 * Auth: admin required.
 * @openapi
 * /api/guild-members/all:
 *   get:
 *     operationId: listAllGuildMemberRows
 *     tags: [Guild Members]
 *     summary: List every guild_members row, linked or not, for the manual-link picker
 *     description: >
 *       Unlike GET /api/guild-members/unlinked, this includes rows already linked to an
 *       identity (with that identity's id/name), so an admin can see and deliberately move
 *       one to a different chat_member_mapping — linking again just moves it, since
 *       member_aliases.guild_member_id is unique.
 *     parameters:
 *       - name: app
 *         in: query
 *         required: false
 *         schema: { type: string, example: discord }
 *       - name: guildId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: search
 *         in: query
 *         required: false
 *         description: Case-insensitive substring match against handle or nickname.
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Every matching guild_members row.
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
 *                       id: { type: integer, description: "guild_members.id — pass this to POST /api/guild-members/:guildMemberId/link." }
 *                       app: { type: string }
 *                       guildId: { type: string }
 *                       platformUserId: { type: string }
 *                       handle: { type: string, nullable: true }
 *                       nickname: { type: string, nullable: true }
 *                       roles: { type: array, items: { $ref: '#/components/schemas/GuildRole' } }
 *                       joinedAt: { type: string, nullable: true }
 *                       syncedAt: { type: string }
 *                       linkedMappingId: { type: integer, nullable: true, description: chat_member_mapping.id this row is currently linked to, or null if unlinked. }
 *                       linkedMappingName: { type: string, nullable: true }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const { app, guildId, search } = req.query;
    const members = await listAllGuildMemberRows({
      app: typeof app === "string" ? app : undefined,
      guildId: typeof guildId === "string" ? guildId : undefined,
      search: typeof search === "string" ? search : undefined,
    });
    res.json({ ok: true, members });
  } catch (err) {
    console.error("GET /api/guild-members/all error:", err);
    res.status(500).json({ ok: false, error: "Failed to list guild members" });
  }
});

/**
 * GET /api/guild-members/aliases/:chatMemberMappingId
 * List guild_members rows currently linked (member_aliases) to this identity.
 * Auth: admin required.
 * @openapi
 * /api/guild-members/aliases/{chatMemberMappingId}:
 *   get:
 *     operationId: listAliasesForMapping
 *     tags: [Guild Members]
 *     summary: List guild_members aliases linked to a chat_member_mapping identity
 *     parameters:
 *       - name: chatMemberMappingId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Linked membership rows.
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
 *                       id: { type: integer, description: guild_members.id }
 *                       app: { type: string }
 *                       guildId: { type: string }
 *                       guildName: { type: string, nullable: true }
 *                       platformUserId: { type: string }
 *                       handle: { type: string, nullable: true }
 *                       nickname: { type: string, nullable: true }
 *                       roles: { type: array, items: { $ref: '#/components/schemas/GuildRole' } }
 *                       joinedAt: { type: string, nullable: true }
 *                       syncedAt: { type: string }
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
router.get("/aliases/:chatMemberMappingId", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.chatMemberMappingId, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid chatMemberMappingId" });
    }
    const mapping = await getUserMappingById(id);
    if (!mapping) {
      return res.status(404).json({ ok: false, error: "User mapping not found" });
    }
    const members = await listAliasesForMapping(id);
    res.json({ ok: true, members });
  } catch (err) {
    console.error("GET /api/guild-members/aliases/:chatMemberMappingId error:", err);
    res.status(500).json({ ok: false, error: "Failed to list aliases" });
  }
});

/**
 * GET /api/guild-members/public-aliases/:chatMemberMappingId
 * Public-safe version of GET /api/guild-members/aliases/:chatMemberMappingId — no ids, no
 * platform snowflakes, just per-guild handle/nickname. Backs webview's public identity chip.
 * Auth: required (webview-allowed).
 * @openapi
 * /api/guild-members/public-aliases/{chatMemberMappingId}:
 *   get:
 *     operationId: listPublicAliasesForMapping
 *     tags: [Guild Members]
 *     summary: List one identity's per-guild handle/nickname (public-safe)
 *     description: >
 *       Same underlying data as GET /api/guild-members/aliases/{chatMemberMappingId}, trimmed to
 *       fields safe to show on the public webview site — no internal ids, no platform user id.
 *     parameters:
 *       - name: chatMemberMappingId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Linked membership rows, public-safe fields only.
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
 *                       app: { type: string }
 *                       guildId: { type: string }
 *                       guildName: { type: string, nullable: true }
 *                       handle: { type: string, nullable: true }
 *                       nickname: { type: string, nullable: true }
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
router.get("/public-aliases/:chatMemberMappingId", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.chatMemberMappingId, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid chatMemberMappingId" });
    }
    const mapping = await getUserMappingById(id);
    if (!mapping) {
      return res.status(404).json({ ok: false, error: "User mapping not found" });
    }
    const members = (await listAliasesForMapping(id)).map((m) => ({
      app: m.app,
      guildId: m.guildId,
      guildName: m.guildName,
      handle: m.handle,
      nickname: m.nickname,
    }));
    res.json({ ok: true, members });
  } catch (err) {
    console.error("GET /api/guild-members/public-aliases/:chatMemberMappingId error:", err);
    res.status(500).json({ ok: false, error: "Failed to list aliases" });
  }
});

/**
 * POST /api/guild-members/:guildMemberId/link
 * Link a guild_members row to a chat_member_mapping identity as one of its aliases
 * (re-linking moves it, since a guild_member can only alias one identity at a time).
 * Body: { chatMemberMappingId }
 * Auth: admin required.
 * @openapi
 * /api/guild-members/{guildMemberId}/link:
 *   post:
 *     operationId: linkGuildMemberAlias
 *     tags: [Guild Members]
 *     summary: Link a guild_members row to a chat_member_mapping identity
 *     description: >
 *       Creates (or moves, if already linked elsewhere) the member_aliases row for this
 *       guild_member — a guild_member can only be an alias of one identity at a time.
 *     parameters:
 *       - name: guildMemberId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [chatMemberMappingId]
 *             properties:
 *               chatMemberMappingId: { type: integer }
 *     responses:
 *       '200':
 *         description: Linked.
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
router.post("/:guildMemberId/link", authenticate, requireAdmin, async (req, res) => {
  try {
    const guildMemberId = parseInt(req.params.guildMemberId, 10);
    if (Number.isNaN(guildMemberId)) {
      return res.status(400).json({ ok: false, error: "Invalid guildMemberId" });
    }
    const chatMemberMappingId = parseInt(req.body?.chatMemberMappingId, 10);
    if (Number.isNaN(chatMemberMappingId)) {
      return res.status(400).json({ ok: false, error: "chatMemberMappingId is required" });
    }

    if (!(await guildMemberExists(guildMemberId))) {
      return res.status(404).json({ ok: false, error: "Guild member not found" });
    }
    if (!(await getUserMappingById(chatMemberMappingId))) {
      return res.status(404).json({ ok: false, error: "User mapping not found" });
    }

    await linkGuildMemberAlias(guildMemberId, chatMemberMappingId);
    await recordAudit(req.user.id, "link", "member_aliases", guildMemberId, { chatMemberMappingId });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/guild-members/:guildMemberId/link error:", err);
    res.status(500).json({ ok: false, error: "Failed to link guild member" });
  }
});

/**
 * DELETE /api/guild-members/:guildMemberId/link
 * Unlink a guild_members row from whichever identity it's aliased to.
 * Auth: admin required.
 * @openapi
 * /api/guild-members/{guildMemberId}/link:
 *   delete:
 *     operationId: unlinkGuildMemberAlias
 *     tags: [Guild Members]
 *     summary: Unlink a guild_members row from its chat_member_mapping identity
 *     parameters:
 *       - name: guildMemberId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Unlinked.
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
router.delete("/:guildMemberId/link", authenticate, requireAdmin, async (req, res) => {
  try {
    const guildMemberId = parseInt(req.params.guildMemberId, 10);
    if (Number.isNaN(guildMemberId)) {
      return res.status(400).json({ ok: false, error: "Invalid guildMemberId" });
    }

    const unlinked = await unlinkGuildMemberAlias(guildMemberId);
    if (!unlinked) {
      return res.status(404).json({ ok: false, error: "No alias link found for this guild member" });
    }

    await recordAudit(req.user.id, "unlink", "member_aliases", guildMemberId, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/guild-members/:guildMemberId/link error:", err);
    res.status(500).json({ ok: false, error: "Failed to unlink guild member" });
  }
});

/**
 * GET /api/guild-members?app=&guildId=
 * List one server's members, or (when guildId is omitted) every member across all guilds
 * for that app, deduplicated by platformUserId.
 * Auth: required. A guild-scoped bot account may only list its own guildId.
 * @openapi
 * /api/guild-members:
 *   get:
 *     operationId: listGuildMembers
 *     tags: [Guild Members]
 *     summary: List one server's members, or every server's deduplicated by platformUserId
 *     parameters:
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, example: discord }
 *       - name: guildId
 *         in: query
 *         required: false
 *         description: When omitted, returns every member across all guilds for this app, deduplicated by platformUserId (most-recently-synced alias wins).
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
 *                       id: { type: integer, nullable: true, description: chat_member_mapping.id, or null if unlinked }
 *                       name: { type: string, nullable: true }
 *                       handle: { type: string, nullable: true }
 *                       platformUserId: { type: string }
 *                       nickname: { type: string, nullable: true }
 *                       roles: { type: array, items: { $ref: '#/components/schemas/GuildRole' } }
 *                       joinedAt: { type: string, nullable: true }
 *                       syncedAt: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const { app, guildId } = req.query;
    const gid = String(guildId ?? "").trim();
    const members = gid ? await listGuildMembers(app, gid) : await listAllGuildMembers(app);
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
