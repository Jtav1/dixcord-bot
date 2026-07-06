import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as leaderboards from "../services/leaderboards.js";
import { getEmojiStatsForUser } from "../services/events.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";

const router = express.Router();

/**
 * Parse optional from/to time range from body or query.
 * @param {import('express').Request} req
 * @returns {{ from?: string, to?: string }}
 */
function parseRangeFromRequest(req) {
  return {
    from: req.body?.from ?? req.query?.from,
    to: req.body?.to ?? req.query?.to,
  };
}

/**
 * POST /api/leaderboards/plusplus
 * Top and bottom plusplus scores (mirrors plusplus-leaderboard command).
 * Body: { app: "discord", limit?: number } (limit optional, default 5, max 50)
 * Auth: required.
 */
router.post("/plusplus", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const limit = leaderboards.parseLimit(req.body?.limit, 5, 50);
    const range = parseRangeFromRequest(req);
    const [top, bottom] = await Promise.all([
      leaderboards.getPlusPlusTopScores(limit, app, range),
      leaderboards.getPlusPlusBottomScores(limit, app, range),
    ]);
    res.json({ ok: true, app, limit, from: range.from ?? null, to: range.to ?? null, top, bottom });
  } catch (err) {
    console.error("POST /api/leaderboards/plusplus error:", err);
    res.status(500).json({ ok: false, error: "Failed to get plusplus leaderboard" });
  }
});

/**
 * GET /api/leaderboards/plusplus/history/:rowId
 * Full plus/minus vote history for one leaderboard row (word or user).
 * Path: rowId = platform user id (user) or word text (word), as returned on the leaderboard.
 * Query: type=word|user (default word), app=discord required
 * Auth: required.
 */
router.get("/plusplus/history/:rowId", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const rowId = req.params.rowId;
    const type = req.query.type === "user" ? "user" : "word";
    if (!rowId) {
      return res.status(400).json({ ok: false, error: "rowId is required" });
    }
    const result = await leaderboards.getPlusPlusVoteHistoryByRowId(rowId, type, app);
    if (!result) {
      return res.status(400).json({ ok: false, error: "Invalid type; use 'word' or 'user'" });
    }
    res.json({ ok: true, app, ...result, count: result.votes.length });
  } catch (err) {
    console.error("GET /api/leaderboards/plusplus/history/:rowId error:", err);
    res.status(500).json({ ok: false, error: "Failed to get plusplus vote history" });
  }
});

/**
 * GET /api/leaderboards/plusplus/total
 * Total score for a word or user (mirrors plusplus-total command).
 * Query: string= required, type=word|user (default word), app=discord required
 * Auth: required.
 */
router.get("/plusplus/total", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const string = req.query.string;
    const type = req.query.type === "user" ? "user" : "word";
    if (!string) {
      return res.status(400).json({ ok: false, error: "Query parameter 'string' is required" });
    }
    const result = await leaderboards.getPlusPlusTotalByString(string, type, app);
    if (!result) {
      return res.status(400).json({ ok: false, error: "Invalid type; use 'word' or 'user'" });
    }
    res.json({ ok: true, app, ...result });
  } catch (err) {
    console.error("GET /api/leaderboards/plusplus/total error:", err);
    res.status(500).json({ ok: false, error: "Failed to get plusplus total" });
  }
});

/**
 * GET /api/leaderboards/plusplus/voter/:userId
 * Number of +/- votes cast by a user (mirrors plusplus-voter-frequency command).
 * Query: app=discord required
 * Auth: required.
 */
router.get("/plusplus/voter/:userId", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const result = await leaderboards.getPlusPlusVotesByVoter(req.params.userId, app);
    if (!result) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }
    res.json({ ok: true, app, ...result });
  } catch (err) {
    console.error("GET /api/leaderboards/plusplus/voter/:userId error:", err);
    res.status(500).json({ ok: false, error: "Failed to get voter count" });
  }
});

/**
 * POST /api/leaderboards/plusplus/top-voters
 * Top plusplus voters by vote count (mirrors plusplus-top-voters command).
 * Body: { app: "discord", limit?: number } (optional, default 3, max 50)
 * Auth: required.
 */
router.post("/plusplus/top-voters", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const limit = leaderboards.parseLimit(req.body?.limit, 3, 50);
    const topVoters = await leaderboards.getPlusPlusTopVoters(limit, app);
    res.json({ ok: true, app, limit, topVoters });
  } catch (err) {
    console.error("POST /api/leaderboards/plusplus/top-voters error:", err);
    res.status(500).json({ ok: false, error: "Failed to get top voters" });
  }
});

/**
 * POST /api/leaderboards/emoji
 * Top used emojis (mirrors top-emojis command).
 * Body: { limit?: number } (optional, default 5, max 50)
 * Auth: required.
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
 * Body: { app: "discord", limit?: number } (optional, default 5, max 50)
 * Auth: required.
 */
router.post("/repost", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const limit = leaderboards.parseLimit(req.body?.limit, 5, 50);
    const range = parseRangeFromRequest(req);
    const top = await leaderboards.getTopReposters(limit, app, range);
    res.json({ ok: true, app, limit, from: range.from ?? null, to: range.to ?? null, top });
  } catch (err) {
    console.error("POST /api/leaderboards/repost error:", err);
    res.status(500).json({ ok: false, error: "Failed to get repost leaderboard" });
  }
});

/**
 * GET /api/leaderboards/repost/user/:userId
 * Repost count for a user (mirrors reposts-by-user command).
 * Query: app=discord required
 * Auth: required.
 */
router.get("/repost/user/:userId", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const result = await leaderboards.getRepostsForUser(req.params.userId, app);
    if (!result) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }
    res.json({ ok: true, app, ...result });
  } catch (err) {
    console.error("GET /api/leaderboards/repost/user/:userId error:", err);
    res.status(500).json({ ok: false, error: "Failed to get reposts for user" });
  }
});

/**
 * GET /api/leaderboards/emoji/user/:userId
 * Per-user emoji usage stats.
 * Query: app=discord required, limit optional
 * Auth: required.
 */
router.get("/emoji/user/:userId", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const limit = leaderboards.parseLimit(req.query.limit, 50, 200);
    const stats = await getEmojiStatsForUser(req.params.userId, app, limit);
    res.json({ ok: true, app, userId: req.params.userId, stats });
  } catch (err) {
    console.error("GET /api/leaderboards/emoji/user/:userId error:", err);
    res.status(500).json({ ok: false, error: "Failed to get user emoji stats" });
  }
});

export default router;
