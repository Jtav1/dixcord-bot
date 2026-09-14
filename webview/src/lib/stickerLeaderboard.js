import { API_BASE } from "./api.js";
import { resolveUserLabel } from "./emojiLeaderboard.js";

/** Sticker leaderboard rows shown per page. */
export const STICKER_PAGE_SIZE = 50;

/** Per-user sticker leaderboard rows shown per page. */
export const STICKER_USER_PAGE_SIZE = STICKER_PAGE_SIZE;

export { resolveUserLabel };

/**
 * Parse a fetch Response as JSON, with a clear error when the body is not JSON.
 * @param {Response} res Fetch response.
 * @param {string} context Label for error messages.
 * @returns {Promise<unknown>}
 */
async function parseJsonResponse(res, context) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `${context}: expected JSON but got ${contentType || "unknown content type"}`,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${context}: invalid JSON response`);
  }
}

/**
 * Fetch one page of the sticker usage leaderboard from webapi.
 * @param {number} [offset=0] Rows to skip.
 * @param {number} [limit=STICKER_PAGE_SIZE] Page size (max 50).
 * @returns {Promise<{ entries: Array<{ emoji: { emoid: string, app: string, emoji: string, frequency: number, animated: number, type: string } }>, total: number, limit: number, offset: number }>} each row's `emoji` is the full emoji_frequency row — use `.emoji.emoji` for the name, `.emoji.frequency` for its count.
 */
export async function fetchStickerLeaderboardPage(
  offset = 0,
  limit = STICKER_PAGE_SIZE,
) {
  const res = await fetch(`${API_BASE}/leaderboards/sticker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit, offset }),
  });

  if (!res.ok) {
    throw new Error(`Failed to load sticker leaderboard (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Sticker leaderboard");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load sticker leaderboard");
  }

  return {
    entries: Array.isArray(data.top) ? data.top : [],
    total: Number(data.total) || 0,
    limit: Number(data.limit) || limit,
    offset: Number(data.offset) || offset,
  };
}

/**
 * Fetch one page of the per-user sticker usage leaderboard from webapi.
 * @param {number} [offset=0] Rows to skip.
 * @param {number} [limit=STICKER_USER_PAGE_SIZE] Page size (max 50).
 * @returns {Promise<{ entries: Array<{ userid: string, name: string, total: number }>, total: number, limit: number, offset: number }>}
 */
export async function fetchStickerUserLeaderboardPage(
  offset = 0,
  limit = STICKER_USER_PAGE_SIZE,
) {
  const res = await fetch(`${API_BASE}/leaderboards/sticker/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app: "discord", limit, offset }),
  });

  if (!res.ok) {
    throw new Error(`Failed to load sticker user leaderboard (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Sticker user leaderboard");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load sticker user leaderboard");
  }

  return {
    entries: Array.isArray(data.users) ? data.users : [],
    total: Number(data.total) || 0,
    limit: Number(data.limit) || limit,
    offset: Number(data.offset) || offset,
  };
}

/**
 * Fetch full per-user sticker frequency breakdown from webapi.
 * @param {string} userId Discord snowflake.
 * @param {string} [app="discord"] Chat app id.
 * @returns {Promise<Array<{ frequency: number, emoji: { emoid: string, app: string, emoji: string, frequency: number, animated: number, type: string } }>>} `frequency` is this user's own usage count; `emoji` is the full emoji_frequency row (its own `frequency` is the sticker's global count, a different number).
 */
export async function fetchUserStickerStats(userId, app = "discord") {
  const params = new URLSearchParams({ app });
  const res = await fetch(
    `${API_BASE}/leaderboards/sticker/user/${encodeURIComponent(userId)}?${params}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to load user sticker stats (${res.status})`);
  }

  const data = await parseJsonResponse(res, "User sticker stats");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load user sticker stats");
  }

  return Array.isArray(data.stats) ? data.stats : [];
}

/**
 * Local image URL for a sticker (every row is a custom asset, unlike emoji which can be unicode).
 * @param {{ emoji?: string }|null|undefined} emoji Resolved emoji object (emoji_frequency row).
 * @returns {string}
 */
export function stickerImageUrl(emoji) {
  const name = String(emoji?.emoji ?? "");
  return `/files/Stickers/${encodeURIComponent(name)}.png`;
}

/**
 * Human-readable sticker label for the name column.
 * @param {{ emoji?: string }|null|undefined} emoji Resolved emoji object (emoji_frequency row).
 * @returns {string}
 */
export function stickerDisplayName(emoji) {
  return String(emoji?.emoji ?? "");
}
