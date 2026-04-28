import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as scheduledMessages from "../services/scheduledMessages.js";
import { requireChatMemberMappingId } from "../services/chatMemberMapping.js";

const router = express.Router();

/**
 * @param {unknown} value
 * @returns {string}
 */
function appFromQueryOrBody(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "discord";
}

/**
 * Normalize ISO or date-like string to SQL-friendly UTC datetime (YYYY-MM-DD HH:mm:ss).
 * @param {unknown} value
 * @returns {{ ok: true, sql: string } | { ok: false, error: string }}
 */
function toSqlDateTime(value) {
  if (value == null || value === "") {
    return { ok: false, error: "scheduled_at is required" };
  }
  const d = new Date(
    typeof value === "string" || typeof value === "number"
      ? value
      : String(value),
  );
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: "Invalid scheduled_at" };
  }
  const sql = d.toISOString().slice(0, 19).replace("T", " ");
  return { ok: true, sql };
}

/**
 * GET /api/scheduled-messages/due
 * Pending rows with scheduled_at <= now (bot poll).
 * Query: limit? (default 20, max 100)
 */
router.get("/due", authenticate, async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    const rows = await scheduledMessages.listDue(new Date(), limit);
    res.json({ ok: true, messages: rows });
  } catch (err) {
    console.error("GET /api/scheduled-messages/due error:", err);
    res.status(500).json({ ok: false, error: "Failed to list due messages" });
  }
});

/**
 * GET /api/scheduled-messages
 * List messages for a chat user (resolved via chat_member_mapping).
 * Query: discord_user_id (platform snowflake; required), app? (default discord), status? (default pending)
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const discord_user_id = req.query.discord_user_id;
    if (
      !discord_user_id ||
      typeof discord_user_id !== "string" ||
      !discord_user_id.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "discord_user_id query parameter is required",
      });
    }
    const app = appFromQueryOrBody(req.query.app);
    const resolved = await requireChatMemberMappingId(
      discord_user_id.trim(),
      app,
    );
    if (!resolved.ok) {
      return res.status(400).json({ ok: false, error: resolved.error });
    }
    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : "pending";
    if (status !== "pending" && status !== "sent") {
      return res.status(400).json({
        ok: false,
        error: "status must be pending or sent",
      });
    }
    const rows = await scheduledMessages.listForUser(resolved.id, status);
    res.json({ ok: true, messages: rows });
  } catch (err) {
    console.error("GET /api/scheduled-messages error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to list scheduled messages" });
  }
});

/**
 * POST /api/scheduled-messages
 * Body: { discord_user_id, discord_channel_id, discord_guild_id?, message_body, scheduled_at, app? }
 * discord_user_id is resolved to chat_member_mapping.id via app (default discord).
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const body = req.body ?? {};
    const {
      discord_user_id,
      discord_channel_id,
      discord_guild_id,
      message_body,
      scheduled_at,
    } = body;
    const app = appFromQueryOrBody(body.app);
    if (
      !discord_user_id ||
      typeof discord_user_id !== "string" ||
      !discord_user_id.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "discord_user_id is required",
      });
    }
    const resolved = await requireChatMemberMappingId(
      discord_user_id.trim(),
      app,
    );
    if (!resolved.ok) {
      return res.status(400).json({ ok: false, error: resolved.error });
    }
    if (
      !discord_channel_id ||
      typeof discord_channel_id !== "string" ||
      !discord_channel_id.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "discord_channel_id is required",
      });
    }
    if (
      message_body == null ||
      typeof message_body !== "string" ||
      !String(message_body).trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "message_body is required",
      });
    }
    const dt = toSqlDateTime(scheduled_at);
    if (!dt.ok) {
      return res.status(400).json({ ok: false, error: dt.error });
    }

    const id = await scheduledMessages.create({
      user_id: resolved.id,
      discord_channel_id: discord_channel_id.trim(),
      discord_guild_id:
        typeof discord_guild_id === "string" && discord_guild_id.trim()
          ? discord_guild_id.trim()
          : null,
      message_body: String(message_body).trim(),
      scheduled_at: dt.sql,
    });
    if (id == null) {
      return res.status(500).json({ ok: false, error: "Failed to create" });
    }
    const row = await scheduledMessages.getById(id);
    res.status(201).json({ ok: true, ...row });
  } catch (err) {
    console.error("POST /api/scheduled-messages error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to create scheduled message" });
  }
});

/**
 * PATCH /api/scheduled-messages/:id
 * Body: { status: string (must not be "sent") } — mark sent
 */
router.patch("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const status = req.body?.status;
    if (status == "sent") {
      return res.status(400).json({
        ok: false,
        error: 'body.status must not be "sent"',
      });
    }
    const updated = await scheduledMessages.markSent(id);
    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: "Message not found or already sent",
      });
    }
    const row = await scheduledMessages.getById(id);
    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("PATCH /api/scheduled-messages/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to update scheduled message" });
  }
});

/**
 * DELETE /api/scheduled-messages/:id
 * Query: discord_user_id (required), app? (default discord) — only pending rows owned by user
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const discord_user_id = req.query.discord_user_id;
    if (
      !discord_user_id ||
      typeof discord_user_id !== "string" ||
      !discord_user_id.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "discord_user_id query parameter is required",
      });
    }
    const app = appFromQueryOrBody(req.query.app);
    const resolved = await requireChatMemberMappingId(
      discord_user_id.trim(),
      app,
    );
    if (!resolved.ok) {
      return res.status(400).json({ ok: false, error: resolved.error });
    }
    const deleted = await scheduledMessages.removeIfOwnedPending(
      id,
      resolved.id,
    );
    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Scheduled message not found or not deletable",
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/scheduled-messages/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to delete scheduled message" });
  }
});

export default router;
