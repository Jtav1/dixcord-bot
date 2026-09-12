import { API_BASE } from "./api.js";

/**
 * Parse a fetch Response as JSON, enforcing webapi's `{ ok, error }` envelope.
 * @param {Response} res
 * @param {string} context Label for error messages.
 * @returns {Promise<any>} Parsed response body.
 */
async function parseEnvelope(res, context) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `${context}: expected JSON but got ${contentType || "unknown content type"}`,
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${context}: invalid JSON response`);
  }

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `${context} failed (${res.status})`);
  }

  return data;
}

/**
 * Fetch JSON from webapi through the same-origin proxy, enforcing the `{ok,error}` envelope.
 * @param {string} path Path under API_BASE, e.g. "/statistics".
 * @param {RequestInit} [init]
 * @param {string} [context] Label for error messages; defaults to path.
 * @returns {Promise<any>} Parsed response body.
 */
export async function apiFetch(path, init, context) {
  const res = await fetch(`${API_BASE}${path}`, init);
  return parseEnvelope(res, context ?? path);
}

/**
 * apiFetch with a JSON request body and Content-Type header set.
 * @param {string} method HTTP method.
 * @param {string} path Path under API_BASE.
 * @param {unknown} body Serialized as the JSON request body.
 * @param {string} [context] Label for error messages.
 * @returns {Promise<any>} Parsed response body.
 */
export async function apiFetchJson(method, path, body, context) {
  return apiFetch(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    context,
  );
}
