import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  getSystemStatus,
  getCacheVersion,
  incrementCacheVersion,
  recordBotHeartbeat,
} from "../services/systemStatus.js";
import { recordAudit } from "../services/auditLog.js";

const router = express.Router();

/**
 * GET /api/system/status
 * System and bot health status.
 * Auth: required (admin, bot, or webview).
 * @openapi
 * /api/system/status:
 *   get:
 *     operationId: getSystemStatus
 *     tags: [System]
 *     summary: Get system and bot health status
 *     responses:
 *       '200':
 *         description: System status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 status:
 *                   type: object
 *                   properties:
 *                     webapi: { type: string, example: ok }
 *                     db: { type: string, example: ok }
 *                     cacheVersion: { type: string }
 *                     bot:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         guildId: { type: string }
 *                         version: { type: string }
 *                         lastSeenAt: { type: string }
 *                         online: { type: boolean }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/status", authenticate, async (req, res) => {
  try {
    const status = await getSystemStatus();
    res.json({ ok: true, status });
  } catch (err) {
    console.error("GET /api/system/status error:", err);
    res.status(500).json({ ok: false, error: "Failed to get system status" });
  }
});

/**
 * GET /api/system/cache-version
 * Current cache version for bot polling.
 * Auth: required (bot or admin).
 * @openapi
 * /api/system/cache-version:
 *   get:
 *     operationId: getCacheVersion
 *     tags: [System]
 *     summary: Get current cache version
 *     responses:
 *       '200':
 *         description: Current cache version.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 cacheVersion: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/cache-version", authenticate, async (req, res) => {
  try {
    const cacheVersion = await getCacheVersion();
    res.json({ ok: true, cacheVersion });
  } catch (err) {
    console.error("GET /api/system/cache-version error:", err);
    res.status(500).json({ ok: false, error: "Failed to get cache version" });
  }
});

/**
 * POST /api/system/invalidate-cache
 * Increment cache version so bots reload cached content.
 * Auth: admin required.
 * @openapi
 * /api/system/invalidate-cache:
 *   post:
 *     operationId: invalidateCache
 *     tags: [System]
 *     summary: Increment cache version
 *     description: Requires the admin role. Records an audit log entry.
 *     responses:
 *       '200':
 *         description: New cache version.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 cacheVersion: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/invalidate-cache", authenticate, requireAdmin, async (req, res) => {
  try {
    const cacheVersion = await incrementCacheVersion();
    await recordAudit(req.user.id, "invalidate", "system_cache", null, {
      cacheVersion,
    });
    res.json({ ok: true, cacheVersion });
  } catch (err) {
    console.error("POST /api/system/invalidate-cache error:", err);
    res.status(500).json({ ok: false, error: "Failed to invalidate cache" });
  }
});

/**
 * POST /api/system/heartbeat
 * Bot heartbeat (guild id, version, optional lastReadyAt).
 * Body: { guildId, version, lastReadyAt? }
 * Auth: required (bot or admin).
 * @openapi
 * /api/system/heartbeat:
 *   post:
 *     operationId: postHeartbeat
 *     tags: [System]
 *     summary: Record a bot heartbeat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guildId, version]
 *             properties:
 *               guildId: { type: string }
 *               version: { type: string }
 *               lastReadyAt: { type: string, nullable: true }
 *     responses:
 *       '200':
 *         description: Heartbeat recorded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/heartbeat", authenticate, async (req, res) => {
  try {
    const guildId = String(req.body?.guildId ?? "").trim();
    const version = String(req.body?.version ?? "").trim();
    if (!guildId || !version) {
      return res.status(400).json({
        ok: false,
        error: "guildId and version are required",
      });
    }
    await recordBotHeartbeat({ guildId, version, lastReadyAt: req.body?.lastReadyAt });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/system/heartbeat error:", err);
    res.status(500).json({ ok: false, error: "Failed to record heartbeat" });
  }
});

export default router;
