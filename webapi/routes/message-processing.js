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
 * - type: "message" — Parse message for word++ / user++ / -- and record votes (filter list applied).
 *   Body: { app: "discord", type: "message", message: { content: string, author: { id: string } }, voterId: string }
 * - type: "reaction" — Record a single +/- from a reaction (e.g. emoji on a message).
 *   Body: { app: "discord", type: "reaction", targetUserId: string, reactorId: string, value: 1 | -1 }
 * Auth: required.
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
 * Body: { messageId: string }
 * Response: { ok: true }
 * Auth: required.
 */
router.post("/pin-log", authenticate, async (req, res) => {
  try {
    const result = await logPinnedMessage(req.body?.messageId);
    if (!result.ok) {
      return res
        .status(400)
        .json({ ...result, error: "messageId is required" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to log pinned message" });
  }
});

export default router;
