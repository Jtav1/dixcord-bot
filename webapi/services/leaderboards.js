/**
 * Leaderboard / stats queries. Mirrors data used by Discord commands:
 * plusplus-leaderboard, plusplus-total, plusplus-voter-frequency, plusplus-top-voters,
 * top-emojis, top-reposters, reposts-by-user.
 * Uses webapi config/db.js (MySQL or SQLite).
 * Responses expose discord_id where the Discord bot expects snowflakes (userid, string, voter).
 */

import db from "../config/db.js";
import {
  getChatMemberIdColumn,
  getChatMemberMappingIdByPlatformUserId,
  isChatMemberAppSupported,
} from "./chatMemberMapping.js";

/**
 * Normalize limit from API request (number or string). Clamps to [1, max].
 * @param {number|string} value
 * @param {number} [defaultN=5]
 * @param {number} [max=50]
 * @returns {number}
 */
export function parseLimit(value, defaultN = 5, max = 50) {
  const n = value == null ? defaultN : parseInt(value, 10);
  return Math.min(Math.max(1, Number.isNaN(n) ? defaultN : n), max);
}

/**
 * Parse optional ISO datetime to SQL datetime string for WHERE clauses.
 * @param {unknown} value
 * @returns {string|null}
 */
export function parseTimeFilter(value) {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Build SQL time-range clause for plusplus_tracking.
 * @param {{ from?: unknown, to?: unknown }} range
 * @returns {{ clause: string, params: Array<string> }}
 */
function buildPlusplusTimeClause(range = {}) {
  const parts = [];
  const params = [];
  const from = parseTimeFilter(range.from);
  const to = parseTimeFilter(range.to);
  if (from) {
    parts.push("pt.timestamp >= ?");
    params.push(from);
  }
  if (to) {
    parts.push("pt.timestamp <= ?");
    params.push(to);
  }
  return {
    clause: parts.length ? ` AND ${parts.join(" AND ")}` : "",
    params,
  };
}

// --- Plusplus (plusplus_tracking) ---

/**
 * Load all plusplus rows, aggregate scores, resolve user targets via chat_member_mapping id column for `app`.
 * @param {string} app - e.g. "discord"
 * @returns {Promise<Array<{ string: string, typestr: string, total: number }>>}
 */
async function aggregatePlusPlusLeaderboard(app, range = {}) {
  if (!isChatMemberAppSupported(app)) return [];
  const idCol = getChatMemberIdColumn(app);
  const { clause, params } = buildPlusplusTimeClause(range);

  let [results] = await db.query(
    `SELECT
        pt.type AS typestr,
        SUM(pt.value) AS total,
        CASE
            WHEN pt.type = 'user' THEN (
                SELECT cmm.\`${idCol}\` 
                FROM chat_member_mapping cmm
                WHERE cmm.id = CAST(pt.string AS INTEGER) 
            )
            ELSE pt.string
        END AS string
      FROM plusplus_tracking pt
      WHERE 1=1${clause}
      GROUP BY pt.string, pt.type
      ORDER BY total DESC`,
    params,
  );

  return [...results];
}

/**
 * @param {number} [limit]
 * @param {string} app - chat app id (e.g. "discord")
 * @returns {Promise<Array<{ string, typestr, total }>>}
 */
export async function getPlusPlusTopScores(limit, app, range = {}) {
  const n = parseLimit(limit, 5, 50);
  const aggregated = await aggregatePlusPlusLeaderboard(app, range);
  aggregated.sort((a, b) => b.total - a.total);
  return aggregated.slice(0, n);
}

/**
 * @param {number} [limit]
 * @param {string} app - chat app id (e.g. "discord")
 * @returns {Promise<Array<{ string, typestr, total }>>}
 */
export async function getPlusPlusBottomScores(limit, app, range = {}) {
  const n = parseLimit(limit, 5, 50);
  const aggregated = await aggregatePlusPlusLeaderboard(app, range);
  return aggregated.slice(-n);
}

/**
 * @param {string} string - word text, or user snowflake when type is 'user'
 * @param {string} [type='word']
 * @param {string} app - e.g. "discord"
 * @returns {Promise<{ string, type, total }|null>}
 */
export async function getPlusPlusTotalByString(string, type = "word", app) {
  if (!string || (type !== "word" && type !== "user")) return null;
  if (!isChatMemberAppSupported(app)) return null;

  if (type === "user") {
    const mid = await getChatMemberMappingIdByPlatformUserId(string, app);
    if (mid == null) return { string, type, total: 0 };

    const [rows] = await db.query(
      `SELECT SUM(CAST(value AS INT)) AS total FROM plusplus_tracking WHERE type = 'user' AND string = ?`,
      [mid],
    );
    const total = rows?.[0]?.total ?? 0;
    return { string, type, total: total == null ? 0 : Number(total) };
  }

  const [rows] = await db.query(
    `SELECT SUM(CAST(value AS INT)) AS total FROM plusplus_tracking WHERE string = ? AND type = 'word'`,
    [String(string)],
  );
  const total = rows?.[0]?.total ?? 0;
  return { string, type, total: total == null ? 0 : Number(total) };
}

/**
 * @param {string} rowId - platform user id (user) or word text (word), as shown on the leaderboard
 * @param {string} [type='word'] - `word` or `user`
 * @param {string} app - e.g. "discord"
 * @returns {Promise<{ string: string, type: string, total: number, votes: Array<{ id: number, value: number, voterPlatformId: string|null, timestamp: string }> }|null>}
 */
export async function getPlusPlusVoteHistoryByRowId(rowId, type = "word", app) {
  if (!rowId || (type !== "word" && type !== "user")) return null;
  if (!isChatMemberAppSupported(app)) return null;

  const idCol = getChatMemberIdColumn(app);
  const typestr = type === "user" ? "user" : "word";
  let stringKey;

  if (type === "user") {
    const mid = await getChatMemberMappingIdByPlatformUserId(rowId, app);
    if (mid == null) {
      return { string: String(rowId), type, total: 0, votes: [] };
    }
    stringKey = String(mid);
  } else {
    stringKey = String(rowId);
  }

  const [rows] = await db.query(
    `SELECT pt.id, pt.value, pt.timestamp, cm_v.\`${idCol}\` AS voter_platform_id
     FROM plusplus_tracking pt
     LEFT JOIN chat_member_mapping cm_v ON pt.voter = cm_v.id
     WHERE pt.type = ? AND pt.string = ?
     ORDER BY pt.timestamp ASC, pt.id ASC`,
    [typestr, stringKey],
  );

  const votes = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: Number(row.id),
    value: Number(row.value),
    voterPlatformId: row.voter_platform_id ?? null,
    timestamp: row.timestamp,
  }));

  const total = votes.reduce((sum, vote) => sum + vote.value, 0);

  return {
    string: String(rowId),
    type,
    total,
    votes,
  };
}

