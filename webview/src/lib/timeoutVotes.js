import { API_BASE } from "./api.js";

/** Timeout history rows shown per page. */
export const TIMEOUT_HISTORY_PAGE_SIZE = 20;

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
 * Fetch one page of fired vote-to-timeout events from webapi, newest first.
 * @param {number} [offset=0] Rows to skip.
 * @param {number} [limit=TIMEOUT_HISTORY_PAGE_SIZE] Page size.
 * @returns {Promise<{ entries: Array<{ id: number, messageId: string, guildId: string, target: number|null, voteWeightTotal: number, durationSeconds: number, timestamp: string }>, total: number }>}
 */
export async function fetchTimeoutHistoryPage(offset = 0, limit = TIMEOUT_HISTORY_PAGE_SIZE) {
  const params = new URLSearchParams({ app: "discord", limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API_BASE}/leaderboards/timeout?${params}`);

  if (!res.ok) {
    throw new Error(`Failed to load timeout history (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Timeout history");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load timeout history");
  }

  return {
    entries: Array.isArray(data.entries) ? data.entries : [],
    total: Number(data.total) || 0,
  };
}

/**
 * Fetch the voters for one fired timeout event.
 * @param {number} historyId timeout_history.id.
 * @returns {Promise<Array<{ voter: number|null, weight: number, timestamp: string }>>}
 */
export async function fetchTimeoutVoters(historyId) {
  const res = await fetch(`${API_BASE}/leaderboards/timeout/history/${encodeURIComponent(historyId)}`);

  if (!res.ok) {
    throw new Error(`Failed to load timeout voters (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Timeout voters");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load timeout voters");
  }

  return Array.isArray(data.voters) ? data.voters : [];
}

/**
 * Format a timeout duration in seconds as a short human-readable string.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTimeoutDuration(seconds) {
  const n = Number(seconds) || 0;
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.round(n / 60)}m`;
  return `${Math.round(n / 3600)}h`;
}

/**
 * Format a timeout timestamp for display.
 * @param {string|Date|null|undefined} timestamp
 * @returns {string}
 */
export function formatTimeoutTimestamp(timestamp) {
  if (timestamp == null) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  return date.toLocaleString();
}
