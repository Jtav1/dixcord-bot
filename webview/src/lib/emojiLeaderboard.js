import { API_BASE } from "./api.js";

/** Emoji leaderboard rows shown per page. */
export const EMOJI_PAGE_SIZE = 50;

/** Per-user emoji leaderboard rows shown per page. */
export const EMOJI_USER_PAGE_SIZE = EMOJI_PAGE_SIZE;

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
 * Fetch one page of the emoji usage leaderboard from webapi.
 * @param {number} [offset=0] Rows to skip.
 * @param {number} [limit=EMOJI_PAGE_SIZE] Page size (max 50).
 * @returns {Promise<{ entries: Array<{ emoji: { emoid: string, app: string, emoji: string, frequency: number, animated: number, type: string } }>, total: number, limit: number, offset: number }>} each row's `emoji` is the full guild_emojis row — use `.emoji.emoji` for the name, `.emoji.frequency` for its count.
 */
export async function fetchEmojiLeaderboardPage(
  offset = 0,
  limit = EMOJI_PAGE_SIZE,
) {
  const res = await fetch(`${API_BASE}/leaderboards/emoji`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit, offset }),
  });

  if (!res.ok) {
    throw new Error(`Failed to load emoji leaderboard (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Emoji leaderboard");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load emoji leaderboard");
  }

  return {
    entries: Array.isArray(data.top) ? data.top : [],
    total: Number(data.total) || 0,
    limit: Number(data.limit) || limit,
    offset: Number(data.offset) || offset,
  };
}

/**
 * Fetch one page of the per-user emoji usage leaderboard from webapi.
 * @param {number} [offset=0] Rows to skip.
 * @param {number} [limit=EMOJI_USER_PAGE_SIZE] Page size (max 50).
 * @returns {Promise<{ entries: Array<{ userid: string, name: string, total: number }>, total: number, limit: number, offset: number }>}
 */
export async function fetchEmojiUserLeaderboardPage(
  offset = 0,
  limit = EMOJI_USER_PAGE_SIZE,
) {
  const res = await fetch(`${API_BASE}/leaderboards/emoji/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app: "discord", limit, offset }),
  });

  if (!res.ok) {
    throw new Error(`Failed to load emoji user leaderboard (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Emoji user leaderboard");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load emoji user leaderboard");
  }

  return {
    entries: Array.isArray(data.users) ? data.users : [],
    total: Number(data.total) || 0,
    limit: Number(data.limit) || limit,
    offset: Number(data.offset) || offset,
  };
}

/**
 * Fetch full per-user emoji frequency breakdown from webapi.
 * @param {string} userId Discord snowflake.
 * @param {string} [app="discord"] Chat app id.
 * @returns {Promise<Array<{ frequency: number, emoji: { emoid: string, app: string, emoji: string, frequency: number, animated: boolean|number, type: string } }>>} `frequency` is this user's own usage count; `emoji` is the full guild_emojis row (its own `frequency` is the emoji's global count, a different number).
 */
export async function fetchUserEmojiStats(userId, app = "discord") {
  const params = new URLSearchParams({ app });
  const res = await fetch(
    `${API_BASE}/leaderboards/emoji/user/${encodeURIComponent(userId)}?${params}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to load user emoji stats (${res.status})`);
  }

  const data = await parseJsonResponse(res, "User emoji stats");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load user emoji stats");
  }

  return Array.isArray(data.stats) ? data.stats : [];
}

/**
 * Whether a resolved emoji is a custom Discord emoji (numeric emoid), as opposed to unicode.
 * @param {{ emoid?: string|number|null }|null|undefined} emoji Resolved emoji object (guild_emojis row).
 * @returns {boolean}
 */
export function isCustomDiscordEmoji(emoji) {
  return !Number.isNaN(Number(emoji?.emoid));
}

/**
 * Local image URL for a custom Discord emoji, or null for unicode emojis.
 * @param {{ emoji?: string, emoid?: string|number|null, animated?: number|boolean }|null|undefined} emoji Resolved emoji object (guild_emojis row).
 * @returns {string|null}
 */
export function emojiImageUrl(emoji) {
  if (!isCustomDiscordEmoji(emoji)) return null;

  const name = String(emoji.emoji ?? "");
  const ext = emoji.animated ? "gif" : "png";
  return `/files/Emojis/${encodeURIComponent(name)}.${ext}`;
}

/**
 * Human-readable emoji label for the name column.
 * @param {{ emoji?: string, emoid?: string|number|null }|null|undefined} emoji Resolved emoji object (guild_emojis row).
 * @returns {string}
 */
export function emojiDisplayName(emoji) {
  const name = String(emoji?.emoji ?? "");
  return isCustomDiscordEmoji(emoji) ? `:${name}:` : name;
}
