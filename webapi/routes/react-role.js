import express from "express";
import {
  authenticate,
  requireAdmin,
  requireBotOrAdmin,
  requireOwnGuildOrAdmin,
} from "../middleware/auth.js";
import * as reactRole from "../services/reactRole.js";
import { recordAudit } from "../services/auditLog.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";

const router = express.Router();

/** Discord's embed field cap is 25; leave headroom and keep the row editor manageable. */
const MAX_BINDINGS = 20;

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
 * Validate a PUT body's bindings array. Returns the first validation error found, or null.
 * @param {unknown} bindings
 * @returns {string|null}
 */
function validateBindings(bindings) {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return "bindings must be a non-empty array";
  }
  if (bindings.length > MAX_BINDINGS) {
    return `bindings cannot contain more than ${MAX_BINDINGS} rows`;
  }
  for (const binding of bindings) {
    if (
      typeof binding?.emoji !== "string" || !binding.emoji.trim() ||
      typeof binding?.roleId !== "string" || !binding.roleId.trim() ||
      typeof binding?.description !== "string" || !binding.description.trim()
    ) {
      return "each binding requires non-empty emoji, roleId, and description";
    }
  }
  const duplicateEmoji = reactRole.findDuplicateEmoji(bindings);
  if (duplicateEmoji) return `Duplicate emoji in binding list: ${duplicateEmoji}`;
  const duplicateRoleId = reactRole.findDuplicateRoleId(bindings);
  if (duplicateRoleId) return `Duplicate role in binding list: ${duplicateRoleId}`;
  return null;
}

