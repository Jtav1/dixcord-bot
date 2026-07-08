import express from "express";
import bcrypt from "bcryptjs";
import db from "../config/db.js";
import { signToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/auth/register
 * Registration disabled; only configured service accounts may use the API.
 * Auth: none (returns 403).
 */
router.post("/register", (req, res) => {
  res.status(403).json({
    ok: false,
    error: "Registration is disabled",
  });
});

/**
 * POST /api/auth/login
 * Login for admin (ADMIN_USERNAME), bot (BOT_USERNAME), or web-view (WEBVIEW_USERNAME).
 * Body: { email, password }
 * Response: { ok, user, token, role }
 * Auth: none.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "Email and password are required" });
    }

    const adminUsername = process.env.ADMIN_USERNAME;
    const botUsername = process.env.BOT_USERNAME;
    const webviewUsername = process.env.WEBVIEW_USERNAME;
    const allowedEmails = [adminUsername, botUsername, webviewUsername].filter(
      Boolean,
    );

    if (allowedEmails.length === 0) {
      return res
        .status(503)
        .json({ ok: false, error: "Login not configured" });
    }

    if (!allowedEmails.includes(email)) {
      return res
        .status(401)
        .json({ ok: false, error: "Invalid email or password" });
    }

    const [rows] = await db.query(
      "SELECT id, email, name, password_hash, created_at, role FROM users WHERE email = ?",
      [email],
    );
    if (rows.length === 0) {
      return res
        .status(401)
        .json({ ok: false, error: "Invalid email or password" });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res
        .status(401)
        .json({ ok: false, error: "Invalid email or password" });
    }

    const role =
      user.role != null && String(user.role).trim() !== ""
        ? String(user.role).trim()
        : null;
    const token = signToken(user.id, role);
    delete user.password_hash;
    res.json({
      ok: true,
      role,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Login failed" });
  }
});

export default router;
