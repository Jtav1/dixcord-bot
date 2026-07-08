import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

/** Roles managed via env; profile mutations are not allowed. */
const SERVICE_ROLES = new Set(['admin', 'bot', 'webview']);

/**
 * Whether the current user is a service account (admin, bot, or webview).
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isServiceAccount(req) {
  return SERVICE_ROLES.has(req.user?.role);
}

/**
 * GET /api/users/me
 * Current user profile (from JWT).
 * Auth: required.
 */
router.get('/me', async (req, res) => {
  res.json({ ok: true, user: req.user });
});

/**
 * PUT /api/users/me
 * Update current user profile (name and/or password).
 * Body: { name?, password? }
 * Auth: required. Service accounts cannot self-update.
 */
router.put('/me', async (req, res) => {
  if (isServiceAccount(req)) {
    return res.status(403).json({
      ok: false,
      error: 'Service account profiles are managed via environment configuration',
    });
  }
  try {
    const { name, password } = req.body;
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (password !== undefined && password.length > 0) {
      updates.push('password_hash = ?');
      values.push(await bcrypt.hash(password, 10));
    }
    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid fields to update' });
    }
    values.push(req.user.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    const [rows] = await db.query('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Update failed' });
  }
});

/**
 * DELETE /api/users/me
 * Delete current user account.
 * Auth: required. Service accounts cannot self-delete.
 */
router.delete('/me', async (req, res) => {
  if (isServiceAccount(req)) {
    return res.status(403).json({
      ok: false,
      error: 'Service accounts cannot be deleted via the API',
    });
  }
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Delete failed' });
  }
});

export default router;
