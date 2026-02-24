import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { takeALook, fortuneTeller, twitterFixer } from '../services/botResponses.js';

const router = express.Router();

/**
 * POST /api/bot-responses/take-a-look
 * Returns a random "take a look" image URL or rate-limit message.
 * Auth: required.
 */
router.post('/take-a-look', authenticate, async (req, res) => {
  try {
    const { response } = await takeALook();
    res.json({ response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get take-a-look response' });
  }
});

/**
 * POST /api/bot-responses/fortune
 * Returns a random 8-ball style fortune.
 * Auth: required.
 */
router.post('/fortune', authenticate, async (req, res) => {
  try {
    const { response } = await fortuneTeller();
    res.json({ response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get fortune' });
  }
});

/**
 * POST /api/bot-responses/twitter-fix
 * Body: { message: string }
 * Returns a fixed embed-friendly link if message contains a social link + trigger.
 * Auth: required.
 */
router.post('/twitter-fix', authenticate, async (req, res) => {
  try {
    const message = req.body?.message ?? '';
    const { response } = await twitterFixer(message);
    res.json({ response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fix link' });
  }
});

export default router;
