import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  countEmoji,
  recordPlusMinusMessage,
  recordPlusMinusReaction,
  countRepost,
  importGuildAssetFrequencyList,
  importUserMappingList,
  isMessageAlreadyPinned,
  logPinnedMessage,
} from "../services/messageProcessing.js";
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
 *   authorId: string,
 *   emojis: Array<{ name: string, id?: string, type?: string }>,
 *   isReply?: boolean,
 *   repliedUserId?: string,
 * }
 * Auth: required.
 * @openapi
 * /api/message-processing/emoji-count:
 *   post:
 *     operationId: recordEmojiCount
 *     tags: [Message Processing]
 *     summary: Record emoji usage in a message
 *     description: >
 *       Increments emoji_frequency / user_emoji_tracking for each emoji in the message.
 *       If isReply is true and the emojis are exactly one configured plusplus/minusminus emoji,
 *       also records a single +/- vote for repliedUserId instead of counting it as emoji usage.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, authorId, emojis]
 *             properties:
 *               app: { type: string, enum: [discord] }
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
 *       '400':
 *         description: Missing/invalid app parameter, or repliedUserId is not a known chat member.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/emoji-count", authenticate, async (req, res) => {
  try {
    if (!resolveChatAppFromRequest(req)) {
      return res.status(400).json(CHAT_APP_PARAM_ERROR);
    }
    const result = await countEmoji(req.body);
    if (result.ok === false && result.error) {
      return res.status(400).json({ ...result, ok: false });
    }
    res.json({ ...result, ok: result.ok !== false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to record emoji count" });
  }
});

/**
 * POST /api/message-processing/plusminus
 * Two modes (use type to choose):
 * - type: "message": Parse message for word++ / user++ / -- and record votes (filter list applied).
 *   Body: { app: "discord", type: "message", message: { content: string, author: { id: string } }, voterId: string }
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
 *       (self-votes on mentions are skipped). "reaction" records a single +/- vote directly.
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
    res.json({ ...result, ok: true });
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
 *       repost=1 upserts a row in user_repost_tracking keyed on (userid, msgid, accuser).
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
    res.json({ ...result, ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to record repost" });
  }
});

/**
 * POST /api/message-processing/emoji-import
 * Sync server emoji list (mirrors bot api/emojis.js POST to this route).
 * Deletes zero-frequency emoji rows (type 'emoji' or NULL), then inserts any missing ids into emoji_frequency with type 'emoji'.
 * Body: { emojis: Array<{ id: string, name: string, animated?: boolean }> }
 * Response: { ok: true, imported: number }
 * Auth: required.
 * @openapi
 * /api/message-processing/emoji-import:
 *   post:
 *     operationId: importEmojis
 *     tags: [Message Processing]
 *     summary: Sync the guild's custom emoji catalog
 *     description: >
 *       Deletes zero-frequency emoji_frequency rows (type 'emoji' or NULL), then inserts any
 *       emoji ids not already present with frequency 0.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emojis]
 *             properties:
 *               emojis:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     animated: { type: boolean }
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
 *         description: emojis is not an array.
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
    const { emojis } = req.body ?? {};
    const result = await importGuildAssetFrequencyList(emojis, "emoji");
    if (!result.ok) {
      return res
        .status(400)
        .json({ ok: false, error: "emojis array is required" });
    }
    res.json({ ok: true, imported: result.imported ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to import emoji list" });
  }
});

/**
 * POST /api/message-processing/sticker-import
 * Sync server sticker list (like emoji-import; no animated field).
 * Deletes zero-frequency sticker rows in emoji_frequency (type 'sticker'), then inserts any missing ids with type 'sticker'.
 * Body: { stickers: Array<{ id: string, name: string }> }
 * Response: { ok: true, imported: number }
 * Auth: required.
 * @openapi
 * /api/message-processing/sticker-import:
 *   post:
 *     operationId: importStickers
 *     tags: [Message Processing]
 *     summary: Sync the guild's sticker catalog
 *     description: >
 *       Deletes zero-frequency emoji_frequency rows of type 'sticker', then inserts any
 *       sticker ids not already present with frequency 0.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stickers]
 *             properties:
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
 *         description: stickers is not an array.
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
    const { stickers } = req.body ?? {};
    const result = await importGuildAssetFrequencyList(stickers, "sticker");
    if (!result.ok) {
      return res
        .status(400)
        .json({ ok: false, error: "stickers array is required" });
    }
    res.json({ ok: true, imported: result.imported ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to import sticker list" });
  }
});

/**
 * POST /api/message-processing/user-mapping-import
 * Upsert Discord users into chat_member_mapping (mirrors bot api/userMapping.js).
 * Body: { app: "discord", users: Array<{ name, discord_handle, discord_id }> }
 * Response: { ok: true, imported: number }
 * Auth: required.
 * @openapi
 * /api/message-processing/user-mapping-import:
 *   post:
 *     operationId: importUserMapping
 *     tags: [Message Processing]
 *     summary: Bulk upsert cross-app user identity mappings
 *     description: >
 *       Upserts rows into chat_member_mapping keyed on the app's platform id column
 *       (discord_id for app "discord"). Rows missing name/handle/id are skipped.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, users]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               users:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     discord_handle: { type: string }
 *                     discord_id: { type: string, description: "Discord snowflake." }
 *     responses:
 *       '200':
 *         description: User mappings synced.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 imported: { type: integer, description: "Rows upserted (skipped rows not counted)." }
 *       '400':
 *         description: users is not an array, or app is unsupported.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/user-mapping-import", authenticate, async (req, res) => {
  try {
    const { users, app } = req.body ?? {};
    const result = await importUserMappingList(users, app);
    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        error: result.error ?? "Invalid user mapping import request",
      });
    }
    res.json({ ok: true, imported: result.imported ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to import user mapping" });
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
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to log pinned message" });
  }
});

export default router;
