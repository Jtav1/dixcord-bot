import express from "express";
import {
  authenticate,
  isAdminRole,
  isBotOrAdminRole,
  isBotRole,
} from "../middleware/auth.js";
import {
  getScheduledMessageById,
  createScheduledMessage,
  deletePendingScheduledMessageByIdForUser,
  deleteScheduledMessageByIdAdmin,
  getPendingScheduledMessagesForBot,
  getScheduledMessagesForAdmin,
  getUpcomingScheduledMessagesByUserId,
  normalizeUtcIsoString,
  updateScheduledMessageById,
} from "../services/scheduledMessages.js";
import { requireChatMemberMappingId } from "../services/chatMemberMapping.js";
import { parseReminderText } from "../services/reminderParsing.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";

const router = express.Router();

/**
 * Resolve requester platform user id to chat_member_mapping.id.
 * @param {import("express").Request} req
 * @returns {Promise<{ ok: true, app: string, userId: number } | { ok: false, status: number, error: string }>}
 */
async function resolveRequesterMapping(req) {
  const app = resolveChatAppFromRequest(req);
  if (!app)
    return { ok: false, status: 400, error: CHAT_APP_PARAM_ERROR.error };
  const requesterPlatformUserId =
    req.body?.requesterUserId ?? req.query?.requesterUserId;
  const requester = await requireChatMemberMappingId(
    requesterPlatformUserId,
    app,
  );
  if (!requester.ok) return { ok: false, status: 400, error: requester.error };
  return { ok: true, app, userId: requester.id };
}

/**
 * Reject callers that cannot use requester-scoped scheduled-message routes.
 * No end users call the API directly; the bot acts on their behalf via requesterUserId.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {boolean} True when the response was sent (caller denied).
 */
function denyUnlessBotOrAdmin(req, res) {
  if (!isBotOrAdminRole(req.user?.role)) {
    res
      .status(403)
      .json({ ok: false, error: "Bot or admin access required" });
    return true;
  }
  return false;
}

