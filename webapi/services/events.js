/**
 * Raw event log queries for admin analytics.
 */

import db from "../config/db.js";
import {
  getChatMemberIdColumn,
  getChatMemberMappingIdByPlatformUserId,
  isChatMemberAppSupported,
} from "./chatMemberMapping.js";
import { parseLimit } from "./leaderboards.js";

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

  const idCol = getChatMemberIdColumn(app);
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
            cm_v.\`${idCol}\` AS voter_platform_id
     FROM plusplus_tracking pt
     LEFT JOIN chat_member_mapping cm_v ON pt.voter = cm_v.id
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

  const idCol = getChatMemberIdColumn(app);
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
    `SELECT COUNT(*) AS total FROM user_repost_tracking r${whereClause}`,
    params,
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT r.id, r.msgid, r.msgcontents, r.timestamp,
            cm_u.\`${idCol}\` AS userid_platform_id,
            cm_a.\`${idCol}\` AS accuser_platform_id
     FROM user_repost_tracking r
     INNER JOIN chat_member_mapping cm_u ON r.userid = cm_u.id
     INNER JOIN chat_member_mapping cm_a ON r.accuser = cm_a.id
     ${whereClause}
     ORDER BY r.timestamp DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const events = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: Number(row.id),
    msgid: String(row.msgid),
    msgcontents: row.msgcontents,
    useridPlatformId: String(row.userid_platform_id),
    accuserPlatformId: String(row.accuser_platform_id),
    timestamp: row.timestamp,
  }));

  return { events, total };
}

/**
 * Per-user emoji usage stats.
 * @param {string} userId - platform user id
 * @param {string} app
 * @param {number} [limit]
 * @returns {Promise<Array<{ emoid: string, emoji: string, frequency: number, animated: boolean }>>}
 */
export async function getEmojiStatsForUser(userId, app, limit) {
  if (!isChatMemberAppSupported(app)) return [];
  const mid = await getChatMemberMappingIdByPlatformUserId(userId, app);
  if (mid == null) return [];

  const n = parseLimit(limit, 50, 200);
  const [rows] = await db.query(
    `SELECT uet.emoid, ef.emoji, uet.frequency, ef.animated
     FROM user_emoji_tracking uet
     INNER JOIN emoji_frequency ef ON uet.emoid = ef.emoid
     WHERE uet.userid = ?
     ORDER BY uet.frequency DESC
     LIMIT ?`,
    [mid, n],
  );

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    emoid: String(row.emoid),
    emoji: String(row.emoji),
    frequency: Number(row.frequency),
    animated: Boolean(row.animated),
  }));
}

/**
 * List sticker catalog from emoji_frequency where type = sticker.
 * @param {number} [limit]
 * @returns {Promise<Array<{ emoid: string, name: string, frequency: number }>>}
 */
export async function listStickerCatalog(limit) {
  const n = parseLimit(limit, 50, 200);
  const [rows] = await db.query(
    `SELECT emoid, emoji AS name, frequency FROM emoji_frequency
     WHERE type = 'sticker'
     ORDER BY frequency DESC
     LIMIT ?`,
    [n],
  );
  return Array.isArray(rows) ? rows : [];
}
