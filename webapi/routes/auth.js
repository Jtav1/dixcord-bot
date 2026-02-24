import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { signToken } from '../middleware/auth.js';

const router = express.Router();

// Registration disabled: only the admin user (from ADMIN_USERNAME / ADMIN_PASSWORD) can use the API
router.post('/register', (req, res) => {
  res.status(403).json({ error: 'Registration is disabled. Use runtime environment variables to create admin user.' });
});

// POST /api/auth/login — only the configured admin (ADMIN_USERNAME) may log in
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const adminUsername = process.env.ADMIN_USERNAME;
    if (adminUsername && email !== adminUsername) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const [rows] = await db.query('SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user.id);
    delete user.password_hash;
    res.json({ user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
