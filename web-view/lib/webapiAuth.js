/** Server-side webapi JWT for the web-view proxy (not bundled for the browser). */

let cachedToken = null;
let tokenExpiresAt = 0;
let loginPromise = null;

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Read webapi URL and web-view credentials from process.env.
 * @returns {{ webapiUrl: string, username: string|undefined, password: string|undefined }}
 */
function getConfig() {
  const webapiUrl = (process.env.WEBAPI_URL || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
  return {
    webapiUrl,
    username: process.env.WEBVIEW_USERNAME,
    password: process.env.WEBVIEW_PASSWORD,
  };
}

/**
 * Decode JWT exp claim as milliseconds since epoch.
 * @param {string} token JWT string.
 * @returns {number} Expiry time in ms, or 0 when missing/invalid.
 */
function decodeJwtExpMs(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * @returns {boolean} True when cached token exists and is not near expiry.
 */
function isTokenValid() {
  return Boolean(
    cachedToken && Date.now() < tokenExpiresAt - REFRESH_BUFFER_MS,
  );
}

/**
 * Fetch a fresh JWT from webapi login.
 * @returns {Promise<string>} JWT string (without Bearer prefix).
 */
async function loginForToken() {
  const { webapiUrl, username, password } = getConfig();
  if (!username || !password) {
    throw new Error("WEBVIEW_USERNAME and WEBVIEW_PASSWORD must be set");
  }

  const res = await fetch(`${webapiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(data.error || `webapi login failed (${res.status})`);
  }

  cachedToken = data.token;
  tokenExpiresAt =
    decodeJwtExpMs(cachedToken) || Date.now() + 7 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

/**
 * Return a valid JWT, refreshing when near expiry.
 * @returns {Promise<string>} JWT string (without Bearer prefix).
 */
export async function getWebapiToken() {
  if (isTokenValid()) return cachedToken;
  if (!loginPromise) {
    loginPromise = loginForToken().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
}

/**
 * Build Authorization header value for proxied webapi requests.
 * @returns {Promise<string|null>} `Bearer <token>`, or null when credentials are unset.
 */
export async function getWebapiAuthHeader() {
  const { username, password } = getConfig();
  if (!username || !password) {
    console.warn(
      "WEBVIEW_USERNAME and WEBVIEW_PASSWORD not set; API proxy will not authenticate.",
    );
    return null;
  }
  const token = await getWebapiToken();
  return `Bearer ${token}`;
}

/**
 * @returns {string|null} Cached `Bearer` header when token is valid, else null.
 */
export function getCachedWebapiAuthHeaderSync() {
  if (isTokenValid()) return `Bearer ${cachedToken}`;
  return null;
}

/**
 * Express/Vite middleware: refresh webapi JWT before proxying /api.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {() => void} next
 * @returns {Promise<void>}
 */
export async function webapiAuthProxyMiddleware(req, res, next) {
  if (!req.url?.startsWith("/api")) {
    next();
    return;
  }
  try {
    await getWebapiAuthHeader();
    next();
  } catch (err) {
    console.error("web-view webapi auth failed:", err);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({ ok: false, error: "Failed to authenticate with webapi" }),
    );
  }
}

/**
 * Attach cached webapi Authorization to an outgoing proxy request.
 * @param {import('http').ClientRequest} proxyReq
 * @returns {void}
 */
export function attachCachedWebapiAuthHeader(proxyReq) {
  const header = getCachedWebapiAuthHeaderSync();
  if (header) {
    proxyReq.setHeader("Authorization", header);
  }
}

/**
 * Warm cached token at server startup (logs warning on failure).
 * @returns {Promise<void>}
 */
export async function warmWebapiAuth() {
  const { username, password } = getConfig();
  if (!username || !password) {
    console.warn(
      "WEBVIEW_USERNAME and WEBVIEW_PASSWORD not set; web-view API proxy is unauthenticated.",
    );
    return;
  }
  try {
    await getWebapiToken();
    console.log("web-view webapi auth token ready");
  } catch (err) {
    console.error("Failed to authenticate web-view proxy with webapi:", err.message);
  }
}
