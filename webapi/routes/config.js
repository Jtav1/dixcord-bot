import express from "express";
import { authenticate } from "../middleware/auth.js";
import db from "../config/db.js";

const router = express.Router();

/**
 * GET /api/config
 * Returns all rows from the configurations table.
 * Response: { config: { [key]: value }, entries: [ { config, value } ] }
 * Use "config" for key-value lookup; "entries" for array form.
 * Auth: required.
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT config, value FROM configurations");
    const entries = Array.isArray(rows) ? rows : [];
    const config = Object.fromEntries(
      entries.map((row) => [row.config, row.value ?? ""])
    );
    res.json({ ok: true, config, entries });
  } catch (err) {
    console.error("GET /api/config error:", err);
    res.status(500).json({ ok: false, error: "Failed to load configuration" });
  }
});

export default router;
