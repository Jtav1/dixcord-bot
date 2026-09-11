/**
 * System status, bot heartbeat, and config cache versioning.
 */

import db from "../config/db.js";
import { utcIsoToSqlDatetime } from "./scheduledMessages.js";

const CACHE_VERSION_KEY = "cache_version";

/**
 * Ensure system_state row exists for cache versioning.
 * @returns {Promise<void>}
 */
export async function ensureSystemState() {
  const [rows] = await db.query(
    "SELECT state_key FROM system_state WHERE state_key = ?",
    [CACHE_VERSION_KEY],
  );
  if (!rows || rows.length === 0) {
    await db.query(
      "INSERT INTO system_state (state_key, state_value) VALUES (?, ?)",
      [CACHE_VERSION_KEY, "1"],
    );
  }
}

/**
 * Get current cache version string.
 * @returns {Promise<string>}
 */
export async function getCacheVersion() {
  await ensureSystemState();
  const [rows] = await db.query(
    "SELECT state_value FROM system_state WHERE state_key = ?",
    [CACHE_VERSION_KEY],
  );
  return rows?.[0]?.state_value ?? "1";
}

/**
 * Increment cache version to signal bots to reload cached config/content.
 * @returns {Promise<string>} New version value
 */
export async function incrementCacheVersion() {
  await ensureSystemState();
  const current = await getCacheVersion();
  const next = String(Number(current) + 1);
  await db.query(
    "UPDATE system_state SET state_value = ?, updated_at = CURRENT_TIMESTAMP WHERE state_key = ?",
    [next, CACHE_VERSION_KEY],
  );
  return next;
}

/**
 * Serialize the bot's cumulative counter snapshot for storage in bot_status.metrics_json.
 * @param {unknown} metrics
 * @returns {string|null}
 */
function serializeBotMetricsForStorage(metrics) {
  if (metrics == null || typeof metrics !== "object" || Array.isArray(metrics))
    return null;
  return JSON.stringify(metrics);
}

/**
 * Record bot heartbeat.
 * @param {{ guildId: string, version: string, readyAt?: string|null, memberCount?: number|null, channelCount?: number|null, wsPingMs?: number|null, metrics?: Record<string, unknown>|null }} payload
 * @returns {Promise<void>}
 */
export async function recordBotHeartbeat(payload) {
  const guildId = String(payload.guildId ?? "").trim();
  const version = String(payload.version ?? "").trim();
  if (!guildId) return;

  const readyAtSql = payload.readyAt
    ? utcIsoToSqlDatetime(payload.readyAt)
    : null;
  const memberCount = Number.isFinite(Number(payload.memberCount))
    ? Number(payload.memberCount)
    : null;
  const channelCount = Number.isFinite(Number(payload.channelCount))
    ? Number(payload.channelCount)
    : null;
  const wsPingMs = Number.isFinite(Number(payload.wsPingMs))
    ? Number(payload.wsPingMs)
    : null;
  const metricsJson = serializeBotMetricsForStorage(payload.metrics);

  const [rows] = await db.query(
    "SELECT id FROM bot_status WHERE guild_id = ?",
    [guildId],
  );

  if (rows && rows.length > 0) {
    await db.query(
      `UPDATE bot_status
       SET version = ?, last_seen_at = CURRENT_TIMESTAMP, ready_at = ?, member_count = ?, channel_count = ?, ws_ping_ms = ?, metrics_json = ?
       WHERE guild_id = ?`,
      [version, readyAtSql, memberCount, channelCount, wsPingMs, metricsJson, guildId],
    );
  } else {
    await db.query(
      `INSERT INTO bot_status (guild_id, version, last_seen_at, ready_at, member_count, channel_count, ws_ping_ms, metrics_json)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)`,
      [guildId, version, readyAtSql, memberCount, channelCount, wsPingMs, metricsJson],
    );
  }
}

/**
 * Get system status for admin monitoring.
 * @returns {Promise<{ webapi: string, db: string, dbType: string, cacheVersion: string, webapiUptimeSeconds: number, webapiMemoryRssBytes: number, bot: object|null }>}
 */
export async function getSystemStatus() {
  let dbStatus = "ok";
  try {
    await db.query("SELECT 1");
  } catch {
    dbStatus = "error";
  }

  const dbType = (process.env.DB_TYPE || "mysql").toLowerCase();
  const cacheVersion = await getCacheVersion();

  const [botRows] = await db.query(
    "SELECT guild_id, version, last_seen_at, ready_at, member_count, channel_count, ws_ping_ms FROM bot_status ORDER BY last_seen_at DESC LIMIT 1",
  );
  const botRow = botRows?.[0] ?? null;

  let bot = null;
  if (botRow) {
    const lastSeen = new Date(botRow.last_seen_at);
    const ageMs = Date.now() - lastSeen.getTime();
    const readyAt = botRow.ready_at ? new Date(botRow.ready_at) : null;
    const uptimeSeconds =
      readyAt && !Number.isNaN(readyAt.getTime())
        ? Math.max(0, Math.floor((Date.now() - readyAt.getTime()) / 1000))
        : null;
    bot = {
      guildId: String(botRow.guild_id),
      version: String(botRow.version),
      lastSeenAt: botRow.last_seen_at,
      online: ageMs < 120_000,
      readyAt: botRow.ready_at ?? null,
      uptimeSeconds,
      memberCount: botRow.member_count == null ? null : Number(botRow.member_count),
      channelCount:
        botRow.channel_count == null ? null : Number(botRow.channel_count),
      wsPingMs: botRow.ws_ping_ms == null ? null : Number(botRow.ws_ping_ms),
    };
  }

  return {
    webapi: "ok",
    db: dbStatus,
    dbType,
    cacheVersion,
    webapiUptimeSeconds: Math.floor(process.uptime()),
    webapiMemoryRssBytes: process.memoryUsage().rss,
    bot,
  };
}
