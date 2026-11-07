/**
 * Web API client for the discord bot.
 * Authenticates via POST /api/auth/login and stores the JWT.
 * Automatically re-authenticates when a request returns 401 (e.g. token expired).
 */

import axios from "axios";
import { webapiUrl, webapiUsername, webapiPassword } from "../configVars.js";

/** @type {string|null} Stored JWT from login; cleared on logout or when expired. */
let token = null;

/**
 * Ensure webapi is configured. Throws if not.
 * @throws {Error}
 */
function requireConfig() {
  if (!webapiUrl || !webapiUsername || !webapiPassword) {
    throw new Error(
      "Web API auth is not configured. Set WEBAPI_URL, WEBAPI_USERNAME, and WEBAPI_PASSWORD.",
    );
  }
}

/**
 * Log in to the web API and store the returned token.
 * POST /api/auth/login with { email, password }.
 * @returns {Promise<{ ok: boolean, user?: object, token: string }>}
 */
export async function login() {
  requireConfig();
  const { data } = await axios.post(`${webapiUrl}/api/auth/login`, {
    email: webapiUsername,
    password: webapiPassword,
  });
  if (data?.ok && data?.token) {
    token = data.token;
    return data;
  }
  throw new Error(data?.error || "Login failed");
}

/**
 * Clear the stored token (e.g. after logout or to force re-login).
 */
export function clearToken() {
  token = null;
}

/**
 * Make an authenticated request to the web API.
 * If no token is stored, logs in first. On 401, re-logs in and retries the request once.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} path - Path (e.g. "/api/config" or "/api/leaderboards/plusplus")
 * @param {object} [options] - Axios request config (params, data, headers, etc.)
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export async function request(method, path, options = {}) {
  requireConfig();
  const url = path.startsWith("http") ? path : `${webapiUrl}${path}`;

  const doRequest = async (authToken) => {
    return axios.request({
      method,
      url,
      ...options,
      headers: {
        ...options.headers,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
  };

  if (!token) {
    await login();
  }

  try {
    return await doRequest(token);
  } catch (err) {
    if (err.response?.status === 401) {
      await login();
      return await doRequest(token);
    }
    throw err;
  }
}

/**
 * GET request.
 * @param {string} path
 * @param {object} [options] - Axios config (e.g. params)
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function get(path, options = {}) {
  return request("GET", path, options);
}

/**
 * POST request.
 * @param {string} path
 * @param {object} [body] - JSON body
 * @param {object} [options] - Axios config
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function post(path, body, options = {}) {
  return request("POST", path, { ...options, data: body });
}

/**
 * POST a big list in size-capped chunks (webapi body limit is 100kb). Each request is
 * `{ ...base, [key]: chunk }`; always sends at least one. Numeric response fields are summed.
 * @param {string} path
 * @param {object} base - fields repeated in every request
 * @param {string} key - body field holding the list
 * @param {Array} items
 * @param {{ maxBytes?: number }} [opts] - maxBytes caps the serialized body
 * @returns {Promise<Record<string, number>>} summed numeric fields (e.g. inserted, imported)
 */
export async function postInChunks(path, base, key, items, { maxBytes = 80_000 } = {}) {
  const budget = maxBytes - JSON.stringify(base).length;
  const chunks = [[]];
  let size = 0;
  for (const item of items) {
    const len = JSON.stringify(item).length + 1;
    if (size + len > budget && chunks.at(-1).length > 0) {
      chunks.push([]);
      size = 0;
    }
    chunks.at(-1).push(item);
    size += len;
  }
  const totals = {};
  for (const chunk of chunks) {
    const { data } = await post(path, { ...base, [key]: chunk });
    for (const [k, v] of Object.entries(data ?? {})) {
      if (typeof v === "number") totals[k] = (totals[k] ?? 0) + v;
    }
  }
  return totals;
}

/**
 * PUT request.
 * @param {string} path
 * @param {object} [body] - JSON body
 * @param {object} [options] - Axios config
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function put(path, body, options = {}) {
  return request("PUT", path, { ...options, data: body });
}

/**
 * PATCH request.
 * @param {string} path
 * @param {object} [body] - JSON body
 * @param {object} [options] - Axios config
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function patch(path, body, options = {}) {
  return request("PATCH", path, { ...options, data: body });
}

/**
 * DELETE request.
 * @param {string} path
 * @param {object} [options] - Axios config
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function del(path, options = {}) {
  return request("DELETE", path, options);
}

/**
 * Human-readable message from a failed webapi request. Prefers the server's own
 * `{ error }` body (e.g. "Unknown user; not in chat_member_mapping for this app.") over
 * axios's generic "Request failed with status code 400".
 * @param {unknown} err
 * @returns {string}
 */
export function describeApiError(err) {
  if (err?.response?.data?.error) return String(err.response.data.error);
  if (err?.message) return String(err.message);
  return String(err);
}
