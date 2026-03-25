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
      entries.map((row) => [row.config, row.value ?? ""]),
    );
    res.json({ ok: true, config, entries });
  } catch (err) {
    console.error("GET /api/config error:", err);
    res.status(500).json({ ok: false, error: "Failed to load configuration" });
  }
});

/**
 * PUT /api/config
 * Update a configuration value by name. Only updates if the config key exists.
 * Body: { config: string, value: string }
 * Response: { ok: true, config, value } on success; 404 if no row with that name exists.
 * Auth: required.
 */
router.put("/", authenticate, async (req, res) => {
  try {
    const { config: configName, value } = req.body ?? {};
    if (configName == null || configName === "") {
      return res.status(400).json({
        ok: false,
        error: "Body must include 'config' (configuration name)",
      });
    }
    const [result] = await db.query(
      "UPDATE configurations SET value = ? WHERE config = ?",
      [value ?? "", String(configName)],
    );
    const affected = result?.affectedRows ?? 0;
    if (affected === 0) {
      return res
        .status(404)
        .json({ ok: false, error: "Configuration item not found" });
    }
    res.json({ ok: true, config: String(configName), value: value ?? "" });
  } catch (err) {
    console.error("PUT /api/config error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to update configuration" });
  }
});

export default router;