/**
 * @param {string} voterId - platform user id (e.g. Discord snowflake)
 * @param {string} app - e.g. "discord"
 * @returns {Promise<{ voterId: string, total: number }|null>}
 */
export async function getPlusPlusVotesByVoter(voterId, app) {
  if (!voterId) return null;
  if (!isChatMemberAppSupported(app)) return null;
  const mid = await getChatMemberMappingIdByPlatformUserId(voterId, app);
  if (mid == null) return { voterId: String(voterId), total: 0 };
  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM plusplus_tracking WHERE voter = ?",
    [mid],
  );
  const total = rows?.[0]?.total ?? 0;
  return { voterId: String(voterId), total: Number(total) };
}

/**
 * @param {number} [limit]
 * @param {string} app - e.g. "discord"
 * @returns {Promise<Array<{ voter: string, total: number }>>} voter is platform id from id column
 */
export async function getPlusPlusTopVoters(limit, app) {
  if (!isChatMemberAppSupported(app)) return [];
  const idCol = getChatMemberIdColumn(app);
  const n = parseLimit(limit, 3, 50);
  const [rows] = await db.query(
    `SELECT cm.\`${idCol}\` AS voter, COUNT(*) AS total
     FROM plusplus_tracking p
     INNER JOIN chat_member_mapping cm ON p.voter = cm.id
     GROUP BY cm.\`${idCol}\`, cm.id
     ORDER BY total DESC
     LIMIT ?`,
    [n],
  );
  return Array.isArray(rows) ? rows : [];
}

// --- Emoji (emoji_frequency) ---

/**
 * @param {number} [limit]
 * @returns {Promise<Array<{ emoji, frequency, emoid, animated }>>}
 */
export async function getTopEmoji(limit) {
  const n = parseLimit(limit, 5, 50);
  const [rows] = await db.query(
    `SELECT emoji, frequency, emoid, animated FROM emoji_frequency
     WHERE type = 'emoji' OR type IS NULL
     ORDER BY frequency DESC LIMIT ?`,
    [n],
  );
  return Array.isArray(rows) ? rows : [];
}

// --- Repost (user_repost_tracking) ---

/**
 * @param {number} [limit]
 * @param {string} app - e.g. "discord"
 * @returns {Promise<Array<{ userid: string, count: number }>>} userid is platform id from id column
 */
export async function getTopReposters(limit, app, range = {}) {
  if (!isChatMemberAppSupported(app)) return [];
  const idCol = getChatMemberIdColumn(app);
  const n = parseLimit(limit, 5, 50);
  const parts = [];
  const params = [];
  const from = parseTimeFilter(range.from);
  const to = parseTimeFilter(range.to);
  if (from) {
    parts.push("r.timestamp >= ?");
    params.push(from);
  }
  if (to) {
    parts.push("r.timestamp <= ?");
    params.push(to);
  }
  const where = parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
  params.push(n);
  const [rows] = await db.query(
    `SELECT cm.\`${idCol}\` AS userid, COUNT(*) AS count
     FROM user_repost_tracking r
     INNER JOIN chat_member_mapping cm ON r.userid = cm.id
     ${where}
     GROUP BY cm.\`${idCol}\`, cm.id
     ORDER BY count DESC
     LIMIT ?`,
    params,
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {string} userId - platform user id (e.g. Discord snowflake)
 * @param {string} app - e.g. "discord"
 * @returns {Promise<{ userId: string, count: number }|null>}
 */
export async function getRepostsForUser(userId, app) {
  if (!userId) return null;
  if (!isChatMemberAppSupported(app)) return null;

  const mid = await getChatMemberMappingIdByPlatformUserId(userId, app);
  if (mid == null) return { userId: String(userId), count: 0 };

  const [rows] = await db.query(
    "SELECT COUNT(*) AS count FROM user_repost_tracking WHERE userid = ?",
    [mid],
  );
  const count = rows?.[0]?.count ?? 0;
  return { userId: String(userId), count: Number(count) };
}
