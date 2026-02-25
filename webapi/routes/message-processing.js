import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  countEmoji,
  recordPlusMinusMessage,
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
 *   plusEmojiId?: string,
 *   minusEmojiId?: string
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
 * Body: { message: string, voterId: string }
 * Auth: required.
 */
router.post("/plusminus", authenticate, async (req, res) => {
  try {
    const result = await recordPlusMinusMessage(req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record plus/minus" });
  }
});

export default router;
