/**
 * Raw event log queries for admin analytics.
 */

import db from "../config/db.js";
import {
  getChatMemberMappingIdByPlatformUserId,
  isChatMemberAppSupported,
} from "./chatMemberMapping.js";
import { attachEmojiObjects } from "./emojiFrequency.js";
import { parseLimit, representativePlatformIdSubquery } from "./leaderboards.js";

/**
 * Parse optional ISO datetime query param to SQL datetime string.
 * @param {unknown} value
 * @returns {string|null}
 */
function parseFromTo(value) {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * List raw plusplus tracking events.
 * @param {{ app?: string, from?: string, to?: string, limit?: number, offset?: number }} opts
 * @returns {Promise<{ events: Array<object>, total: number }>}
 */
export async function listPlusplusEvents(opts = {}) {
  const app = opts.app ?? "discord";
  if (!isChatMemberAppSupported(app)) return { events: [], total: 0 };

  const limit = parseLimit(opts.limit, 50, 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const fromSql = parseFromTo(opts.from);
  const toSql = parseFromTo(opts.to);

  const where = [];
  const params = [];
  if (fromSql) {
    where.push("pt.timestamp >= ?");
    params.push(fromSql);
  }
  if (toSql) {
    where.push("pt.timestamp <= ?");
    params.push(toSql);
  }
  const whereClause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM plusplus_tracking pt${whereClause}`,
    params,
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT pt.id, pt.type, pt.string, pt.value, pt.timestamp,
            ${representativePlatformIdSubquery("pt.voter")} AS voter_platform_id
     FROM plusplus_tracking pt
     ${whereClause}
     ORDER BY pt.timestamp DESC, pt.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const events = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: Number(row.id),
    type: String(row.type),
    string: row.string,
    value: row.value,
    voterPlatformId: row.voter_platform_id ?? null,
    timestamp: row.timestamp,
  }));

  return { events, total };
}

/**
 * List repost tracking events with optional user filter.
 * @param {{ app?: string, userId?: string, from?: string, to?: string, limit?: number, offset?: number }} opts
 * @returns {Promise<{ events: Array<object>, total: number }>}
 */
export async function listRepostEvents(opts = {}) {
  const app = opts.app ?? "discord";
  if (!isChatMemberAppSupported(app)) return { events: [], total: 0 };

  const limit = parseLimit(opts.limit, 50, 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const fromSql = parseFromTo(opts.from);
  const toSql = parseFromTo(opts.to);

  const where = [];
  const params = [];

  if (opts.userId) {
    const mid = await getChatMemberMappingIdByPlatformUserId(opts.userId, app);
    if (mid == null) return { events: [], total: 0 };
    where.push("r.userid = ?");
    params.push(mid);
  }
  if (fromSql) {
    where.push("r.timestamp >= ?");
    params.push(fromSql);
  }
  if (toSql) {
    where.push("r.timestamp <= ?");
    params.push(toSql);
  }

  const whereClause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM member_repost_tracking r${whereClause}`,
    params,
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT r.id, r.msgid, r.msgcontents, r.timestamp,
            ${representativePlatformIdSubquery("r.userid")} AS userid_platform_id,
            ${representativePlatformIdSubquery("r.accuser")} AS accuser_platform_id
     FROM member_repost_tracking r
     ${whereClause}
     ORDER BY r.timestamp DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const events = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: Number(row.id),
    msgid: String(row.msgid),
    msgcontents: row.msgcontents,
    useridPlatformId: row.userid_platform_id != null ? String(row.userid_platform_id) : null,
    accuserPlatformId: row.accuser_platform_id != null ? String(row.accuser_platform_id) : null,
    timestamp: row.timestamp,
  }));

  return { events, total };
}

const EMOJI_FREQUENCY_WHERE = "ge.type = 'emoji' OR ge.type IS NULL";

/**
 * Per-user emoji usage stats (emojis only, excludes stickers).
 * @param {string} userId - platform user id
 * @param {string} app
 * @param {number} [limit] When omitted, returns all rows.
 * @returns {Promise<Array<{ frequency: number, emoji: object }>>} `frequency` is this user's own usage count (member_emoji_tracking); `emoji` is the full guild_emojis row (see attachEmojiObjects) — its own `frequency` is the emoji's global count, a different number.
 */
export async function getEmojiStatsForUser(userId, app, limit) {
  if (!isChatMemberAppSupported(app)) return [];
  const mid = await getChatMemberMappingIdByPlatformUserId(userId, app);
  if (mid == null) return [];

  const sql = `SELECT uet.emoid, uet.frequency
     FROM member_emoji_tracking uet
     INNER JOIN guild_emojis ge ON uet.emoid = ge.id
     WHERE uet.userid = ? AND (${EMOJI_FREQUENCY_WHERE})
     ORDER BY uet.frequency DESC`;

  const params = [mid];
  if (limit != null) {
    params.push(parseLimit(limit, 50, 200));
  }

  const [rows] = await db.query(
    limit != null ? `${sql} LIMIT ?` : sql,
    params,
  );

  const parsed = (Array.isArray(rows) ? rows : []).map((row) => ({
    emoid: String(row.emoid),
    frequency: Number(row.frequency),
  }));
  return attachEmojiObjects(parsed);
}

const STICKER_FREQUENCY_WHERE = "ge.type = 'sticker'";

/**
 * Per-user sticker usage stats.
 * @param {string} userId - platform user id
 * @param {string} app
 * @param {number} [limit] When omitted, returns all rows.
 * @returns {Promise<Array<{ frequency: number, emoji: object }>>} `frequency` is this user's own usage count (member_emoji_tracking); `emoji` is the full guild_emojis row (see attachEmojiObjects) — its own `frequency` is the sticker's global count, a different number.
 */
export async function getStickerStatsForUser(userId, app, limit) {
  if (!isChatMemberAppSupported(app)) return [];
  const mid = await getChatMemberMappingIdByPlatformUserId(userId, app);
  if (mid == null) return [];

  const sql = `SELECT uet.emoid, uet.frequency
     FROM member_emoji_tracking uet
     INNER JOIN guild_emojis ge ON uet.emoid = ge.id
     WHERE uet.userid = ? AND (${STICKER_FREQUENCY_WHERE})
     ORDER BY uet.frequency DESC`;

  const params = [mid];
  if (limit != null) {
    params.push(parseLimit(limit, 50, 200));
  }

  const [rows] = await db.query(
    limit != null ? `${sql} LIMIT ?` : sql,
    params,
  );

  const parsed = (Array.isArray(rows) ? rows : []).map((row) => ({
    emoid: String(row.emoid),
    frequency: Number(row.frequency),
  }));
  return attachEmojiObjects(parsed);
}

/**
 * List sticker catalog from guild_emojis where type = sticker, ranked by usage.
 * @param {number} [limit]
 * @returns {Promise<Array<{ emoji: object }>>} `emoji` is the full guild_emojis row (see attachEmojiObjects).
 */
export async function listStickerCatalog(limit) {
  const n = parseLimit(limit, 50, 200);
  const [rows] = await db.query(
    `SELECT id AS emoid FROM guild_emojis
     WHERE type = 'sticker'
     ORDER BY frequency DESC
     LIMIT ?`,
    [n],
  );
  return attachEmojiObjects(Array.isArray(rows) ? rows : []);
}
