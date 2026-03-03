import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as leaderboards from "../services/leaderboards.js";

const router = express.Router();

/**
 * POST /api/leaderboards/plusplus
 * Top and bottom plusplus scores (mirrors plusplus-leaderboard command).
 * Body: { limit?: number } (optional, default 5, max 50)
 */
router.post("/plusplus", authenticate, async (req, res) => {
  try {
    const limit = leaderboards.parseLimit(req.body?.limit, 5, 50);
    const [top, bottom] = await Promise.all([
      leaderboards.getPlusPlusTopScores(limit),
      leaderboards.getPlusPlusBottomScores(limit),
    ]);
    res.json({ ok: true, limit, top, bottom });
  } catch (err) {
    console.error("POST /api/leaderboards/plusplus error:", err);
    res.status(500).json({ ok: false, error: "Failed to get plusplus leaderboard" });
  }
});

/**
 * GET /api/leaderboards/plusplus/total
 * Total score for a word or user (mirrors plusplus-total command).
 * Query: string= required, type=word|user (default word)
 */
router.get("/plusplus/total", authenticate, async (req, res) => {
  try {
    const string = req.query.string;
    const type = req.query.type === "user" ? "user" : "word";
    if (!string) {
      return res.status(400).json({ ok: false, error: "Query parameter 'string' is required" });
    }
    const result = await leaderboards.getPlusPlusTotalByString(string, type);
    if (!result) {
      return res.status(400).json({ ok: false, error: "Invalid type; use 'word' or 'user'" });
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("GET /api/leaderboards/plusplus/total error:", err);
    res.status(500).json({ ok: false, error: "Failed to get plusplus total" });
  }
});

/**
 * GET /api/leaderboards/plusplus/voter/:userId
 * Number of +/- votes cast by a user (mirrors plusplus-voter-frequency command).
 */
router.get("/plusplus/voter/:userId", authenticate, async (req, res) => {
  try {
    const result = await leaderboards.getPlusPlusVotesByVoter(req.params.userId);
    if (!result) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("GET /api/leaderboards/plusplus/voter/:userId error:", err);
    res.status(500).json({ ok: false, error: "Failed to get voter count" });
  }
});

/**
 * POST /api/leaderboards/plusplus/top-voters
 * Top plusplus voters by vote count (mirrors plusplus-top-voters command).
 * Body: { limit?: number } (optional, default 3, max 50)
 */
router.post("/plusplus/top-voters", authenticate, async (req, res) => {
  try {
    const limit = leaderboards.parseLimit(req.body?.limit, 3, 50);
    const topVoters = await leaderboards.getPlusPlusTopVoters(limit);
    res.json({ ok: true, limit, topVoters });
  } catch (err) {
    console.error("POST /api/leaderboards/plusplus/top-voters error:", err);
    res.status(500).json({ ok: false, error: "Failed to get top voters" });
  }
});

/**
 * POST /api/leaderboards/emoji
 * Top used emojis (mirrors top-emojis command).
 * Body: { limit?: number } (optional, default 5, max 50)
 */
router.post("/emoji", authenticate, async (req, res) => {
  try {
    const limit = leaderboards.parseLimit(req.body?.limit, 5, 50);
    const top = await leaderboards.getTopEmoji(limit);
    res.json({ ok: true, limit, top });
  } catch (err) {
    console.error("POST /api/leaderboards/emoji error:", err);
    res.status(500).json({ ok: false, error: "Failed to get emoji leaderboard" });
  }
});

/**
 * POST /api/leaderboards/repost
 * Top reposters by accusation count (mirrors top-reposters command).
 * Body: { limit?: number } (optional, default 5, max 50)
 */
router.post("/repost", authenticate, async (req, res) => {
  try {
    const limit = leaderboards.parseLimit(req.body?.limit, 5, 50);
    const top = await leaderboards.getTopReposters(limit);
    res.json({ ok: true, limit, top });
  } catch (err) {
    console.error("POST /api/leaderboards/repost error:", err);
    res.status(500).json({ ok: false, error: "Failed to get repost leaderboard" });
  }
});

/**
 * GET /api/leaderboards/repost/user/:userId
 * Repost count for a user (mirrors reposts-by-user command).
 */
router.get("/repost/user/:userId", authenticate, async (req, res) => {
  try {
    const result = await leaderboards.getRepostsForUser(req.params.userId);
    if (!result) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("GET /api/leaderboards/repost/user/:userId error:", err);
    res.status(500).json({ ok: false, error: "Failed to get reposts for user" });
  }
});

export default router;
