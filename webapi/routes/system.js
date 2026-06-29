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
 * Auth: admin required.
 */
router.get("/status", authenticate, requireAdmin, async (req, res) => {
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
