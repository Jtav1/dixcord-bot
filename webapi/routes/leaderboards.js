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
 * @openapi
 * /api/leaderboards/plusplus:
 *   post:
 *     operationId: getPlusplusLeaderboard
 *     tags: [Leaderboards]
 *     summary: Top and bottom plusplus scores
 *     description: Aggregates plusplus_tracking by word/user; string resolves to the platform user id for type "user".
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               limit: { type: integer, default: 5, minimum: 1, maximum: 50 }
 *               from: { type: string, format: date-time, description: "Optional inclusive lower bound on vote timestamp." }
 *               to: { type: string, format: date-time, description: "Optional inclusive upper bound on vote timestamp." }
 *     responses:
 *       '200':
 *         description: Top and bottom scoring rows.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 limit: { type: integer }
 *                 from: { type: string, nullable: true }
 *                 to: { type: string, nullable: true }
 *                 top:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       string: { type: string, description: "Word text, or the target's platform user id when typestr is 'user'." }
 *                       typestr: { type: string, enum: [word, user] }
 *                       total: { type: integer }
 *                 bottom:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       string: { type: string }
 *                       typestr: { type: string, enum: [word, user] }
 *                       total: { type: integer }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/leaderboards/plusplus/history/{rowId}:
 *   get:
 *     operationId: getPlusplusVoteHistory
 *     tags: [Leaderboards]
 *     summary: Full plus/minus vote history for one leaderboard row
 *     parameters:
 *       - name: rowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Platform user id (when type=user) or word text (when type=word), as returned on the leaderboard.
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *       - name: type
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [word, user], default: word }
 *     responses:
 *       '200':
 *         description: Vote history for the row.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 string: { type: string }
 *                 type: { type: string, enum: [word, user] }
 *                 total: { type: integer }
 *                 count: { type: integer }
 *                 votes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       value: { type: integer, enum: [1, -1] }
 *                       voterPlatformId: { type: string, nullable: true }
 *                       timestamp: { type: string, format: date-time }
 *       '400':
 *         description: Missing/invalid app parameter, missing rowId, or invalid type.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/leaderboards/plusplus/total:
 *   get:
 *     operationId: getPlusplusTotal
 *     tags: [Leaderboards]
 *     summary: Total plusplus score for a word or user
 *     parameters:
 *       - name: string
 *         in: query
 *         required: true
 *         schema: { type: string }
 *         description: Word text, or a platform user id when type=user.
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *       - name: type
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [word, user], default: word }
 *     responses:
 *       '200':
 *         description: Total score.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 string: { type: string }
 *                 type: { type: string, enum: [word, user] }
 *                 total: { type: integer }
 *       '400':
 *         description: Missing/invalid app parameter, missing string, or invalid type.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/leaderboards/plusplus/voter/{userId}:
 *   get:
 *     operationId: getPlusplusVoterStats
 *     tags: [Leaderboards]
 *     summary: Number of plusplus votes cast by a user
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Discord snowflake of the voter.
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *     responses:
 *       '200':
 *         description: Voter's total votes cast (0 if the voter has no chat_member_mapping row).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 voterId: { type: string }
 *                 total: { type: integer }
 *       '400':
 *         description: Missing/invalid app parameter, or missing userId.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/leaderboards/plusplus/top-voters:
 *   post:
 *     operationId: getPlusplusTopVoters
 *     tags: [Leaderboards]
 *     summary: Top plusplus voters by vote count
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               limit: { type: integer, default: 3, minimum: 1, maximum: 50 }
 *     responses:
 *       '200':
 *         description: Top voters by vote count.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 limit: { type: integer }
 *                 topVoters:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       voter: { type: string, description: "Platform user id (Discord snowflake)." }
 *                       total: { type: integer }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * Body: { limit?: number, offset?: number } (optional; default limit 5, max 50; default offset 0)
 * Auth: required.
 * @openapi
 * /api/leaderboards/emoji:
 *   post:
 *     operationId: getEmojiLeaderboard
 *     tags: [Leaderboards]
 *     summary: Top used emojis
 *     description: Paginated emoji usage leaderboard from emoji_frequency (emojis only, excludes stickers).
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit: { type: integer, default: 5, minimum: 1, maximum: 50 }
 *               offset: { type: integer, default: 0, minimum: 0 }
 *     responses:
 *       '200':
 *         description: Emoji usage page.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *                 total: { type: integer, description: "Total emoji rows (for pagination)." }
 *                 top:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       emoji: { type: string }
 *                       frequency: { type: integer }
 *                       emoid: { type: string }
 *                       animated: { type: integer, enum: [0, 1] }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/emoji", authenticate, async (req, res) => {
  try {
    const limit = leaderboards.parseLimit(req.body?.limit, 5, 50);
    const offset =
      req.body?.offset != null ? Math.max(0, parseInt(req.body.offset, 10) || 0) : 0;
    const { rows, total } = await leaderboards.listEmojiFrequency(limit, offset);
    res.json({ ok: true, limit, offset, total, top: rows });
  } catch (err) {
    console.error("POST /api/leaderboards/emoji error:", err);
    res.status(500).json({ ok: false, error: "Failed to get emoji leaderboard" });
  }
});

