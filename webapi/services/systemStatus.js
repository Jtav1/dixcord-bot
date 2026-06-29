/**
 * System status, bot heartbeat, and config cache versioning.
 */

import db from "../config/db.js";

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
 * Record bot heartbeat.
 * @param {{ guildId: string, version: string, lastReadyAt?: string }} payload
 * @returns {Promise<void>}
 */
export async function recordBotHeartbeat(payload) {
  const guildId = String(payload.guildId ?? "").trim();
  const version = String(payload.version ?? "").trim();
  if (!guildId) return;

  const [rows] = await db.query(
    "SELECT id FROM bot_status WHERE guild_id = ?",
    [guildId],
  );

  if (rows && rows.length > 0) {
    await db.query(
      "UPDATE bot_status SET version = ?, last_seen_at = CURRENT_TIMESTAMP WHERE guild_id = ?",
      [version, guildId],
    );
  } else {
    await db.query(
      "INSERT INTO bot_status (guild_id, version, last_seen_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
      [guildId, version],
    );
  }
}

/**
 * Get system status for admin monitoring.
 * @returns {Promise<{ webapi: string, db: string, cacheVersion: string, bot: object|null }>}
 */
export async function getSystemStatus() {
  let dbStatus = "ok";
  try {
    await db.query("SELECT 1");
  } catch {
    dbStatus = "error";
  }

  const cacheVersion = await getCacheVersion();

  const [botRows] = await db.query(
    "SELECT guild_id, version, last_seen_at FROM bot_status ORDER BY last_seen_at DESC LIMIT 1",
  );
  const botRow = botRows?.[0] ?? null;

  let bot = null;
  if (botRow) {
    const lastSeen = new Date(botRow.last_seen_at);
    const ageMs = Date.now() - lastSeen.getTime();
    bot = {
      guildId: String(botRow.guild_id),
      version: String(botRow.version),
      lastSeenAt: botRow.last_seen_at,
      online: ageMs < 120_000,
    };
  }

  return {
    webapi: "ok",
    db: dbStatus,
    cacheVersion,
    bot,
  };
}
