import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Verify JWT and attach user to req.user. Only the admin user (ADMIN_USERNAME) may access.
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
 * Optional auth: attach user if valid token present, don't fail if missing.
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

export function signToken(userId) {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export { JWT_SECRET };
