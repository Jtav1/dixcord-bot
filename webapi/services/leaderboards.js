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

// --- Plusplus (plusplus_tracking) ---

/**
 * @param {unknown} v
 * @returns {number}
 */
function parsePlusplusValue(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Load all plusplus rows, aggregate scores, resolve user targets via chat_member_mapping id column for `app`.
 * @param {string} app - e.g. "discord"
 * @returns {Promise<Array<{ string: string, typestr: string, total: number }>>}
 */
async function aggregatePlusPlusLeaderboard(app) {
  if (!isChatMemberAppSupported(app)) return [];
  const idCol = getChatMemberIdColumn(app);

  const [rows] = await db.query(
    "SELECT type, string, value FROM plusplus_tracking",
  );
  const list = Array.isArray(rows) ? rows : [];

  const userDiscordIds = [
    ...new Set(
      list
        .filter((r) => r && String(r.type) === "user" && r.string != null)
        .map((r) => String(r.string).trim())
        .filter((s) => s.length > 0),
    ),
  ];

  /** Resolved platform id from chat_member_mapping (same as key); missing keys fall back to raw string */
  const resolvedPlatformId = new Map();
  if (userDiscordIds.length > 0) {
    const placeholders = userDiscordIds.map(() => "?").join(", ");
    const [mapRows] = await db.query(
      `SELECT \`${idCol}\` AS platform_uid FROM chat_member_mapping WHERE \`${idCol}\` IN (${placeholders})`,
      userDiscordIds,
    );
    for (const m of mapRows ?? []) {
      const id = String(m.platform_uid);
      resolvedPlatformId.set(id, id);
    }
  }

  /** @type {Map<string, { typestr: string, displayString: string, total: number }>} */
  const groups = new Map();

  for (const r of list) {
    const type = r && r.type != null ? String(r.type) : "";
    const val = parsePlusplusValue(r?.value);

    if (type === "word") {
      const word = String(r.string ?? "");
      const key = `word:${word}`;
      const prev = groups.get(key) ?? {
        typestr: "word",
        displayString: word,
        total: 0,
      };
      prev.total += val;
      groups.set(key, prev);
    } else if (type === "user") {
      const raw = String(r.string ?? "").trim();
      if (!raw) continue;
      const display =
        resolvedPlatformId.has(raw) ? resolvedPlatformId.get(raw) : raw;
      const key = `user:${display}`;
      const prev = groups.get(key) ?? {
        typestr: "user",
        displayString: display,
        total: 0,
      };
      prev.total += val;
      groups.set(key, prev);
    }
  }

  return [...groups.values()].map((g) => ({
    string: g.displayString,
    typestr: g.typestr,
    total: g.total,
  }));
}

/**
 * @param {number} [limit]
 * @param {string} app - chat app id (e.g. "discord")
 * @returns {Promise<Array<{ string, typestr, total }>>}
 */
export async function getPlusPlusTopScores(limit, app) {
  const n = parseLimit(limit, 5, 50);
  const aggregated = await aggregatePlusPlusLeaderboard(app);
  aggregated.sort((a, b) => b.total - a.total);
  return aggregated.slice(0, n);
}

/**
 * @param {number} [limit]
 * @param {string} app - chat app id (e.g. "discord")
 * @returns {Promise<Array<{ string, typestr, total }>>}
 */
export async function getPlusPlusBottomScores(limit, app) {
  const n = parseLimit(limit, 5, 50);
  const aggregated = await aggregatePlusPlusLeaderboard(app);
  aggregated.sort((a, b) => a.total - b.total);
  return aggregated.slice(0, n);
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
export async function getTopReposters(limit, app) {
  if (!isChatMemberAppSupported(app)) return [];
  const idCol = getChatMemberIdColumn(app);
  const n = parseLimit(limit, 5, 50);
  const [rows] = await db.query(
    `SELECT cm.\`${idCol}\` AS userid, COUNT(*) AS count
     FROM user_repost_tracking r
     INNER JOIN chat_member_mapping cm ON r.userid = cm.id
     GROUP BY cm.\`${idCol}\`, cm.id
     ORDER BY count DESC
     LIMIT ?`,
    [n],
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
