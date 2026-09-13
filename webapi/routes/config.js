import express from "express";
import { authenticate, requireAdmin, requireOwnGuildOrAdmin } from "../middleware/auth.js";
import {
  createGuildConfigKey,
  deleteGuildConfigKey,
  listGuildConfig,
  setGuildConfigValue,
} from "../services/guildConfig.js";
import { recordAudit } from "../services/auditLog.js";
import { incrementCacheVersion } from "../services/systemStatus.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";

const router = express.Router();

const GUILD_ID_PARAM_ERROR = {
  ok: false,
  error: "Parameter \"guildId\" is required",
};

/**
 * Resolve app + guildId from a request (query for GET, body for mutations).
 * @param {import("express").Request} req
 * @returns {{ ok: true, app: string, guildId: string } | { ok: false, status: number, error: string }}
 */
function resolveGuildScope(req) {
  const app = resolveChatAppFromRequest(req);
  if (!app) return { ok: false, status: 400, error: CHAT_APP_PARAM_ERROR.error };
  const guildId = String(req.body?.guildId ?? req.query?.guildId ?? "").trim();
  if (!guildId) return { ok: false, status: 400, error: GUILD_ID_PARAM_ERROR.error };
  return { ok: true, app, guildId };
}

/**
 * GET /api/config
 * Returns all configuration rows for one server, with metadata.
 * Query: { app, guildId }
 * Response: { config, entries, entriesWithMeta }
 * Auth: required. A guild-scoped bot account may only read its own guildId.
 * @openapi
 * /api/config:
 *   get:
 *     operationId: listConfig
 *     tags: [Config]
 *     summary: List all configuration entries for one server
 *     parameters:
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *       - name: guildId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: All configuration entries for this server, keyed by name and with metadata.
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
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
    const { config, entries, entriesWithMeta } = await listGuildConfig(scope.app, scope.guildId);
    res.json({ ok: true, config, entries, entriesWithMeta });
  } catch (err) {
    console.error("GET /api/config error:", err);
    res.status(500).json({ ok: false, error: "Failed to load configuration" });
  }
});

/**
 * POST /api/config
 * Create a new configuration key for a server.
 * Body: { app, guildId, config: string, value?: string }
 * Auth: admin required.
 * @openapi
 * /api/config:
 *   post:
 *     operationId: createConfig
 *     tags: [Config]
 *     summary: Create a new configuration key for a server
 *     description: Requires the admin role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, config]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               guildId: { type: string }
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
 *         description: A configuration entry with this key already exists for this server.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });

    const configName = String(req.body?.config ?? "").trim();
    const value = req.body?.value ?? "";
    if (!configName) {
      return res.status(400).json({
        ok: false,
        error: "Body must include 'config' (configuration name)",
      });
    }

    const created = await createGuildConfigKey(scope.app, scope.guildId, configName, String(value));
    if (!created) {
      return res.status(409).json({
        ok: false,
        error: "Configuration key already exists for this server",
      });
    }

    await recordAudit(req.user.id, "create", "guild_config", `${scope.app}/${scope.guildId}/${configName}`, {
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
 * Update a configuration value for a server. Only updates if the config key already exists.
 * Body: { app, guildId, config: string, value: string }
 * Auth: admin required.
 * @openapi
 * /api/config:
 *   put:
 *     operationId: updateConfig
 *     tags: [Config]
 *     summary: Update a configuration value for a server
 *     description: Requires the admin role. Only updates if the config key already exists for this server.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, config]
 *             properties:
 *               app: { type: string, enum: [discord] }
 *               guildId: { type: string }
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
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });

    const { config: configName, value } = req.body ?? {};
    if (configName == null || configName === "") {
      return res.status(400).json({
        ok: false,
        error: "Body must include 'config' (configuration name)",
      });
    }
    const updated = await setGuildConfigValue(scope.app, scope.guildId, String(configName), value ?? "");
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Configuration item not found" });
    }
    await recordAudit(req.user.id, "update", "guild_config", `${scope.app}/${scope.guildId}/${configName}`, {
      value: value ?? "",
    });
    await incrementCacheVersion();
    res.json({ ok: true, config: String(configName), value: value ?? "" });
  } catch (err) {
    console.error("PUT /api/config error:", err);
    res.status(500).json({ ok: false, error: "Failed to update configuration" });
  }
});

/**
 * DELETE /api/config/:key
 * Delete a configuration key for a server.
 * Query: { app, guildId }
 * Auth: admin required.
 * @openapi
 * /api/config/{key}:
 *   delete:
 *     operationId: deleteConfig
 *     tags: [Config]
 *     summary: Delete a configuration key for a server
 *     description: Requires the admin role.
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord] }
 *       - name: guildId
 *         in: query
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
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });

    const configName = String(req.params.key ?? "").trim();
    if (!configName) {
      return res.status(400).json({ ok: false, error: "Invalid config key" });
    }
    const deleted = await deleteGuildConfigKey(scope.app, scope.guildId, configName);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Configuration item not found" });
    }
    await recordAudit(req.user.id, "delete", "guild_config", `${scope.app}/${scope.guildId}/${configName}`, {});
    await incrementCacheVersion();
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/config/:key error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete configuration" });
  }
});

export default router;
