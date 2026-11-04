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

/** Max react-role posts per (app, guild). Mirrored in webadmin's ReactForRoleView. */
const MAX_MESSAGES_PER_GUILD = 10;

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
 * Parse the :id path param.
 * @param {import("express").Request} req
 * @returns {number|null} Positive integer id, or null if malformed.
 */
function parseMessageId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Validate and normalize the shared create/update body fields.
 * @param {import("express").Request} req
 * @returns {{ ok: true, fields: object } | { ok: false, error: string }}
 */
function parseMessageFields(req) {
  const channelId = String(req.body?.channelId ?? "").trim();
  const title = String(req.body?.title ?? "").trim();
  const description = req.body?.description != null ? String(req.body.description).trim() : null;
  if (!channelId || !title) {
    return { ok: false, error: "channelId and title are required" };
  }
  const bindings = (Array.isArray(req.body?.bindings) ? req.body.bindings : []).map((b) => ({
    emoji: typeof b?.emoji === "string" ? b.emoji.trim() : b?.emoji,
    roleId: typeof b?.roleId === "string" ? b.roleId.trim() : b?.roleId,
    description: typeof b?.description === "string" ? b.description.trim() : b?.description,
  }));
  const bindingsError = validateBindings(bindings);
  if (bindingsError) return { ok: false, error: bindingsError };
  return { ok: true, fields: { channelId, title, description, bindings } };
}

/**
 * Validate a message's bindings array. Returns the first validation error found, or null.
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
 * @openapi
 * components:
 *   schemas:
 *     ReactRoleMessage:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         app: { type: string }
 *         guildId: { type: string }
 *         channelId: { type: string }
 *         messageId: { type: string, nullable: true }
 *         title: { type: string }
 *         description: { type: string, nullable: true }
 *         contentVersion: { type: integer }
 *         syncedVersion: { type: integer }
 *         pendingDelete: { type: boolean }
 *         lastSyncError: { type: string, nullable: true, description: "The bot's last post/edit failure message, if any." }
 *         lastSyncErrorVersion: { type: integer, nullable: true, description: "The contentVersion lastSyncError applies to; stale once contentVersion has moved past it." }
 *         bindings:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer }
 *               emoji: { type: string }
 *               roleId: { type: string }
 *               description: { type: string }
 *               sortOrder: { type: integer }
 */

