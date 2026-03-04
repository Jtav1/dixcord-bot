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
      "Web API auth is not configured. Set WEBAPI_URL, WEBAPI_USERNAME, and WEBAPI_PASSWORD."
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
  console.log("[API query]", {
    method: "POST",
    endpoint: "/api/auth/login",
    data: { body: { email: webapiUsername } },
  });
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

  const dataProvided = {};
  if (options.params && Object.keys(options.params).length > 0) {
    dataProvided.params = options.params;
  }
  if (options.data !== undefined && options.data !== null) {
    dataProvided.body = options.data;
  }
  console.log("[API query]", {
    method,
    endpoint: path,
    ...(Object.keys(dataProvided).length > 0 ? { data: dataProvided } : {}),
  });

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
 * DELETE request.
 * @param {string} path
 * @param {object} [options] - Axios config
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function del(path, options = {}) {
  return request("DELETE", path, options);
}
