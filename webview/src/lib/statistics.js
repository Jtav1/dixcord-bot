import { API_BASE } from "./api.js";

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
 * Fetch aggregate database statistics from webapi.
 * @returns {Promise<{
 *   chatMemberMappings: number,
 *   emojiCatalog: { emojis: number, stickers: number, total: number },
 *   emojiUsage: { emojis: number, stickers: number, total: number },
 *   pinHistory: number,
 *   plusplusTracking: number,
 *   triggers: number,
 *   responses: number,
 *   triggerResponseFrequencySum: number,
 *   repostTracking: number
 * }>}
 */
export async function fetchStatistics() {
  const res = await fetch(`${API_BASE}/statistics`);

  if (!res.ok) {
    throw new Error(`Failed to load statistics (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Statistics");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load statistics");
  }

  return data.statistics;
}
