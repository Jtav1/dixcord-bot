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
 * Fetch the trigger response function catalog (weighted trigger-response handler functions and
 * how often each fired).
 * @returns {Promise<Array<{ id: number, function_name: string, frequency: number, display_name: string|null }>>}
 */
export async function fetchTriggerResponseFunctions() {
  const res = await fetch(`${API_BASE}/trigger-responses/functions`);

  if (!res.ok) {
    throw new Error(
      `Failed to load trigger response functions (${res.status})`,
    );
  }

  const data = await parseJsonResponse(res, "Trigger Fxs");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load trigger response functions");
  }

  return Array.isArray(data.responseFunctions) ? data.responseFunctions : [];
}
