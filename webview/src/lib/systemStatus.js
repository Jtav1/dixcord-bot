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
 * Fetch system and bot health status from webapi.
 * @returns {Promise<{ webapi: string, db: string, cacheVersion: string, bot: { guildId: string, version: string, lastSeenAt: string, online: boolean } | null }>}
 */
export async function fetchSystemStatus() {
  const res = await fetch(`${API_BASE}/system/status`);

  if (!res.ok) {
    throw new Error(`Failed to load system status (${res.status})`);
  }

  const data = await parseJsonResponse(res, "System status");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load system status");
  }

  return data.status;
}
