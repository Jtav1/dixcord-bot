import express from "express";
import { authenticate, requireBotOrAdmin, requireOwnGuildOrAdmin } from "../middleware/auth.js";
import {
  countEmoji,
  countSticker,
  recordPlusMinusMessage,
  recordPlusMinusReaction,
  countRepost,
  importGuildAssetFrequencyList,
  syncGuildEmojiFrequency,
  isMessageAlreadyPinned,
  logPinnedMessage,
} from "../services/messageProcessing.js";
import { recordTimeoutVote, removeTimeoutVote } from "../services/timeoutVotes.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";

const router = express.Router();

/**
 * POST /api/message-processing/emoji-count
 * Record emoji usage in a message (and optionally a single +/- vote when replying).
 * Body: {
 *   app: "discord",
 *   guildId: string,
 *   authorId: string,
 *   emojis: Array<{ name: string, id?: string, type?: string }>,
 *   isReply?: boolean,
 *   repliedUserId?: string,
 * }
 * Auth: required. A guild-scoped bot account may only post for its own guildId.
 * @openapi
 * /api/message-processing/emoji-count:
 *   post:
 *     operationId: recordEmojiCount
 *     tags: [Message Processing]
 *     summary: Record emoji usage in a message
 *     description: >
 *       Increments guild_emojis.frequency / member_emoji_tracking for each emoji in the message.
 *       If isReply is true and the emojis are exactly one configured plusplus/minusminus emoji
 *       (guild_config, resolved via resolveConfigEmojiValue and compared with emojisMatch), also
 *       records a single +/- vote for repliedUserId instead of counting it as emoji usage.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, authorId, emojis]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               guildId: { type: string, description: "Needed to resolve this server's plusplus_emoji/minusminus_emoji from guild_config." }
 *               authorId: { type: string, description: "Discord snowflake of the message author." }
 *               emojis:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     id: { type: string }
 *                     type: { type: string }
 *               isReply: { type: boolean, default: false }
 *               repliedUserId: { type: string, description: "Discord snowflake of the user being replied to." }
 *     responses:
 *       '200':
 *         description: >
 *           Emoji usage recorded, or a reply vote applied. `ok` may be false with no `applied`/`error`
 *           when authorId or emojis were missing/empty.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 applied:
 *                   type: string
 *                   enum: [plus, minus]
 *                   description: Present only when isReply triggered a single +/- vote instead of emoji counting.
 *                 milestones:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/MilestoneHit' }
 *       '400':
 *         description: Missing/invalid app parameter, missing guildId, or repliedUserId is not a known chat member.
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
router.post("/emoji-count", authenticate, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    if (!resolveChatAppFromRequest(req)) {
      return res.status(400).json(CHAT_APP_PARAM_ERROR);
    }
    const result = await countEmoji(req.body);
    if (result.ok === false && result.error) {
      return res.status(400).json({ ...result, ok: false });
    }
    res.json({ ...result, ok: result.ok !== false, milestones: result.milestones ?? [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to record emoji count" });
  }
});

/**
 * POST /api/message-processing/sticker-count
 * Record sticker usage in a message.
 * Body: { app: "discord", guildId: string, authorId: string, stickers: Array<{ name: string, id?: string }> }
 * Auth: required.
 * @openapi
 * /api/message-processing/sticker-count:
 *   post:
 *     operationId: recordStickerCount
 *     tags: [Message Processing]
 *     summary: Record sticker usage in a message
 *     description: >
 *       Increments guild_emojis.frequency (type='sticker') / member_emoji_tracking for each
 *       sticker in the message. Unlike emoji-count, there is no plus/minus branch — Discord has no
 *       reply-with-sticker vote mechanism.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, authorId, stickers]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               guildId: { type: string }
 *               authorId: { type: string, description: "Discord snowflake of the message author." }
 *               stickers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     id: { type: string }
 *     responses:
 *       '200':
 *         description: >
 *           Sticker usage recorded. `ok` may be false with no `error` when authorId or stickers
 *           were missing/empty.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 milestones:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/MilestoneHit' }
 *       '400':
 *         description: Missing/invalid app parameter, or authorId is not a known chat member.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/sticker-count", authenticate, async (req, res) => {
  try {
    if (!resolveChatAppFromRequest(req)) {
      return res.status(400).json(CHAT_APP_PARAM_ERROR);
    }
    const result = await countSticker(req.body);
    if (result.ok === false && result.error) {
      return res.status(400).json({ ...result, ok: false });
    }
    res.json({ ...result, ok: result.ok !== false, milestones: result.milestones ?? [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to record sticker count" });
  }
});

/**
 * POST /api/message-processing/plusminus
 * Two modes (use type to choose):
 * - type: "message": Parse message for word++ / user++ / -- and record votes (filter list applied).
 *   Body: { app: "discord", type: "message", message: { content: string, author: { id: string } }, voterId: string, isReply?: boolean, repliedUserId?: string }
 * - type: "reaction": Record a single +/- from a reaction (e.g. emoji on a message).
 *   Body: { app: "discord", type: "reaction", targetUserId: string, reactorId: string, value: 1 | -1 }
 * Auth: required.
 * @openapi
 * /api/message-processing/plusminus:
 *   post:
 *     operationId: recordPlusMinus
 *     tags: [Message Processing]
 *     summary: Parse a message or reaction for plus/minus votes
 *     description: >
 *       type defaults to "message" when omitted or not "reaction". "message" parses word++/word--
 *       and @mention++/@mention-- tokens out of message.content and records one vote per match
 *       (self-votes on mentions are skipped); total +/- characters are capped at 2 to prevent one
 *       message from casting a pile of votes at once. When isReply is true and repliedUserId is
 *       given and message.content is exactly "++" or "--" (no preceding word/mention for the
 *       parser to match), a single vote is recorded for repliedUserId instead. "reaction" records
 *       a single +/- vote directly.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [app, message, voterId]
 *                 properties:
 *                   app: { type: string, enum: [discord] }
 *                   type: { type: string, enum: [message] }
 *                   message:
 *                     type: object
 *                     properties:
 *                       content: { type: string }
 *                       author:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                   voterId: { type: string, description: "Discord snowflake of the message author (voter)." }
 *                   isReply: { type: boolean, default: false, description: "Whether the source message was a reply to another message." }
 *                   repliedUserId: { type: string, description: "Discord snowflake of the user being replied to; only used when message.content is exactly \"++\" or \"--\"." }
 *               - type: object
 *                 required: [app, type, targetUserId, reactorId, value]
 *                 properties:
 *                   app: { type: string, enum: [discord] }
 *                   type: { type: string, enum: [reaction] }
 *                   targetUserId: { type: string, description: "Discord snowflake receiving the vote." }
 *                   reactorId: { type: string, description: "Discord snowflake who reacted." }
 *                   value: { type: integer, enum: [1, -1] }
 *     responses:
 *       '200':
 *         description: Vote(s) recorded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 recorded: { type: integer, description: "Number of votes recorded (0 or 1 for reaction mode)." }
 *                 value: { type: integer, enum: [1, -1], description: "Reaction mode only." }
 *                 milestones:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/MilestoneHit' }
 *       '400':
 *         description: Missing/invalid app, missing voterId/targetUserId/reactorId, invalid value, or self-vote attempted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/plusminus", authenticate, async (req, res) => {
  try {
    if (!resolveChatAppFromRequest(req)) {
      return res.status(400).json(CHAT_APP_PARAM_ERROR);
    }
    const body = req.body ?? {};
    const type = body.type === "reaction" ? "reaction" : "message";

    const result =
      type === "reaction"
        ? await recordPlusMinusReaction(body)
        : await recordPlusMinusMessage(body);

    if (!result.ok) {
      return res.status(400).json({ ...result, ok: false });
    }
    res.json({ ...result, ok: true, milestones: result.milestones ?? [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to record plus/minus" });
  }
});

/**
 * POST /api/message-processing/count-repost
 * Record or withdraw a repost accusation.
 * Body: {
 *   app: "discord",
 *   userid: string (author of message accused of reposting),
 *   msgid: string,
 *   accuser: string (user who added repost emoji),
 *   msgcontents?: string,
 *   repost: 1 | -1 (1 = create, -1 = withdraw)
 * }
 * Auth: required.
 * @openapi
 * /api/message-processing/count-repost:
 *   post:
 *     operationId: recordRepostCount
 *     tags: [Message Processing]
 *     summary: Record or withdraw a repost accusation
 *     description: >
 *       repost=1 upserts a row in member_repost_tracking keyed on (userid, msgid, accuser).
 *       repost=-1 deletes the row(s) for that (msgid, accuser).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, userid, msgid, accuser, repost]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               userid: { type: string, description: "Discord snowflake of the message author accused of reposting." }
 *               msgid: { type: string, description: "Discord snowflake of the accused message." }
 *               accuser: { type: string, description: "Discord snowflake of the user who added the repost emoji." }
 *               msgcontents: { type: string }
 *               repost: { type: integer, enum: [1, -1], description: "1 = create/refresh accusation, -1 = withdraw." }
 *     responses:
 *       '200':
 *         description: Accusation recorded or withdrawn.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 action: { type: string, enum: [created, withdrawn] }
 *                 deleted: { type: integer, description: "Rows deleted; only present when action is withdrawn." }
 *                 milestones:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/MilestoneHit' }
 *       '400':
 *         description: Missing/invalid app, userid/msgid/accuser missing, repost not 1 or -1, or unknown chat member.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/count-repost", authenticate, async (req, res) => {
  try {
    if (!resolveChatAppFromRequest(req)) {
      return res.status(400).json(CHAT_APP_PARAM_ERROR);
    }
    const result = await countRepost(req.body);
    if (!result.ok) {
      return res.status(400).json({ ...result, ok: false });
    }
    res.json({ ...result, ok: true, milestones: result.milestones ?? [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to record repost" });
  }
});

/**
 * POST /api/message-processing/emoji-import
 * Sync server emoji list (mirrors bot api/emojis.js POST to this route).
 * Replaces this guild's guild_emojis catalog rows (type='emoji'), keeping rows with usage
 * history (frequency > 0) even if no longer live on Discord; guild_emojis.frequency itself is
 * untouched. Gracefully no-ops (imported:0) if guildId isn't a known guild.
 * Body: { app: "discord", guildId: string, emojis: Array<{ id: string, name: string, animated?: boolean, available?: boolean, managed?: boolean, requiresColons?: boolean, roles?: string[] }> }
 * Response: { ok: true, imported: number }
 * Auth: required.
 * @openapi
 * /api/message-processing/emoji-import:
 *   post:
 *     operationId: importEmojis
 *     tags: [Message Processing]
 *     summary: Sync the guild's custom emoji catalog
 *     description: >
 *       Replaces this guild's guild_emojis rows of type 'emoji' (mirrors guild_channels/
 *       guild_roles sync), keeping rows with usage history (frequency > 0) even if no longer
 *       live on Discord. guild_emojis.frequency itself is untouched. Gracefully discards the
 *       whole sync (imported:0, no error) if guildId isn't a known guild (guild_info).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, emojis]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               guildId: { type: string }
 *               emojis:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     animated: { type: boolean }
 *                     available: { type: boolean, nullable: true }
 *                     managed: { type: boolean, nullable: true }
 *                     requiresColons: { type: boolean, nullable: true }
 *                     roles: { type: array, items: { type: string } }
 *     responses:
 *       '200':
 *         description: Emoji catalog synced.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 imported: { type: integer, description: "New rows added; existing emoji ids are skipped." }
 *       '400':
 *         description: Missing/invalid app, or emojis is not an array.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/emoji-import", authenticate, async (req, res) => {
  try {
    if (!resolveChatAppFromRequest(req)) {
      return res.status(400).json(CHAT_APP_PARAM_ERROR);
    }
    const { app, guildId, emojis } = req.body ?? {};
    const result = await importGuildAssetFrequencyList(emojis, "emoji", app, guildId);
    if (!result.ok) {
      return res
        .status(400)
        .json({ ok: false, error: "guildId and emojis array are required" });
    }
    res.json({ ok: true, imported: result.imported ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to import emoji list" });
  }
});

/**
 * POST /api/message-processing/emoji-frequency-sync
 * Admin maintenance for discord-bot/scripts/sync-emoji-frequency.js. First deletes guild_emojis
 * rows attributed to another guild (misattributed/legacy), then copies frequency from
 * emoji_frequency into guild_emojis for this guild — updating existing catalog rows and
 * inserting any missing ones (emoji_frequency is the source of truth for id/type/frequency when
 * a catalog row doesn't exist yet). Covers both emoji and sticker rows.
 * dryRun:true computes the same counts without writing anything.
 * Body: { app: "discord", guildId: string, dryRun?: boolean }
 * Auth: bot or admin.
 * @openapi
 * /api/message-processing/emoji-frequency-sync:
 *   post:
 *     operationId: syncEmojiFrequency
 *     tags: [Message Processing]
 *     summary: Sync guild_emojis frequency/rows from emoji_frequency for one guild
 *     description: >
 *       Deletes guild_emojis rows whose guild_id belongs to a different guild (app matches, but
 *       guild_id doesn't), then for every emoji_frequency row belonging to (app, guildId) — emoji
 *       and sticker alike, per emoji_frequency.type (NULL = emoji) — copies its frequency into
 *       the matching guild_emojis row (keyed on id), inserting one if it doesn't exist yet using
 *       only what emoji_frequency has (name falls back to the id). dryRun:true previews the same
 *       counts (deleted/inserted/updated) without writing anything.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               guildId: { type: string }
 *               dryRun: { type: boolean, default: false }
 *     responses:
 *       '200':
 *         description: Sync complete (or previewed, if dryRun).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 dryRun: { type: boolean }
 *                 deleted: { type: integer, description: "guild_emojis rows removed (misattributed to another guild)." }
 *                 inserted: { type: integer, description: "guild_emojis rows newly created from emoji_frequency." }
 *                 updated: { type: integer, description: "Existing guild_emojis rows whose frequency was copied over." }
 *                 synced: { type: integer, description: "inserted + updated." }
 *       '400':
 *         description: Missing/invalid app or guildId.
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
router.post("/emoji-frequency-sync", authenticate, requireBotOrAdmin, async (req, res) => {
  try {
    if (!resolveChatAppFromRequest(req)) {
      return res.status(400).json(CHAT_APP_PARAM_ERROR);
    }
    const { app, guildId, dryRun } = req.body ?? {};
    const result = await syncGuildEmojiFrequency(app, guildId, Boolean(dryRun));
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: "guildId is required" });
    }
    res.json({
      ok: true,
      dryRun: Boolean(dryRun),
      deleted: result.deleted ?? 0,
      inserted: result.inserted ?? 0,
      updated: result.updated ?? 0,
      synced: result.synced ?? 0,
    });
  } catch (err) {
    console.error("POST /api/message-processing/emoji-frequency-sync error:", err);
    res.status(500).json({ ok: false, error: "Failed to sync emoji frequency" });
  }
});

/**
 * POST /api/message-processing/sticker-import
 * Sync server sticker list (like emoji-import; no animated field).
 * Replaces this guild's guild_emojis catalog rows (type='sticker'), keeping rows with usage
 * history (frequency > 0) even if no longer live on Discord; guild_emojis.frequency itself is
 * untouched. Gracefully no-ops (imported:0) if guildId isn't a known guild.
 * Body: { app: "discord", guildId: string, stickers: Array<{ id: string, name: string }> }
 * Response: { ok: true, imported: number }
 * Auth: required.
 * @openapi
 * /api/message-processing/sticker-import:
 *   post:
 *     operationId: importStickers
 *     tags: [Message Processing]
 *     summary: Sync the guild's sticker catalog
 *     description: >
 *       Replaces this guild's guild_emojis rows of type 'sticker' (mirrors emoji-import), keeping
 *       rows with usage history (frequency > 0) even if no longer live on Discord.
 *       guild_emojis.frequency itself is untouched. Gracefully discards the whole sync
 *       (imported:0, no error) if guildId isn't a known guild (guild_info).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, stickers]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               guildId: { type: string }
 *               stickers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *     responses:
 *       '200':
 *         description: Sticker catalog synced.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 imported: { type: integer, description: "New rows added; existing sticker ids are skipped." }
 *       '400':
 *         description: Missing/invalid app, or stickers is not an array.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/sticker-import", authenticate, async (req, res) => {
  try {
    if (!resolveChatAppFromRequest(req)) {
      return res.status(400).json(CHAT_APP_PARAM_ERROR);
    }
    const { app, guildId, stickers } = req.body ?? {};
    const result = await importGuildAssetFrequencyList(stickers, "sticker", app, guildId);
    if (!result.ok) {
      return res
        .status(400)
        .json({ ok: false, error: "guildId and stickers array are required" });
    }
    res.json({ ok: true, imported: result.imported ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to import sticker list" });
  }
});

/**
 * POST /api/message-processing/pin-check
 * Check if a message was already logged as pinned.
 * Body: { messageId: string }
 * Response: { alreadyPinned: boolean }
 * Auth: required.
 * @openapi
 * /api/message-processing/pin-check:
 *   post:
 *     operationId: checkPinStatus
 *     tags: [Message Processing]
 *     summary: Check whether a message is already logged as pinned
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messageId]
 *             properties:
 *               messageId: { type: string, description: "Discord message snowflake." }
 *     responses:
 *       '200':
 *         description: Pin status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alreadyPinned: { type: boolean }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/pin-check", authenticate, async (req, res) => {
  try {
    const { messageId } = req.body ?? {};
    const alreadyPinned = await isMessageAlreadyPinned(messageId);
    res.json({ alreadyPinned });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: "Failed to check pin status",
    });
  }
});

/**
 * POST /api/message-processing/pin-log
 * Log a message as pinned (idempotent; no-op if already logged).
 * Body: {
 *   app: "discord",
 *   messageId: string,
 *   authorId?: string,
 *   contents?: string,
 *   attachments?: string | string[],
 *   channelId?: string,
 *   channelName?: string,
 *   pinnerIds?: string[]
 * }
 * Response: { ok: true }
 * Auth: required.
 * @openapi
 * /api/message-processing/pin-log:
 *   post:
 *     operationId: logPin
 *     tags: [Message Processing]
 *     summary: Log a message as pinned
 *     description: >
 *       Idempotent: no-op (still 200 ok:true) if messageId was already logged. authorId and
 *       pinnerIds are resolved to chat_member_mapping ids via app; unresolved ids are stored as null.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messageId, app]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               messageId: { type: string, description: "Discord message snowflake." }
 *               authorId: { type: string, description: "Discord snowflake of the message author." }
 *               contents: { type: string, description: "Truncated to 5000 characters." }
 *               attachments:
 *                 description: Attachment path(s) to normalize for storage.
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items: { type: string }
 *               channelId: { type: string, description: "Truncated to 32 characters." }
 *               channelName: { type: string, description: "Truncated to 100 characters." }
 *               pinnerIds:
 *                 type: array
 *                 items: { type: string }
 *                 description: Discord snowflakes of users who pinned the message.
 *     responses:
 *       '200':
 *         description: Logged (or already logged; no-op).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 milestones:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/MilestoneHit' }
 *       '400':
 *         description: messageId missing, app missing/unsupported, or attachments payload invalid.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/pin-log", authenticate, async (req, res) => {
  try {
    const result = await logPinnedMessage(req.body ?? {});
    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        error: result.error ?? "messageId is required",
      });
    }
    res.json({ ok: true, milestones: result.milestones ?? [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to log pinned message" });
  }
});

/**
 * POST /api/message-processing/timeout-vote
 * Record one reaction-add vote toward timing out a message's author. Idempotent once the
 * message has already fired a timeout (see timeout_history).
 * Body: { app: "discord", guildId: string, messageId: string, targetPlatformId: string, voterPlatformId: string, weight?: number }
 * Auth: required. A guild-scoped bot account may only post for its own guildId.
 * @openapi
 * /api/message-processing/timeout-vote:
 *   post:
 *     operationId: recordTimeoutVote
 *     tags: [Message Processing]
 *     summary: Record a vote-to-timeout reaction
 *     description: >
 *       Inserts into timeout_vote_tracking (unique per message+voter) and checks the running
 *       weighted total against guild_config's timeout_vote_threshold. Once the threshold is
 *       reached, inserts a timeout_history row (unique per message — the idempotency guard) and
 *       returns triggered:true with the duration/response message to apply; further votes on an
 *       already-triggered message return alreadyActioned:true instead of re-triggering.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, messageId, targetPlatformId, voterPlatformId]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               guildId: { type: string }
 *               messageId: { type: string, description: "Discord message snowflake." }
 *               targetPlatformId: { type: string, description: "Discord snowflake of the message author." }
 *               voterPlatformId: { type: string, description: "Discord snowflake of the user who reacted." }
 *               weight: { type: integer, description: "Vote weight based on the voter's roles (1/2/3). Defaults to 1.", default: 1 }
 *     responses:
 *       '200':
 *         description: Vote recorded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 triggered: { type: boolean }
 *                 alreadyActioned: { type: boolean }
 *                 currentWeight: { type: integer }
 *                 threshold: { type: integer }
 *                 targetPlatformId: { type: string }
 *                 durationSeconds: { type: integer }
 *                 responseMessage: { type: string }
 *                 voteWeightTotal: { type: integer }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/timeout-vote", authenticate, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const { guildId, messageId, targetPlatformId, voterPlatformId, weight } = req.body ?? {};
    if (!guildId || !messageId || !targetPlatformId || !voterPlatformId) {
      return res.status(400).json({
        ok: false,
        error: "guildId, messageId, targetPlatformId, and voterPlatformId are required",
      });
    }

    const result = await recordTimeoutVote({
      app,
      guildId: String(guildId),
      messageId: String(messageId),
      targetPlatformId: String(targetPlatformId),
      voterPlatformId: String(voterPlatformId),
      weight,
    });
    res.json(result);
  } catch (err) {
    console.error("POST /api/message-processing/timeout-vote error:", err);
    res.status(500).json({ ok: false, error: "Failed to record timeout vote" });
  }
});

/**
 * POST /api/message-processing/timeout-vote/remove
 * Un-count a reaction-remove vote. No-op once the message has already fired a timeout.
 * Body: { app: "discord", messageId: string, voterPlatformId: string }
 * Auth: required.
 * @openapi
 * /api/message-processing/timeout-vote/remove:
 *   post:
 *     operationId: removeTimeoutVote
 *     tags: [Message Processing]
 *     summary: Un-count a vote-to-timeout reaction removal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, messageId, voterPlatformId]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               messageId: { type: string, description: "Discord message snowflake." }
 *               voterPlatformId: { type: string, description: "Discord snowflake of the user who un-reacted." }
 *     responses:
 *       '200':
 *         description: Vote removed (or there was nothing to remove).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 removed: { type: boolean }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/timeout-vote/remove", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const { messageId, voterPlatformId } = req.body ?? {};
    if (!messageId || !voterPlatformId) {
      return res.status(400).json({ ok: false, error: "messageId and voterPlatformId are required" });
    }

    const result = await removeTimeoutVote({
      app,
      messageId: String(messageId),
      voterPlatformId: String(voterPlatformId),
    });
    res.json(result);
  } catch (err) {
    console.error("POST /api/message-processing/timeout-vote/remove error:", err);
    res.status(500).json({ ok: false, error: "Failed to remove timeout vote" });
  }
});

export default router;
