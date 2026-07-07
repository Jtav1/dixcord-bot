import { API_BASE } from "./api.js";

/** Emoji leaderboard rows shown per page. */
export const EMOJI_PAGE_SIZE = 50;

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
 * @returns {Promise<{ entries: Array<{ emoji: string, frequency: number, emoid: string, animated: number }>, total: number, limit: number, offset: number }>}
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
 * Whether a leaderboard row is a custom Discord emoji (numeric emoid).
 * @param {{ emoid?: string|number }} row Emoji leaderboard row.
 * @returns {boolean}
 */
export function isCustomDiscordEmoji(row) {
  return !Number.isNaN(Number(row?.emoid));
}

/**
 * Local image URL for a custom Discord emoji, or null for unicode emojis.
 * @param {{ emoji?: string, emoid?: string|number, animated?: number|boolean }} row Emoji leaderboard row.
 * @returns {string|null}
 */
export function emojiImageUrl(row) {
  if (!isCustomDiscordEmoji(row)) return null;

  const name = String(row.emoji ?? "");
  const ext = row.animated ? "gif" : "png";
  return `/files/Emojis/${encodeURIComponent(name)}.${ext}`;
}

/**
 * Human-readable emoji label for the name column.
 * @param {{ emoji?: string, emoid?: string|number }} row Emoji leaderboard row.
 * @returns {string}
 */
export function emojiDisplayName(row) {
  const name = String(row.emoji ?? "");
  return isCustomDiscordEmoji(row) ? `:${name}:` : name;
}
