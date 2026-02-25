import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  countEmoji,
  recordPlusMinusMessage,
  countRepost,
} from "../services/messageProcessing.js";

const router = express.Router();

/**
 * POST /api/message-processing/emoji-count
 * Record emoji usage in a message (and optionally a single +/- vote when replying).
 * Body: {
 *   authorId: string,
 *   emojis: Array<{ name: string, id?: string }>,
 *   isReply?: boolean,
 *   repliedUserId?: string,
 * }
 * Auth: required.
 */
router.post("/emoji-count", authenticate, async (req, res) => {
  try {
    const result = await countEmoji(req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record emoji count" });
  }
});

/**
 * POST /api/message-processing/plusminus
 * Parse message for word++ / user++ / -- and record votes (filter list applied).
 * Body: { message: { content: string, author: { id: string } }, voterId: string }
 * Auth: required.
 */
router.post("/plusminus", authenticate, async (req, res) => {
  try {
    const result = await recordPlusMinusMessage(req.body);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record plus/minus" });
  }
});

/**
 * POST /api/message-processing/count-repost
 * Record or withdraw a repost accusation.
 * Body: {
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
    const result = await countRepost(req.body);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record repost" });
  }
});

export default router;
