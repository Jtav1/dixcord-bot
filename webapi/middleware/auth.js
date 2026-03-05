import jwt from 'jsonwebtoken';
import db from '../config/db.js';

if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).trim() === '') {
  console.error('Fatal: JWT_SECRET must be set in .env or system environment. The webapi will not start without it.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verify JWT and attach user to req.user. Only the admin user (ADMIN_USERNAME) may access.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function authenticate(req, res, next) {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    return res.status(503).json({ error: 'Admin not configured (set ADMIN_USERNAME and ADMIN_PASSWORD)' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query('SELECT id, email, name, created_at FROM users WHERE id = ?', [decoded.userId]);
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    const user = rows[0];
    if (user.email !== adminUsername) {
      return res.status(403).json({ error: 'Forbidden: only the configured admin user may access this API' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Optional auth: attach user to req.user if valid token present; do not fail if missing.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query('SELECT id, email, name, created_at FROM users WHERE id = ?', [decoded.userId]);
    if (rows && rows.length > 0) req.user = rows[0];
  } catch (_) {}
  next();
}

/**
 * Sign a JWT for the given user id.
 * @param {number|string} userId
 * @returns {string}
 */
export function signToken(userId) {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export { JWT_SECRET };