/**
 * POST /api/leaderboards/emoji/users
 * Top users by total emoji usage (paginated).
 * Body: { app: "discord", limit?: number, offset?: number } (default limit 50, max 50; default offset 0)
 * Auth: required.
 * @openapi
 * /api/leaderboards/emoji/users:
 *   post:
 *     operationId: getEmojiUserLeaderboard
 *     tags: [Leaderboards]
 *     summary: Top users by total emoji usage
 *     description: Paginated per-user emoji usage totals from user_emoji_tracking (emojis only, excludes stickers).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               limit: { type: integer, default: 50, minimum: 1, maximum: 50 }
 *               offset: { type: integer, default: 0, minimum: 0 }
 *     responses:
 *       '200':
 *         description: Per-user emoji usage totals page.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *                 total: { type: integer, description: "Total distinct users with emoji usage (for pagination)." }
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userid: { type: string, description: "Platform user id (Discord snowflake)." }
 *                       name: { type: string }
 *                       total: { type: integer }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/emoji/users", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const limit = leaderboards.parseLimit(req.body?.limit, 50, 50);
    const offset =
      req.body?.offset != null ? Math.max(0, parseInt(req.body.offset, 10) || 0) : 0;
    const { rows, total } = await leaderboards.listEmojiUsersByTotalUsage(
      limit,
      offset,
      app,
    );
    res.json({ ok: true, app, limit, offset, total, users: rows });
  } catch (err) {
    console.error("POST /api/leaderboards/emoji/users error:", err);
    res.status(500).json({ ok: false, error: "Failed to get emoji user leaderboard" });
  }
});

/**
 * POST /api/leaderboards/repost
 * Top reposters by accusation count (mirrors top-reposters command).
 * Body: { app: "discord", limit?: number } (optional, default 5, max 50)
 * Auth: required.
 * @openapi
 * /api/leaderboards/repost:
 *   post:
 *     operationId: getRepostLeaderboard
 *     tags: [Leaderboards]
 *     summary: Top reposters by accusation count
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               limit: { type: integer, default: 5, minimum: 1, maximum: 50 }
 *               from: { type: string, format: date-time, description: "Optional inclusive lower bound on accusation timestamp." }
 *               to: { type: string, format: date-time, description: "Optional inclusive upper bound on accusation timestamp." }
 *     responses:
 *       '200':
 *         description: Top reposters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 limit: { type: integer }
 *                 from: { type: string, nullable: true }
 *                 to: { type: string, nullable: true }
 *                 top:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userid: { type: string, description: "Platform user id (Discord snowflake)." }
 *                       count: { type: integer }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/leaderboards/repost/user/{userId}:
 *   get:
 *     operationId: getRepostUserStats
 *     tags: [Leaderboards]
 *     summary: Repost accusation count for a user
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Discord snowflake of the accused user.
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *     responses:
 *       '200':
 *         description: Repost accusation count (0 if the user has no chat_member_mapping row).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 userId: { type: string }
 *                 count: { type: integer }
 *       '400':
 *         description: Missing/invalid app parameter, or missing userId.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
 * @openapi
 * /api/leaderboards/emoji/user/{userId}:
 *   get:
 *     operationId: getEmojiUserStats
 *     tags: [Leaderboards]
 *     summary: Per-user emoji usage stats
 *     description: Emoji usage breakdown for one user from user_emoji_tracking (emojis only, excludes stickers).
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Discord snowflake of the user.
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *         description: Max rows to return, sorted by frequency descending. Omit for all rows.
 *     responses:
 *       '200':
 *         description: Emoji usage stats for the user (empty array if unknown user).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 app: { type: string }
 *                 userId: { type: string }
 *                 stats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       emoid: { type: string }
 *                       emoji: { type: string }
 *                       frequency: { type: integer }
 *                       animated: { type: boolean }
 *       '400':
 *         description: Missing/invalid app parameter.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/emoji/user/:userId", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const limit =
      req.query.limit != null
        ? leaderboards.parseLimit(req.query.limit, 50, 200)
        : undefined;
    const stats = await getEmojiStatsForUser(req.params.userId, app, limit);
    res.json({ ok: true, app, userId: req.params.userId, stats });
  } catch (err) {
    console.error("GET /api/leaderboards/emoji/user/:userId error:", err);
    res.status(500).json({ ok: false, error: "Failed to get user emoji stats" });
  }
});

export default router;