/**
 * GET /api/react-role
 * Lists a server's react-for-role messages (any number, up to MAX_MESSAGES_PER_GUILD). Used by
 * webadmin (list view) and the bot (reconciliation read).
 * Query: { app, guildId }
 * Auth: required. A guild-scoped bot account may only read its own guildId.
 * @openapi
 * /api/react-role:
 *   get:
 *     operationId: listReactRoleMessages
 *     tags: [React Role]
 *     summary: List the react-for-role messages for one server
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
 *         description: The server's messages, oldest first (empty if none).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 messages:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ReactRoleMessage' }
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
    const messages = await reactRole.listMessagesWithBindings(scope.app, scope.guildId);
    res.json({ ok: true, messages });
  } catch (err) {
    console.error("GET /api/react-role error:", err);
    res.status(500).json({ ok: false, error: "Failed to list react-for-role messages" });
  }
});

/**
 * GET /api/react-role/:id
 * Returns one react-for-role message. Polled by webadmin right after a save to see the sync result.
 * Query: { app, guildId }
 * Auth: required. A guild-scoped bot account may only read its own guildId.
 * @openapi
 * /api/react-role/{id}:
 *   get:
 *     operationId: getReactRoleMessage
 *     tags: [React Role]
 *     summary: Get one react-for-role message
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
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
 *         description: The message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 message: { $ref: '#/components/schemas/ReactRoleMessage' }
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
router.get("/:id", authenticate, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
    const id = parseMessageId(req);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid message id" });
    const message = await reactRole.getMessageWithBindings(id, scope.app, scope.guildId);
    if (!message) return res.status(404).json({ ok: false, error: "React-for-role message not found" });
    res.json({ ok: true, message });
  } catch (err) {
    console.error("GET /api/react-role/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to load react-for-role message" });
  }
});

/**
 * POST /api/react-role
 * Create a react-for-role message for a server (max MAX_MESSAGES_PER_GUILD). The live
 * Discord/Fluxer message is posted asynchronously by the bot's reconciliation loop.
 * Body: { app, guildId, channelId, title, description?, bindings: [{emoji, roleId, description}] }
 * Auth: admin required.
 * @openapi
 * /api/react-role:
 *   post:
 *     operationId: createReactRoleMessage
 *     tags: [React Role]
 *     summary: Create a react-for-role message for a server
 *     description: Requires the admin role. Rejects duplicate emoji or role entries, and any message beyond the per-server cap of 10.
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
 *       '201':
 *         description: Created message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 message: { $ref: '#/components/schemas/ReactRoleMessage' }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
    const parsed = parseMessageFields(req);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

    if ((await reactRole.countMessages(scope.app, scope.guildId)) >= MAX_MESSAGES_PER_GUILD) {
      return res.status(400).json({
        ok: false,
        error: `A server can have at most ${MAX_MESSAGES_PER_GUILD} react-for-role messages`,
      });
    }

    const message = await reactRole.createMessage(scope.app, scope.guildId, parsed.fields);
    await recordAudit(req.user.id, "create", "react_role_messages", message.id, {
      app: scope.app,
      guildId: scope.guildId,
      channelId: parsed.fields.channelId,
      title: parsed.fields.title,
      bindingCount: parsed.fields.bindings.length,
    });
    res.status(201).json({ ok: true, message });
  } catch (err) {
    console.error("POST /api/react-role error:", err);
    res.status(500).json({ ok: false, error: "Failed to create react-for-role message" });
  }
});

/**
 * PUT /api/react-role/:id
 * Update a react-for-role message. Bumps content_version so the bot's reconciliation loop picks
 * up the change; the live message itself is edited asynchronously by the bot.
 * Body: { app, guildId, channelId, title, description?, bindings: [{emoji, roleId, description}] }
 * Auth: admin required.
 * @openapi
 * /api/react-role/{id}:
 *   put:
 *     operationId: updateReactRoleMessage
 *     tags: [React Role]
 *     summary: Update a react-for-role message
 *     description: Requires the admin role. Rejects duplicate emoji or role entries.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
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
 *         description: Saved message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 message: { $ref: '#/components/schemas/ReactRoleMessage' }
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
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
    const id = parseMessageId(req);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid message id" });
    const parsed = parseMessageFields(req);
    if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

    const message = await reactRole.updateMessage(id, scope.app, scope.guildId, parsed.fields);
    if (!message) return res.status(404).json({ ok: false, error: "React-for-role message not found" });
    await recordAudit(req.user.id, "update", "react_role_messages", id, {
      app: scope.app,
      guildId: scope.guildId,
      channelId: parsed.fields.channelId,
      title: parsed.fields.title,
      bindingCount: parsed.fields.bindings.length,
    });
    res.json({ ok: true, message });
  } catch (err) {
    console.error("PUT /api/react-role/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to save react-for-role message" });
  }
});

/**
 * DELETE /api/react-role/:id
 * Soft-deletes a react-for-role message: flags it for removal. The bot removes the live
 * Discord/Fluxer message on its next reconciliation pass, then confirms via
 * POST /api/react-role/:id/confirm-delete, which is what actually removes the row. Idempotent.
 * Body: { app, guildId }
 * Auth: admin required.
 * @openapi
 * /api/react-role/{id}:
 *   delete:
 *     operationId: deleteReactRoleMessage
 *     tags: [React Role]
 *     summary: Delete a react-for-role message
 *     description: >
 *       Requires the admin role. Soft-deletes (flags pending_delete); the bot performs the
 *       actual live-message deletion and hard-deletes the row via confirm-delete.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
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
 *         description: Deletion requested (or already gone).
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
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const scope = resolveGuildScope(req);
    if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
    const id = parseMessageId(req);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid message id" });
    await reactRole.markPendingDelete(id, scope.app, scope.guildId);
    await recordAudit(req.user.id, "delete", "react_role_messages", id, {
      app: scope.app,
      guildId: scope.guildId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/react-role/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete react-for-role message" });
  }
});

/**
 * POST /api/react-role/:id/synced
 * Bot-only: record that the live message has been successfully posted or edited to match
 * contentVersion.
 * Body: { app, guildId, messageId, channelId, syncedVersion }
 * Auth: bot or admin required (guild-scoped bot accounts restricted to their own guildId).
 * @openapi
 * /api/react-role/{id}/synced:
 *   post:
 *     operationId: markReactRoleSynced
 *     tags: [React Role]
 *     summary: Record that the bot has synced the live message to the current content version
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
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
  "/:id/synced",
  authenticate,
  requireBotOrAdmin,
  requireOwnGuildOrAdmin,
  async (req, res) => {
    try {
      const scope = resolveGuildScope(req);
      if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
      const id = parseMessageId(req);
      if (!id) return res.status(400).json({ ok: false, error: "Invalid message id" });

      const messageId = String(req.body?.messageId ?? "").trim();
      const channelId = String(req.body?.channelId ?? "").trim();
      const syncedVersion = Number(req.body?.syncedVersion);
      if (!messageId || !channelId || !Number.isInteger(syncedVersion) || syncedVersion < 0) {
        return res.status(400).json({
          ok: false,
          error: "messageId, channelId, and a non-negative integer syncedVersion are required",
        });
      }

      const updated = await reactRole.markSynced(id, scope.app, scope.guildId, {
        messageId,
        channelId,
        syncedVersion,
      });
      if (!updated) {
        return res.status(404).json({ ok: false, error: "React-for-role message not found" });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/react-role/:id/synced error:", err);
      res.status(500).json({ ok: false, error: "Failed to record react-for-role sync" });
    }
  },
);

/**
 * POST /api/react-role/:id/sync-failed
 * Bot-only: record that the bot failed to post/edit the live message for a content version, so
 * the admin panel (polling GET right after a save) can surface why it didn't take effect.
 * Body: { app, guildId, contentVersion, error }
 * Auth: bot or admin required (guild-scoped bot accounts restricted to their own guildId).
 * @openapi
 * /api/react-role/{id}/sync-failed:
 *   post:
 *     operationId: markReactRoleSyncFailed
 *     tags: [React Role]
 *     summary: Record that the bot failed to post/edit the live message for a content version
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
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
  "/:id/sync-failed",
  authenticate,
  requireBotOrAdmin,
  requireOwnGuildOrAdmin,
  async (req, res) => {
    try {
      const scope = resolveGuildScope(req);
      if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
      const id = parseMessageId(req);
      if (!id) return res.status(400).json({ ok: false, error: "Invalid message id" });

      const contentVersion = Number(req.body?.contentVersion);
      const error = String(req.body?.error ?? "").trim().slice(0, 1000);
      if (!Number.isInteger(contentVersion) || contentVersion < 0 || !error) {
        return res.status(400).json({
          ok: false,
          error: "contentVersion (non-negative integer) and a non-empty error are required",
        });
      }

      const updated = await reactRole.recordSyncFailure(id, scope.app, scope.guildId, {
        contentVersion,
        error,
      });
      if (!updated) {
        return res.status(404).json({ ok: false, error: "React-for-role message not found" });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/react-role/:id/sync-failed error:", err);
      res.status(500).json({ ok: false, error: "Failed to record react-for-role sync failure" });
    }
  },
);

/**
 * POST /api/react-role/:id/confirm-delete
 * Bot-only: confirm the live message has been removed (or was already gone), hard-deleting the
 * row (and its bindings, via cascade). Idempotent.
 * Body: { app, guildId }
 * Auth: bot or admin required (guild-scoped bot accounts restricted to their own guildId).
 * @openapi
 * /api/react-role/{id}/confirm-delete:
 *   post:
 *     operationId: confirmReactRoleDelete
 *     tags: [React Role]
 *     summary: Confirm a live react-for-role message has been removed
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
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
  "/:id/confirm-delete",
  authenticate,
  requireBotOrAdmin,
  requireOwnGuildOrAdmin,
  async (req, res) => {
    try {
      const scope = resolveGuildScope(req);
      if (!scope.ok) return res.status(scope.status).json({ ok: false, error: scope.error });
      const id = parseMessageId(req);
      if (!id) return res.status(400).json({ ok: false, error: "Invalid message id" });
      await reactRole.hardDeleteMessage(id, scope.app, scope.guildId);
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/react-role/:id/confirm-delete error:", err);
      res.status(500).json({ ok: false, error: "Failed to confirm react-for-role deletion" });
    }
  },
);

export default router;