/**
 * POST /api/scheduled-messages/parse-reminder
 * Parse "remind me" style reminder text (already stripped of any platform mention syntax)
 * into a scheduled time + message body.
 * Body: { text: string, isReply?: boolean }
 * Auth: required (bot or admin).
 * @openapi
 * /api/scheduled-messages/parse-reminder:
 *   post:
 *     operationId: parseReminderText
 *     tags: [Scheduled Messages]
 *     summary: Parse reminder text into a scheduled time + message body
 *     description: >
 *       Client-agnostic NLP parsing (chrono-node) of two accepted formats: "[at/in] <time>
 *       remind me <message>" or "remind me [at/in <time>] <message>". Callers strip their
 *       platform's mention syntax (e.g. Discord's `<@id>`) before calling this. When `isReply`
 *       is true and the text has no explicit time keyword after "remind me" (e.g. just "remind
 *       me tomorrow" as a reply to another message), the whole remainder is parsed as a time
 *       phrase and `usesReplyContext` is returned true with `messageContent: null` — the caller
 *       is expected to build the reminder body itself (e.g. a mention of the requester plus a
 *       link to the message replied to).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string, description: "Reminder text with any bot mention already stripped." }
 *               isReply: { type: boolean, default: false, description: "Whether the source message was a reply to another message." }
 *     responses:
 *       '200':
 *         description: Parsed reminder.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 scheduledAt: { type: string, format: date-time }
 *                 messageContent:
 *                   type: string
 *                   nullable: true
 *                   description: Null when usesReplyContext is true.
 *                 usesReplyContext: { type: boolean }
 *       '400':
 *         description: Missing `text`, or the text didn't match a recognized reminder format.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenBotOrAdmin'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/parse-reminder", authenticate, async (req, res) => {
  try {
    if (denyUnlessBotOrAdmin(req, res)) return;

    const result = parseReminderText({
      text: req.body?.text,
      isReply: req.body?.isReply,
    });
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    return res.json({
      ok: true,
      scheduledAt: result.scheduledAt,
      messageContent: result.messageContent,
      usesReplyContext: result.usesReplyContext,
    });
  } catch (err) {
    console.error("POST /api/scheduled-messages/parse-reminder error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to parse reminder text" });
  }
});

/**
 * GET /api/scheduled-messages
 * List upcoming scheduled messages for requester, or bot scope list of all pending rows.
 * Query:
 * - requester scope: ?app=<chatApp>&requesterUserId=... (bot or admin; bot on behalf of user)
 * - bot scope:  ?scope=bot
 * - admin scope: ?scope=admin&status=pending|sent|all
 * Auth: required.
 * @openapi
 * /api/scheduled-messages:
 *   get:
 *     operationId: listScheduledMessages
 *     tags: [Scheduled Messages]
 *     summary: List scheduled messages (requester, bot, or admin scope)
 *     description: >
 *       Behavior depends on `scope`:
 *         - Omitted (default, "requester scope"): resolves `requesterUserId` to a
 *           chat_member_mapping row and returns that single user's upcoming
 *           pending scheduled messages. Requires the bot or admin role (checked
 *           in-handler); callers other than the bot act on a user's behalf via
 *           `requesterUserId`.
 *         - `scope=bot`: returns every pending scheduled message for the app
 *           (all users), for the bot's own scheduler loop. Requires the bot
 *           role (checked in-handler); `requesterUserId` is ignored.
 *         - `scope=admin`: returns a paginated, `status`-filterable list across
 *           all users for the admin panel. Requires the admin role (checked
 *           in-handler); `requesterUserId` is ignored.
 *     parameters:
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *         description: Chat app key. Currently only "discord" is supported.
 *       - name: scope
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [bot, admin] }
 *         description: Selects bot or admin scope. Omit for requester scope.
 *       - name: requesterUserId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *         description: >
 *           Platform user id (e.g. Discord snowflake) to resolve to a
 *           chat_member_mapping row. Required (and only used) in requester
 *           scope (i.e. when `scope` is omitted).
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [pending, sent, all], default: all }
 *         description: Only used when `scope=admin`.
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 50 }
 *         description: Only used when `scope=admin`. Clamped server-side to 1-200.
 *       - name: offset
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 0 }
 *         description: Only used when `scope=admin`.
 *     responses:
 *       '200':
 *         description: >
 *           Scheduled messages for the resolved scope. `total`, `limit`, and
 *           `offset` are only present for `scope=admin`.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 scheduledMessages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       user_id: { type: integer }
 *                       app: { type: string, enum: [discord] }
 *                       chat_channel_id: { type: string }
 *                       chat_guild_id: { type: string, nullable: true }
 *                       message_body: { type: string }
 *                       scheduled_at: { type: string, format: date-time, nullable: true }
 *                       status: { type: string, enum: [pending, sent] }
 *                       sent_at: { type: string, format: date-time, nullable: true }
 *                       created_at: { type: string, format: date-time, nullable: true }
 *                 total: { type: integer, description: "scope=admin only." }
 *                 limit: { type: integer, description: "scope=admin only." }
 *                 offset: { type: integer, description: "scope=admin only." }
 *       '400':
 *         description: >
 *           Missing/invalid `app`, an invalid `status` value (scope=admin), or
 *           an unresolvable `requesterUserId` (requester scope).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         description: >
 *           Role check failed for the requested scope: bot role required for
 *           `scope=bot`, admin role required for `scope=admin`, or bot/admin
 *           role required for requester scope. All checks are enforced
 *           in-handler (not via `requireAdmin`/`requireBotOrAdmin` middleware).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    if (req.query?.scope === "bot") {
      if (!isBotRole(req.user?.role)) {
        return res.status(403).json({ ok: false, error: "Bot access required" });
      }
      const rows = await getPendingScheduledMessagesForBot(app);
      return res.json({ ok: true, scheduledMessages: rows });
    }

    if (req.query?.scope === "admin") {
      if (!isAdminRole(req.user?.role)) {
        return res.status(403).json({ ok: false, error: "Admin access required" });
      }
      const status = req.query.status ?? "all";
      if (!["pending", "sent", "all"].includes(String(status))) {
        return res.status(400).json({
          ok: false,
          error: 'status must be "pending", "sent", or "all"',
        });
      }
      const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 50;
      const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : 0;
      const { rows, total } = await getScheduledMessagesForAdmin(app, status, {
        limit,
        offset,
      });
      return res.json({ ok: true, scheduledMessages: rows, total, limit, offset });
    }

    if (denyUnlessBotOrAdmin(req, res)) return;

    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }
    const rows = await getUpcomingScheduledMessagesByUserId(
      requester.app,
      requester.userId,
    );
    return res.json({ ok: true, scheduledMessages: rows });
  } catch (err) {
    console.error("GET /api/scheduled-messages error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to list scheduled messages" });
  }
});

/**
 * GET /api/scheduled-messages/:id
 * Get a scheduled message by id; requester must own row.
 * Query: ?app=<chatApp>&requesterUserId=...
 * Auth: required (bot or admin; bot supplies requesterUserId on behalf of user).
 * @openapi
 * /api/scheduled-messages/{id}:
 *   get:
 *     operationId: getScheduledMessage
 *     tags: [Scheduled Messages]
 *     summary: Get one scheduled message by id
 *     description: >
 *       Requires the bot or admin role (checked in-handler via the same
 *       requester-resolution helper as the list/create/update/delete routes).
 *       The resolved requester must own the row.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *         description: Chat app key. Currently only "discord" is supported.
 *       - name: requesterUserId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *         description: Platform user id (e.g. Discord snowflake) resolved to a chat_member_mapping row.
 *     responses:
 *       '200':
 *         description: The scheduled message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 scheduledMessage:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     user_id: { type: integer }
 *                     app: { type: string, enum: [discord] }
 *                     chat_channel_id: { type: string }
 *                     chat_guild_id: { type: string, nullable: true }
 *                     message_body: { type: string }
 *                     scheduled_at: { type: string, format: date-time, nullable: true }
 *                     status: { type: string, enum: [pending, sent] }
 *                     sent_at: { type: string, format: date-time, nullable: true }
 *                     created_at: { type: string, format: date-time, nullable: true }
 *       '400':
 *         description: Invalid `id`, missing/invalid `app`, or an unresolvable `requesterUserId`.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         description: >
 *           Either the caller is not bot/admin, or the resolved requester does
 *           not own this scheduled message. Both checks are enforced in-handler.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id))
      return res.status(400).json({ ok: false, error: "Invalid id" });

    if (denyUnlessBotOrAdmin(req, res)) return;

    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }

    const row = await getScheduledMessageById(requester.app, id);
    if (!row)
      return res
        .status(404)
        .json({ ok: false, error: "Scheduled message not found" });
    if (row.user_id !== requester.userId) {
      return res
        .status(403)
        .json({ ok: false, error: "Forbidden: not your scheduled message" });
    }
    return res.json({ ok: true, scheduledMessage: row });
  } catch (err) {
    console.error("GET /api/scheduled-messages/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to get scheduled message" });
  }
});

/**
 * POST /api/scheduled-messages
 * Create a scheduled message.
 * Body: { app, requesterUserId, chat_channel_id, chat_guild_id?, message_body, scheduled_at }
 * Auth: required (bot or admin; bot supplies requesterUserId on behalf of user).
 * @openapi
 * /api/scheduled-messages:
 *   post:
 *     operationId: createScheduledMessage
 *     tags: [Scheduled Messages]
 *     summary: Create a scheduled message
 *     description: >
 *       Requires the bot or admin role (checked in-handler). `requesterUserId`
 *       is resolved to a chat_member_mapping row and becomes the owner of the
 *       new row; the bot supplies it on behalf of the end user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, requesterUserId, chat_channel_id, message_body, scheduled_at]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               requesterUserId:
 *                 type: string
 *                 description: Platform user id (e.g. Discord snowflake) resolved to a chat_member_mapping row.
 *               chat_channel_id: { type: string }
 *               chat_guild_id: { type: string, nullable: true }
 *               message_body: { type: string }
 *               scheduled_at:
 *                 type: string
 *                 format: date-time
 *                 description: Any value parseable by `new Date(...)`; normalized to UTC ISO 8601.
 *     responses:
 *       '201':
 *         description: Created scheduled message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 scheduledMessage:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     user_id: { type: integer }
 *                     app: { type: string, enum: [discord] }
 *                     chat_channel_id: { type: string }
 *                     chat_guild_id: { type: string, nullable: true }
 *                     message_body: { type: string }
 *                     scheduled_at: { type: string, format: date-time, nullable: true }
 *                     status: { type: string, enum: [pending, sent] }
 *                     sent_at: { type: string, format: date-time, nullable: true }
 *                     created_at: { type: string, format: date-time, nullable: true }
 *       '400':
 *         description: >
 *           Missing/invalid `app`, an unresolvable `requesterUserId`, missing
 *           `chat_channel_id`, missing `message_body`, or an invalid
 *           `scheduled_at`.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenBotOrAdmin'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", authenticate, async (req, res) => {
  try {
    if (denyUnlessBotOrAdmin(req, res)) return;

    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }

    const channelId = String(req.body?.chat_channel_id ?? "").trim();
    const guildIdRaw = req.body?.chat_guild_id;
    const messageBody = String(req.body?.message_body ?? "").trim();
    const scheduledAt = normalizeUtcIsoString(req.body?.scheduled_at);

    if (!channelId) {
      return res
        .status(400)
        .json({ ok: false, error: "chat_channel_id is required" });
    }
    if (!messageBody) {
      return res
        .status(400)
        .json({ ok: false, error: "message_body is required" });
    }
    if (!scheduledAt) {
      return res
        .status(400)
        .json({ ok: false, error: "scheduled_at must be a valid datetime" });
    }

    const id = await createScheduledMessage({
      userId: requester.userId,
      app: requester.app,
      chatChannelId: channelId,
      chatGuildId:
        guildIdRaw == null || String(guildIdRaw).trim() === ""
          ? null
          : String(guildIdRaw).trim(),
      messageBody,
      scheduledAtUtcIso: scheduledAt,
    });
    if (id == null) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to create scheduled message" });
    }
    const row = await getScheduledMessageById(requester.app, id);
    return res.status(201).json({ ok: true, scheduledMessage: row });
  } catch (err) {
    console.error("POST /api/scheduled-messages error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to create scheduled message" });
  }
});

/**
 * PUT /api/scheduled-messages/:id
 * Update user-owned message fields, admin override, OR mark as sent.
 * Body (requester update): { app, requesterUserId, message_body?, scheduled_at? }
 * Body (bot sent-mark): { scope: "bot", status: "sent", sent_at? }
 * Body (admin update): { scope: "admin", app, message_body?, scheduled_at? }
 * Auth: required (requester updates: bot or admin).
 * @openapi
 * /api/scheduled-messages/{id}:
 *   put:
 *     operationId: updateScheduledMessage
 *     tags: [Scheduled Messages]
 *     summary: Update a scheduled message (requester edit, bot sent-mark, or admin override)
 *     description: >
 *       `app` (query or body) is always required and is used to look up the
 *       existing row before branching on `scope`:
 *         - `scope=bot`: marks the row `status="sent"` (optionally with a
 *           `sent_at`, defaulting to now). Requires the bot role
 *           (checked in-handler). Used by the scheduler after dispatch.
 *         - `scope=admin`: updates `message_body` and/or `scheduled_at` on any
 *           row regardless of status. Requires the admin role (checked
 *           in-handler). At least one field must be provided.
 *         - Omitted (default, "requester scope"): resolves `requesterUserId`
 *           to a chat_member_mapping row, requires it to own the row, requires
 *           the row to still be `status="pending"`, and updates
 *           `message_body` and/or `scheduled_at`. Requires the bot or admin
 *           role (checked in-handler); at least one field must be provided.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: app
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [discord] }
 *         description: Chat app key. May be supplied here or in the request body; required either way.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - title: RequesterUpdate
 *                 type: object
 *                 properties:
 *                   app: { type: string, enum: [discord] }
 *                   requesterUserId:
 *                     type: string
 *                     description: Platform user id (e.g. Discord snowflake) resolved to a chat_member_mapping row.
 *                   message_body: { type: string }
 *                   scheduled_at: { type: string, format: date-time }
 *               - title: BotMarkSent
 *                 type: object
 *                 required: [scope, status]
 *                 properties:
 *                   scope: { type: string, enum: [bot] }
 *                   status: { type: string, enum: [sent] }
 *                   sent_at:
 *                     type: string
 *                     format: date-time
 *                     description: Defaults to the current time when omitted.
 *               - title: AdminUpdate
 *                 type: object
 *                 required: [scope]
 *                 properties:
 *                   scope: { type: string, enum: [admin] }
 *                   app: { type: string, enum: [discord] }
 *                   message_body: { type: string }
 *                   scheduled_at: { type: string, format: date-time }
 *     responses:
 *       '200':
 *         description: Updated scheduled message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 scheduledMessage:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     user_id: { type: integer }
 *                     app: { type: string, enum: [discord] }
 *                     chat_channel_id: { type: string }
 *                     chat_guild_id: { type: string, nullable: true }
 *                     message_body: { type: string }
 *                     scheduled_at: { type: string, format: date-time, nullable: true }
 *                     status: { type: string, enum: [pending, sent] }
 *                     sent_at: { type: string, format: date-time, nullable: true }
 *                     created_at: { type: string, format: date-time, nullable: true }
 *       '400':
 *         description: >
 *           Invalid `id`; missing/invalid `app`; for `scope=bot`, `status` was
 *           not `"sent"`; for `scope=admin` or requester scope, an empty
 *           `message_body`, an invalid `scheduled_at`, or neither field
 *           provided; for requester scope, an unresolvable `requesterUserId`
 *           or the row is no longer `status="pending"`.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         description: >
 *           Role check failed for the requested scope: bot role required for
 *           `scope=bot`, admin role required for `scope=admin`, bot/admin role
 *           required for requester scope, or (requester scope) the resolved
 *           requester does not own this row. All checks are enforced
 *           in-handler.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id))
      return res.status(400).json({ ok: false, error: "Invalid id" });

    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const existing = await getScheduledMessageById(app, id);
    if (!existing)
      return res
        .status(404)
        .json({ ok: false, error: "Scheduled message not found" });

    // Bot scope update (used by scheduler to mark sent).
    if (req.body?.scope === "bot") {
      if (!isBotRole(req.user?.role)) {
        return res.status(403).json({ ok: false, error: "Bot access required" });
      }
      if (req.body?.status !== "sent") {
        return res
          .status(400)
          .json({ ok: false, error: 'Bot updates only support status "sent"' });
      }
      const sentAt = normalizeUtcIsoString(
        req.body?.sent_at ?? new Date().toISOString(),
      );
      const updated = await updateScheduledMessageById(id, {
        status: "sent",
        sent_at: sentAt,
      });
      if (!updated) {
        return res.status(500).json({
          ok: false,
          error: "Failed to mark scheduled message as sent",
        });
      }
      const row = await getScheduledMessageById(app, id);
      return res.json({ ok: true, scheduledMessage: row });
    }

    // Admin scope update.
    if (req.body?.scope === "admin") {
      if (!isAdminRole(req.user?.role)) {
        return res.status(403).json({ ok: false, error: "Admin access required" });
      }
      const updates = {};
      if (req.body?.message_body !== undefined) {
        const body = String(req.body.message_body).trim();
        if (!body)
          return res
            .status(400)
            .json({ ok: false, error: "message_body cannot be empty" });
        updates.message_body = body;
      }
      if (req.body?.scheduled_at !== undefined) {
        const scheduledAt = normalizeUtcIsoString(req.body.scheduled_at);
        if (!scheduledAt) {
          return res
            .status(400)
            .json({ ok: false, error: "scheduled_at must be a valid datetime" });
        }
        updates.scheduled_at = scheduledAt;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          ok: false,
          error: "Provide message_body and/or scheduled_at to update",
        });
      }
      const updated = await updateScheduledMessageById(id, updates);
      if (!updated)
        return res
          .status(500)
          .json({ ok: false, error: "Failed to update scheduled message" });
      const row = await getScheduledMessageById(app, id);
      return res.json({ ok: true, scheduledMessage: row });
    }

    // Requester scope update (bot on behalf of user, or admin panel).
    if (denyUnlessBotOrAdmin(req, res)) return;

    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }
    if (existing.user_id !== requester.userId) {
      return res
        .status(403)
        .json({ ok: false, error: "Forbidden: not your scheduled message" });
    }
    if (existing.status !== "pending") {
      return res
        .status(400)
        .json({ ok: false, error: "Cannot edit a sent scheduled message" });
    }

    const updates = {};

    if (req.body?.message_body !== undefined) {
      const body = String(req.body.message_body).trim();
      if (!body)
        return res
          .status(400)
          .json({ ok: false, error: "message_body cannot be empty" });
      updates.message_body = body;
    }
    if (req.body?.scheduled_at !== undefined) {
      const scheduledAt = normalizeUtcIsoString(req.body.scheduled_at);
      if (!scheduledAt) {
        return res
          .status(400)
          .json({ ok: false, error: "scheduled_at must be a valid datetime" });
      }
      updates.scheduled_at = scheduledAt;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Provide message_body and/or scheduled_at to update",
      });
    }

    const updated = await updateScheduledMessageById(id, updates);
    if (!updated)
      return res
        .status(500)
        .json({ ok: false, error: "Failed to update scheduled message" });
    const row = await getScheduledMessageById(requester.app, id);
    return res.json({ ok: true, scheduledMessage: row });
  } catch (err) {
    console.error("PUT /api/scheduled-messages/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to update scheduled message" });
  }
});

/**
 * DELETE /api/scheduled-messages/:id
 * Delete pending scheduled message by id when owned by requester, or admin scope.
 * Body/query: { app, requesterUserId } or { scope: "admin", app }
 * Auth: required (requester delete: bot or admin).
 * @openapi
 * /api/scheduled-messages/{id}:
 *   delete:
 *     operationId: deleteScheduledMessage
 *     tags: [Scheduled Messages]
 *     summary: Delete a scheduled message (requester delete or admin override)
 *     description: >
 *       `scope=admin` (query or body) deletes the row regardless of status and
 *       requires the admin role (checked in-handler). Otherwise (default,
 *       "requester scope") requires the bot or admin role (checked
 *       in-handler), resolves `requesterUserId` to a chat_member_mapping row,
 *       and only deletes the row when it is owned by that requester and still
 *       `status="pending"`.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: scope
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [admin] }
 *         description: May also be supplied in the request body. Omit for requester scope.
 *       - name: app
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [discord] }
 *         description: >
 *           Chat app key. May be supplied here or in the request body;
 *           required for requester scope (not read for `scope=admin`).
 *       - name: requesterUserId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *         description: >
 *           Platform user id (e.g. Discord snowflake) resolved to a
 *           chat_member_mapping row. Required for requester scope; may also
 *           be supplied in the request body.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scope: { type: string, enum: [admin] }
 *               app: { type: string, enum: [discord] }
 *               requesterUserId: { type: string }
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
 *         description: >
 *           Invalid `id`; or, for requester scope, missing/invalid `app` or an
 *           unresolvable `requesterUserId`.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         description: >
 *           Admin role required for `scope=admin`, or bot/admin role required
 *           for requester scope. Both checks are enforced in-handler.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: >
 *           Not found for `scope=admin`, or (requester scope) no pending row
 *           with this id is owned by the resolved requester.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id))
      return res.status(400).json({ ok: false, error: "Invalid id" });

    if (req.body?.scope === "admin" || req.query?.scope === "admin") {
      if (!isAdminRole(req.user?.role)) {
        return res.status(403).json({ ok: false, error: "Admin access required" });
      }
      const deleted = await deleteScheduledMessageByIdAdmin(id);
      if (!deleted) {
        return res.status(404).json({
          ok: false,
          error: "Scheduled message not found",
        });
      }
      return res.json({ ok: true });
    }

    if (denyUnlessBotOrAdmin(req, res)) return;

    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }

    const deleted = await deletePendingScheduledMessageByIdForUser(
      id,
      requester.userId,
    );
    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Pending scheduled message not found for requester",
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/scheduled-messages/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to delete scheduled message" });
  }
});

export default router;
