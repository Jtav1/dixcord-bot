import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import db from "../config/db.js";
import { enrichConfigEntries } from "../services/configMetadata.js";
import { recordAudit } from "../services/auditLog.js";
import { incrementCacheVersion } from "../services/systemStatus.js";

const router = express.Router();

/**
 * GET /api/config
 * Returns all rows from the configurations table with metadata.
 * Response: { config, entries, entriesWithMeta }
 * Auth: required.
 * @openapi
 * /api/config:
 *   get:
 *     operationId: listConfig
 *     tags: [Config]
 *     summary: List all configuration entries
 *     responses:
 *       '200':
 *         description: All configuration entries, keyed by name and with metadata.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 config:
 *                   type: object
 *                   description: Map of config name to value.
 *                   additionalProperties: { type: string }
 *                 entries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       config: { type: string }
 *                       value: { type: string }
 *                 entriesWithMeta:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       config: { type: string }
 *                       value: { type: string }
 *                       description: { type: string, nullable: true }
 *                       type: { type: string }
 *                       requiresBotRestart: { type: boolean }
 *                       deprecated: { type: boolean }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT config, value FROM configurations");
    const entries = Array.isArray(rows) ? rows : [];
    const config = Object.fromEntries(
      entries.map((row) => [row.config, row.value ?? ""]),
    );
    const entriesWithMeta = enrichConfigEntries(entries);
    res.json({ ok: true, config, entries, entriesWithMeta });
  } catch (err) {
    console.error("GET /api/config error:", err);
    res.status(500).json({ ok: false, error: "Failed to load configuration" });
  }
});

/**
 * POST /api/config
 * Create a new configuration key.
 * Body: { config: string, value?: string }
 * Auth: admin required.
 * @openapi
 * /api/config:
 *   post:
 *     operationId: createConfig
 *     tags: [Config]
 *     summary: Create a new configuration key
 *     description: Requires the admin role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [config]
 *             properties:
 *               config: { type: string, description: "Configuration key name." }
 *               value: { type: string }
 *     responses:
 *       '201':
 *         description: Created configuration entry.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 config: { type: string }
 *                 value: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '409':
 *         description: A configuration entry with this key already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const configName = String(req.body?.config ?? "").trim();
    const value = req.body?.value ?? "";

    if (!configName) {
      return res.status(400).json({
        ok: false,
        error: "Body must include 'config' (configuration name)",
      });
    }

    const [existing] = await db.query(
      "SELECT config FROM configurations WHERE config = ?",
      [configName],
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({
        ok: false,
        error: "Configuration key already exists",
      });
    }

    await db.query(
      "INSERT INTO configurations (config, value) VALUES (?, ?)",
      [configName, String(value)],
    );
    await recordAudit(req.user.id, "create", "configurations", configName, {
      value,
    });
    await incrementCacheVersion();

    res.status(201).json({ ok: true, config: configName, value: String(value) });
  } catch (err) {
    console.error("POST /api/config error:", err);
    res.status(500).json({ ok: false, error: "Failed to create configuration" });
  }
});

/**
 * PUT /api/config
 * Update a configuration value by name. Only updates if the config key exists.
 * Body: { config: string, value: string }
 * Auth: admin required.
 * @openapi
 * /api/config:
 *   put:
 *     operationId: updateConfig
 *     tags: [Config]
 *     summary: Update a configuration value by name
 *     description: Requires the admin role. Only updates if the config key already exists.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [config]
 *             properties:
 *               config: { type: string, description: "Configuration key name." }
 *               value: { type: string }
 *     responses:
 *       '200':
 *         description: Updated configuration entry.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 config: { type: string }
 *                 value: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/", authenticate, requireAdmin, async (req, res) => {
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
    const affected = result?.affectedRows ?? result?.changes ?? 0;
    if (affected === 0) {
      return res
        .status(404)
        .json({ ok: false, error: "Configuration item not found" });
    }
    await recordAudit(req.user.id, "update", "configurations", configName, {
      value: value ?? "",
    });
    await incrementCacheVersion();
    res.json({ ok: true, config: String(configName), value: value ?? "" });
  } catch (err) {
    console.error("PUT /api/config error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to update configuration" });
  }
});

/**
 * DELETE /api/config/:key
 * Delete a configuration key.
 * Auth: admin required.
 * @openapi
 * /api/config/{key}:
 *   delete:
 *     operationId: deleteConfig
 *     tags: [Config]
 *     summary: Delete a configuration key
 *     description: Requires the admin role.
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:key", authenticate, requireAdmin, async (req, res) => {
  try {
    const configName = String(req.params.key ?? "").trim();
    if (!configName) {
      return res.status(400).json({ ok: false, error: "Invalid config key" });
    }
    const [result] = await db.query(
      "DELETE FROM configurations WHERE config = ?",
      [configName],
    );
    const affected = result?.affectedRows ?? result?.changes ?? 0;
    if (affected === 0) {
      return res
        .status(404)
        .json({ ok: false, error: "Configuration item not found" });
    }
    await recordAudit(req.user.id, "delete", "configurations", configName, {});
    await incrementCacheVersion();
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/config/:key error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to delete configuration" });
  }
});

export default router;
