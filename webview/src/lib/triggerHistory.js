import { API_BASE } from "./api.js";

/** Trigger-response history rows shown per page. */
export const TRIGGER_HISTORY_PAGE_SIZE = 20;

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
 * Fetch one page of trigger-response usage history for one user from webapi.
 * @param {number|string} chatMemberId chat_member_mapping.id of the user.
 * @param {number} [offset=0] Rows to skip.
 * @param {number} [limit=TRIGGER_HISTORY_PAGE_SIZE] Page size.
 * @returns {Promise<{ entries: Array<{ id: number, timestamp: string, triggerResponseId: number, triggerString: string, responseString: string }>, total: number, limit: number, offset: number }>}
 */
export async function fetchTriggerResponseHistoryPage(
  chatMemberId,
  offset = 0,
  limit = TRIGGER_HISTORY_PAGE_SIZE,
) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(
    `${API_BASE}/trigger-responses/history/${encodeURIComponent(chatMemberId)}?${params}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to load trigger-response history (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Trigger-response history");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load trigger-response history");
  }

  return {
    entries: Array.isArray(data.history) ? data.history : [],
    total: Number(data.total) || 0,
    limit: Number(data.limit) || limit,
    offset: Number(data.offset) || offset,
  };
}

/**
 * Format a history timestamp for display.
 * @param {string|Date|null|undefined} timestamp History timestamp from webapi.
 * @returns {string}
 */
export function formatHistoryTimestamp(timestamp) {
  if (timestamp == null) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  return date.toLocaleString();
}
