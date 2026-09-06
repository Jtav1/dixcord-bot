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
 * Fetch the lotto prize catalog (weighted trigger-response prize keys and how often each fired).
 * @returns {Promise<Array<{ id: number, prize_string: string, frequency: number, display_name: string|null }>>}
 */
export async function fetchLottoPrizes() {
  const res = await fetch(`${API_BASE}/trigger-responses/lotto-prizes`);

  if (!res.ok) {
    throw new Error(`Failed to load lotto prizes (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Lotto prizes");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load lotto prizes");
  }

  return Array.isArray(data.lottoPrizes) ? data.lottoPrizes : [];
}
