import jwt from "jsonwebtoken";
import db from "../config/db.js";

if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).trim() === "") {
  console.error(
    "Fatal: JWT_SECRET must be set in .env or system environment. The webapi will not start without it.",
  );
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

/** Routes the webview service account may access (exact path match). */
export const WEBVIEW_ALLOWED_ROUTES = [
  { method: "POST", path: "/api/leaderboards/plusplus" },
  { method: "POST", path: "/api/leaderboards/plusplus/top-voters" },
  { method: "POST", path: "/api/leaderboards/emoji" },
  { method: "POST", path: "/api/leaderboards/repost" },
  { method: "GET", path: "/api/pin-history" },
  { method: "GET", path: "/api/system/status" },
  { method: "GET", path: "/api/user-mappings" },
];

/**
 * @param {unknown} role
 * @returns {boolean} True when role is exactly webview.
 */
export function isWebviewRole(role) {
  return role === "webview";
}

/**
 * @param {unknown} role
 * @returns {boolean} True when role is admin, bot, or webview (null/unknown roles are false).
 */
export function isAllowedAuthenticatedRole(role) {
  return role === "admin" || role === "bot" || role === "webview";
}

/**
 * @param {unknown} role
 * @returns {boolean} True only when role is exactly admin.
 */
export function isAdminRole(role) {
  return role === "admin";
}

/**
 * Normalize a request pathname for allowlist matching.
 * @param {string} pathname Raw path (may include query string or trailing slash).
 * @returns {string} Normalized path without query or trailing slash.
 */
export function normalizeRoutePath(pathname) {
  const withoutQuery = pathname.split("?")[0];
  const trimmed = withoutQuery.replace(/\/+$/, "");
  return trimmed || "/";
}

/**
 * Check whether a method + path is allowed for the webview service account.
 * @param {string} method HTTP method.
 * @param {string} pathname Request path (e.g. req.originalUrl).
 * @returns {boolean}
 */
export function isWebviewAllowedRoute(method, pathname) {
  const normalizedPath = normalizeRoutePath(pathname);
  const normalizedMethod = method.toUpperCase();
  return WEBVIEW_ALLOWED_ROUTES.some(
    (route) =>
      route.method === normalizedMethod && route.path === normalizedPath,
  );
}

/**
 * Load user row and attach role. Empty DB role values remain null.
 * @param {number|string} userId
 * @returns {Promise<{ id: number, email: string, name: string, created_at: string, role: string|null }|null>}
 */
async function loadUserWithRole(userId) {
  const [rows] = await db.query(
    "SELECT id, email, name, created_at, role FROM users WHERE id = ?",
    [userId],
  );
  if (!rows || rows.length === 0) return null;
  const user = rows[0];
  return {
    ...user,
    role:
      user.role != null && String(user.role).trim() !== ""
        ? String(user.role).trim()
        : null,
  };
}

/**
 * Verify JWT and attach user to req.user. Allows admin, bot, and webview service accounts.
 * Webview accounts are restricted to WEBVIEW_ALLOWED_ROUTES.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await loadUserWithRole(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    if (!isAllowedAuthenticatedRole(user.role)) {
      return res.status(403).json({ error: "Forbidden: invalid account role" });
    }
    if (
      isWebviewRole(user.role) &&
      !isWebviewAllowedRoute(req.method, req.originalUrl)
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden: route not allowed for webview account" });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Require admin role after authenticate.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

/**
 * Optional auth: attach user to req.user if valid token present; do not fail if missing.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await loadUserWithRole(decoded.userId);
    if (user) req.user = user;
  } catch (_) {}
  next();
}

/**
 * Sign a JWT for the given user id and role.
 * @param {number|string} userId
 * @param {string|null} [role=null]
 * @returns {string}
 */
export function signToken(userId, role = null) {
  return jwt.sign({ userId, role }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

export { JWT_SECRET };