/**
 * GET /api/react-role
 * Returns the one react-for-role message config for a server, or { message: null } if
 * unconfigured. Used by both webadmin (populate the edit form) and the bot (reconciliation read).
 * Query: { app, guildId }
 * Auth: required. A guild-scoped bot account may only read its own guildId.
 * @openapi
 * /api/react-role:
 *   get:
 *     operationId: getReactRoleMessage
 *     tags: [React Role]
 *     summary: Get the react-for-role message config for one server
 *     parameters:
 *       - name: app
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [discord, fluxer] }
 *       - name: guildId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The message config (null if this server hasn't configured one yet).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 message:
 *                   nullable: true
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     app: { type: string }
 *                     guildId: { type: string }
 *                     channelId: { type: string }
 *                     messageId: { type: string, nullable: true }
 *                     title: { type: string }
 *                     description: { type: string, nullable: true }
 *                     contentVersion: { type: integer }
 *                     syncedVersion: { type: integer }
 *                     pendingDelete: { type: boolean }
 *                     lastSyncError: { type: string, nullable: true, description: "The bot's last post/edit failure message, if any." }
 *                     lastSyncErrorVersion: { type: integer, nullable: true, description: "The contentVersion lastSyncError applies to; stale once contentVersion has moved past it." }
 *                     bindings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           emoji: { type: string }
 *                           roleId: { type: string }
 *                           description: { type: string }
 *                           sortOrder: { type: integer }
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
    const message = await reactRole.getMessageWithBindings(scope.app, scope.guildId);
    res.json({ ok: true, message });
  } catch (err) {
    console.error("GET /api/react-role error:", err);
    res.status(500).json({ ok: false, error: "Failed to load react-for-role message" });
  }
});

/**
 * PUT /api/react-role
 * Create or update the one react-for-role message config for a server. Bumps content_version
 * so the bot's reconciliation loop picks up the change; the live Discord/Fluxer message itself
 * is posted/edited asynchronously by the bot, not by this request.
 * Body: { app, guildId, channelId, title, description?, bindings: [{emoji, roleId, description}] }
 * Auth: admin required.
 * @openapi
 * /api/react-role:
 *   put:
 *     operationId: putReactRoleMessage
 *     tags: [React Role]
 *     summary: Create or update the react-for-role message config for a server
 *     description: Requires the admin role. Rejects duplicate emoji or duplicate role entries.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, channelId, title, bindings]
 *             properties:
 *               app: { type: string, enum: [discord, fluxer] }
 *               guildId: { type: string }
 *               channelId: { type: string }
 *               title: { type: string }
 *               description: { type: string }
 *               bindings:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 20
 *                 items:
 *                   type: object
 *                   required: [emoji, roleId, description]
 *                   properties:
 *                     emoji: { type: string }
 *                     roleId: { type: string }
 *                     description: { type: string }
 *     responses:
 *       '200':
 *         description: Saved message config.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 message: { type: object }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });

    const channelId = String(req.body?.channelId ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const description = req.body?.description != null ? String(req.body.description).trim() : null;
    if (!channelId || !title) {
      return res.status(400).json({ ok: false, error: "channelId and title are required" });
    }

    const bindings = (Array.isArray(req.body?.bindings) ? req.body.bindings : []).map((b) => ({
      emoji: typeof b?.emoji === "string" ? b.emoji.trim() : b?.emoji,
      roleId: typeof b?.roleId === "string" ? b.roleId.trim() : b?.roleId,
      description: typeof b?.description === "string" ? b.description.trim() : b?.description,
    }));
    const bindingsError = validateBindings(bindings);
    if (bindingsError) {
      return res.status(400).json({ ok: false, error: bindingsError });
    }

    const message = await reactRole.upsertMessage(scope.app, scope.guildId, {
      channelId,
      title,
      description,
      bindings,
    });
    await recordAudit(req.user.id, "update", "react_role_messages", `${scope.app}/${scope.guildId}`, {
      channelId,
      title,
      bindingCount: bindings.length,
    });
    res.json({ ok: true, message });
  } catch (err) {
    console.error("PUT /api/react-role error:", err);
    res.status(500).json({ ok: false, error: "Failed to save react-for-role message" });
  }
});

/**
 * DELETE /api/react-role
 * Soft-deletes the react-for-role message: flags it for removal. The bot removes the live
 * Discord/Fluxer message on its next reconciliation pass, then confirms via
 * POST /api/react-role/confirm-delete, which is what actually removes this row. Idempotent.
 * Body: { app, guildId }
 * Auth: admin required.
 * @openapi
 * /api/react-role:
 *   delete:
 *     operationId: deleteReactRoleMessage
 *     tags: [React Role]
 *     summary: Delete the react-for-role message for a server
 *     description: >
 *       Requires the admin role. Soft-deletes (flags pending_delete); the bot performs the
 *       actual live-message deletion and hard-deletes the row via confirm-delete.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId]
 *             properties:
 *               app: { type: string, enum: [discord, fluxer] }
 *               guildId: { type: string }
 *     responses:
 *       '200':
 *         description: Deletion requested (or already gone/unconfigured).
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
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
    await reactRole.markPendingDelete(scope.app, scope.guildId);
    await recordAudit(req.user.id, "delete", "react_role_messages", `${scope.app}/${scope.guildId}`, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/react-role error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete react-for-role message" });
  }
});

/**
 * POST /api/react-role/synced
 * Bot-only: record that the live message has been successfully posted or edited to match
 * contentVersion.
 * Body: { app, guildId, messageId, channelId, syncedVersion }
 * Auth: bot or admin required (guild-scoped bot accounts restricted to their own guildId).
 * @openapi
 * /api/react-role/synced:
 *   post:
 *     operationId: markReactRoleSynced
 *     tags: [React Role]
 *     summary: Record that the bot has synced the live message to the current content version
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, messageId, channelId, syncedVersion]
 *             properties:
 *               app: { type: string, enum: [discord, fluxer] }
 *               guildId: { type: string }
 *               messageId: { type: string }
 *               channelId: { type: string }
 *               syncedVersion: { type: integer }
 *     responses:
 *       '200':
 *         description: Recorded.
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
router.post(
  "/synced",
  authenticate,
  requireBotOrAdmin,
  requireOwnGuildOrAdmin,
  async (req, res) => {
    try {
      const scope = resolveGuildScope(req);
      if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });

      const messageId = String(req.body?.messageId ?? "").trim();
      const channelId = String(req.body?.channelId ?? "").trim();
      const syncedVersion = Number(req.body?.syncedVersion);
      if (!messageId || !channelId || !Number.isInteger(syncedVersion) || syncedVersion < 0) {
        return res.status(400).json({
          ok: false,
          error: "messageId, channelId, and a non-negative integer syncedVersion are required",
        });
      }

      const updated = await reactRole.markSynced(scope.app, scope.guildId, {
        messageId,
        channelId,
        syncedVersion,
      });
      if (!updated) {
        return res.status(404).json({ ok: false, error: "React-for-role message not found" });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/react-role/synced error:", err);
      res.status(500).json({ ok: false, error: "Failed to record react-for-role sync" });
    }
  },
);

/**
 * POST /api/react-role/sync-failed
 * Bot-only: record that the bot failed to post/edit the live message for a content version, so
 * the admin panel (polling GET right after a save) can surface why it didn't take effect.
 * Body: { app, guildId, contentVersion, error }
 * Auth: bot or admin required (guild-scoped bot accounts restricted to their own guildId).
 * @openapi
 * /api/react-role/sync-failed:
 *   post:
 *     operationId: markReactRoleSyncFailed
 *     tags: [React Role]
 *     summary: Record that the bot failed to post/edit the live message for a content version
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, contentVersion, error]
 *             properties:
 *               app: { type: string, enum: [discord, fluxer] }
 *               guildId: { type: string }
 *               contentVersion: { type: integer }
 *               error: { type: string }
 *     responses:
 *       '200':
 *         description: Recorded.
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
router.post(
  "/sync-failed",
  authenticate,
  requireBotOrAdmin,
  requireOwnGuildOrAdmin,
  async (req, res) => {
    try {
      const scope = resolveGuildScope(req);
      if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });

      const contentVersion = Number(req.body?.contentVersion);
      const error = String(req.body?.error ?? "").trim().slice(0, 1000);
      if (!Number.isInteger(contentVersion) || contentVersion < 0 || !error) {
        return res.status(400).json({
          ok: false,
          error: "contentVersion (non-negative integer) and a non-empty error are required",
        });
      }

      const updated = await reactRole.recordSyncFailure(scope.app, scope.guildId, {
        contentVersion,
        error,
      });
      if (!updated) {
        return res.status(404).json({ ok: false, error: "React-for-role message not found" });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/react-role/sync-failed error:", err);
      res.status(500).json({ ok: false, error: "Failed to record react-for-role sync failure" });
    }
  },
);

/**
 * POST /api/react-role/confirm-delete
 * Bot-only: confirm the live message has been removed (or was already gone), hard-deleting the
 * row (and its bindings, via cascade). Idempotent.
 * Body: { app, guildId }
 * Auth: bot or admin required (guild-scoped bot accounts restricted to their own guildId).
 * @openapi
 * /api/react-role/confirm-delete:
 *   post:
 *     operationId: confirmReactRoleDelete
 *     tags: [React Role]
 *     summary: Confirm the live react-for-role message has been removed
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId]
 *             properties:
 *               app: { type: string, enum: [discord, fluxer] }
 *               guildId: { type: string }
 *     responses:
 *       '200':
 *         description: Confirmed (or already gone).
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
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/confirm-delete",
  authenticate,
  requireBotOrAdmin,
  requireOwnGuildOrAdmin,
  async (req, res) => {
    try {
      const scope = resolveGuildScope(req);
      if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
      await reactRole.hardDeleteMessage(scope.app, scope.guildId);
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/react-role/confirm-delete error:", err);
      res.status(500).json({ ok: false, error: "Failed to confirm react-for-role deletion" });
    }
  },
);

export default router;
