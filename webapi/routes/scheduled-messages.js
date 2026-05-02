import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getScheduledMessageById,
  createScheduledMessage,
  deletePendingScheduledMessageByIdForUser,
  getPendingScheduledMessagesForBot,
  getUpcomingScheduledMessagesByUserId,
  normalizeUtcIsoString,
  updateScheduledMessageById,
} from "../services/scheduledMessages.js";
import { requireChatMemberMappingId } from "../services/chatMemberMapping.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";

const router = express.Router();

/**
 * Resolve requester platform user id to chat_member_mapping.id.
 * @param {import("express").Request} req
 * @returns {Promise<{ ok: true, app: string, userId: number } | { ok: false, status: number, error: string }>}
 */
async function resolveRequesterMapping(req) {
  const app = resolveChatAppFromRequest(req);
  if (!app)
    return { ok: false, status: 400, error: CHAT_APP_PARAM_ERROR.error };
  const requesterPlatformUserId =
    req.body?.requesterUserId ?? req.query?.requesterUserId;
  const requester = await requireChatMemberMappingId(
    requesterPlatformUserId,
    app,
  );
  if (!requester.ok) return { ok: false, status: 400, error: requester.error };
  return { ok: true, app, userId: requester.id };
}

/**
 * GET /api/scheduled-messages
 * List upcoming scheduled messages for requester, or bot scope list of all pending rows.
 * Query:
 * - user scope: ?app=<chatApp>&requesterUserId=...
 * - bot scope:  ?scope=bot
 * Auth: required.
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    if (req.query?.scope === "bot") {
      const rows = await getPendingScheduledMessagesForBot(app);
      return res.json({ ok: true, scheduledMessages: rows });
    }

    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }
    const rows = await getUpcomingScheduledMessagesByUserId(
      requester.app,
      requester.userId,
    );
    return res.json({ ok: true, scheduledMessages: rows });
  } catch (err) {
    console.error("GET /api/scheduled-messages error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to list scheduled messages" });
  }
});

/**
 * GET /api/scheduled-messages/:id
 * Get a scheduled message by id; requester must own row.
 * Query: ?app=<chatApp>&requesterUserId=...
 * Auth: required.
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id))
      return res.status(400).json({ ok: false, error: "Invalid id" });

    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }

    const row = await getScheduledMessageById(requester.app, id);
    if (!row)
      return res
        .status(404)
        .json({ ok: false, error: "Scheduled message not found" });
    if (row.user_id !== requester.userId) {
      return res
        .status(403)
        .json({ ok: false, error: "Forbidden: not your scheduled message" });
    }
    return res.json({ ok: true, scheduledMessage: row });
  } catch (err) {
    console.error("GET /api/scheduled-messages/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to get scheduled message" });
  }
});

/**
 * POST /api/scheduled-messages
 * Create a scheduled message.
 * Body: { app, requesterUserId, chat_channel_id, chat_guild_id?, message_body, scheduled_at }
 * Auth: required.
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }

    const channelId = String(req.body?.chat_channel_id ?? "").trim();
    const guildIdRaw = req.body?.chat_guild_id;
    const messageBody = String(req.body?.message_body ?? "").trim();
    const scheduledAt = normalizeUtcIsoString(req.body?.scheduled_at);

    if (!channelId) {
      return res
        .status(400)
        .json({ ok: false, error: "chat_channel_id is required" });
    }
    if (!messageBody) {
      return res
        .status(400)
        .json({ ok: false, error: "message_body is required" });
    }
    if (!scheduledAt) {
      return res
        .status(400)
        .json({ ok: false, error: "scheduled_at must be a valid datetime" });
    }

    const id = await createScheduledMessage({
      userId: requester.userId,
      app: requester.app,
      chatChannelId: channelId,
      chatGuildId:
        guildIdRaw == null || String(guildIdRaw).trim() === ""
          ? null
          : String(guildIdRaw).trim(),
      messageBody,
      scheduledAtUtcIso: scheduledAt,
    });
    if (id == null) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to create scheduled message" });
    }
    const row = await getScheduledMessageById(requester.app, id);
    return res.status(201).json({ ok: true, scheduledMessage: row });
  } catch (err) {
    console.error("POST /api/scheduled-messages error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to create scheduled message" });
  }
});

/**
 * PUT /api/scheduled-messages/:id
 * Update user-owned message fields OR mark as sent.
 * Body (user update): { app, requesterUserId, message_body?, scheduled_at? }
 * Body (bot sent-mark): { scope: "bot", status: "sent", sent_at? }
 * Auth: required.
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id))
      return res.status(400).json({ ok: false, error: "Invalid id" });

    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const existing = await getScheduledMessageById(app, id);
    if (!existing)
      return res
        .status(404)
        .json({ ok: false, error: "Scheduled message not found" });

    // Bot scope update (used by scheduler to mark sent).
    if (req.body?.scope === "bot") {
      if (req.body?.status !== "sent") {
        return res
          .status(400)
          .json({ ok: false, error: 'Bot updates only support status "sent"' });
      }
      const sentAt = normalizeUtcIsoString(
        req.body?.sent_at ?? new Date().toISOString(),
      );
      const updated = await updateScheduledMessageById(id, {
        status: "sent",
        sent_at: sentAt,
      });
      if (!updated) {
        return res.status(500).json({
          ok: false,
          error: "Failed to mark scheduled message as sent",
        });
      }
      const row = await getScheduledMessageById(app, id);
      return res.json({ ok: true, scheduledMessage: row });
    }

    // User scope update.
    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }
    if (existing.user_id !== requester.userId) {
      return res
        .status(403)
        .json({ ok: false, error: "Forbidden: not your scheduled message" });
    }
    if (existing.status !== "pending") {
      return res
        .status(400)
        .json({ ok: false, error: "Cannot edit a sent scheduled message" });
    }

    const updates = {};

    if (req.body?.message_body !== undefined) {
      const body = String(req.body.message_body).trim();
      if (!body)
        return res
          .status(400)
          .json({ ok: false, error: "message_body cannot be empty" });
      updates.message_body = body;
    }
    if (req.body?.scheduled_at !== undefined) {
      const scheduledAt = normalizeUtcIsoString(req.body.scheduled_at);
      if (!scheduledAt) {
        return res
          .status(400)
          .json({ ok: false, error: "scheduled_at must be a valid datetime" });
      }
      updates.scheduled_at = scheduledAt;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Provide message_body and/or scheduled_at to update",
      });
    }

    const updated = await updateScheduledMessageById(id, updates);
    if (!updated)
      return res
        .status(500)
        .json({ ok: false, error: "Failed to update scheduled message" });
    const row = await getScheduledMessageById(requester.app, id);
    return res.json({ ok: true, scheduledMessage: row });
  } catch (err) {
    console.error("PUT /api/scheduled-messages/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to update scheduled message" });
  }
});

/**
 * DELETE /api/scheduled-messages/:id
 * Delete pending scheduled message by id when owned by requester.
 * Body/query: { app, requesterUserId }
 * Auth: required.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id))
      return res.status(400).json({ ok: false, error: "Invalid id" });

    const requester = await resolveRequesterMapping(req);
    if (!requester.ok) {
      return res
        .status(requester.status)
        .json({ ok: false, error: requester.error });
    }

    const deleted = await deletePendingScheduledMessageByIdForUser(
      id,
      requester.userId,
    );
    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Pending scheduled message not found for requester",
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/scheduled-messages/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to delete scheduled message" });
  }
});

export default router;
