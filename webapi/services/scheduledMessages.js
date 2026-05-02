/**
 * Scheduled message data access + UTC normalization helpers.
 * Handles mysql/sqlite compatible datetime persistence.
 */

import db from "../config/db.js";

/**
 * Per-app scheduled message channel/guild column mapping.
 * Extend this map when adding new chat clients.
 */
export const SCHEDULED_MESSAGE_APP_CONFIG = Object.freeze({
  discord: {
    channelIdColumn: "discord_channel_id",
    guildIdColumn: "discord_guild_id",
  },
});

/**
 * Get scheduled message column config for an app.
 * @param {string} app - Chat app key.
 * @returns {{ channelIdColumn: string, guildIdColumn: string }|null} Column config or null.
 */
export function getScheduledMessageAppConfig(app) {
  if (
    typeof app !== "string" ||
    !Object.prototype.hasOwnProperty.call(SCHEDULED_MESSAGE_APP_CONFIG, app)
  ) {
    return null;
  }
  return SCHEDULED_MESSAGE_APP_CONFIG[app];
}

/**
 * Convert unknown input into an ISO 8601 UTC timestamp string ending with Z.
 * @param {unknown} value - Input datetime value.
 * @returns {string|null} ISO UTC string (e.g. 2026-05-01T14:00:00.000Z), or null when invalid.
 */
export function normalizeUtcIsoString(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Convert an ISO UTC datetime into SQL DATETIME string in UTC.
 * @param {string} isoUtc - ISO UTC string.
 * @returns {string|null} UTC DATETIME string (YYYY-MM-DD HH:mm:ss), or null when invalid.
 */
export function utcIsoToSqlDatetime(isoUtc) {
  const normalized = normalizeUtcIsoString(isoUtc);
  if (!normalized) return null;
  return normalized.slice(0, 19).replace("T", " ");
}

/**
 * Convert database datetime values into ISO UTC string.
 * @param {unknown} value - DATETIME/TEXT value from database.
 * @returns {string|null} ISO UTC string ending with Z, or null.
 */
export function dbDatetimeToUtcIso(value) {
  if (!value) return null;
  // DB stores UTC without zone marker, so force UTC parsing.
  const normalized = String(value).includes("T")
    ? String(value)
    : String(value).replace(" ", "T");
  const iso = normalizeUtcIsoString(`${normalized.replace(/Z$/, "")}Z`);
  return iso;
}

/**
 * Serialize one scheduled_messages row for API responses.
 * @param {Record<string, unknown>} row - DB row.
 * @param {string} app - Chat app key used for channel/guild column mapping.
 * @returns {{ id: number, user_id: number, app: string, chat_channel_id: string, chat_guild_id: string|null, message_body: string, scheduled_at: string|null, status: string, sent_at: string|null, created_at: string|null }}
 */
export function serializeScheduledMessageRow(row, app) {
  const cfg = getScheduledMessageAppConfig(app);
  if (!cfg) throw new Error(`Unsupported scheduled message app: ${app}`);
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    app,
    chat_channel_id: String(row[cfg.channelIdColumn]),
    chat_guild_id:
      row[cfg.guildIdColumn] == null ? null : String(row[cfg.guildIdColumn]),
    message_body: String(row.message_body),
    scheduled_at: dbDatetimeToUtcIso(row.scheduled_at),
    status: String(row.status),
    sent_at: dbDatetimeToUtcIso(row.sent_at),
    created_at: dbDatetimeToUtcIso(row.created_at),
  };
}

/**
 * Insert a scheduled message row.
 * @param {{ app: string, userId: number, chatChannelId: string, chatGuildId?: string|null, messageBody: string, scheduledAtUtcIso: string }} payload - Message fields.
 * @returns {Promise<number|null>} Inserted row id.
 */
export async function createScheduledMessage(payload) {
  console.log(payload);

  const cfg = getScheduledMessageAppConfig(payload.app);
  if (!cfg) return null;
  const scheduledAtSql = utcIsoToSqlDatetime(payload.scheduledAtUtcIso);
  if (!scheduledAtSql) return null;
  const [result] = await db.query(
    `INSERT INTO scheduled_messages
      (user_id, \`${cfg.channelIdColumn}\`, \`${cfg.guildIdColumn}\`, message_body, scheduled_at, status, sent_at)
     VALUES (?, ?, ?, ?, ?, 'pending', NULL)`,
    [
      payload.userId,
      payload.chatChannelId,
      payload.chatGuildId ?? null,
      payload.messageBody,
      scheduledAtSql,
    ],
  );
  return Number(result?.insertId ?? result?.lastInsertRowid ?? null);
}

/**
 * Get one scheduled message by id.
 * @param {string} app - Chat app key.
 * @param {number} id - scheduled_messages.id
 * @returns {Promise<ReturnType<typeof serializeScheduledMessageRow>|null>} Serialized row or null.
 */
export async function getScheduledMessageById(app, id) {
  const [rows] = await db.query(
    "SELECT * FROM scheduled_messages WHERE id = ?",
    [id],
  );
  if (!rows || rows.length === 0) return null;
  return serializeScheduledMessageRow(rows[0], app);
}

/**
 * Get unsent upcoming scheduled messages for a specific user.
 * @param {string} app - Chat app key.
 * @param {number} userId - chat_member_mapping.id
 * @returns {Promise<Array<ReturnType<typeof serializeScheduledMessageRow>>>} User-owned pending/future rows.
 */
export async function getUpcomingScheduledMessagesByUserId(app, userId) {
  const cfg = getScheduledMessageAppConfig(app);
  if (!cfg) return [];
  const nowSql = utcIsoToSqlDatetime(new Date().toISOString());
  const [rows] = await db.query(
    `SELECT * FROM scheduled_messages
     WHERE user_id = ? AND status = 'pending' AND scheduled_at > ? AND \`${cfg.channelIdColumn}\` IS NOT NULL
     ORDER BY scheduled_at ASC, id ASC`,
    [userId, nowSql],
  );
  return Array.isArray(rows)
    ? rows.map((row) => serializeScheduledMessageRow(row, app))
    : [];
}

/**
 * Get all pending scheduled messages for bot scheduler refresh.
 * @param {string} app - Chat app key.
 * @returns {Promise<Array<ReturnType<typeof serializeScheduledMessageRow>>>} Pending rows sorted by schedule time.
 */
export async function getPendingScheduledMessagesForBot(app) {
  const cfg = getScheduledMessageAppConfig(app);
  if (!cfg) return [];
  const [rows] = await db.query(
    `SELECT * FROM scheduled_messages
     WHERE status = 'pending' AND \`${cfg.channelIdColumn}\` IS NOT NULL
     ORDER BY scheduled_at ASC, id ASC`,
  );
  return Array.isArray(rows)
    ? rows.map((row) => serializeScheduledMessageRow(row, app))
    : [];
}

/**
 * Update one scheduled message row by id.
 * @param {number} id - scheduled_messages.id
 * @param {{ message_body?: string, scheduled_at?: string, status?: "pending"|"sent", sent_at?: string|null }} updates - Allowed updates.
 * @returns {Promise<boolean>} True when a row was updated.
 */
export async function updateScheduledMessageById(id, updates) {
  console.log(id);
  console.log(updates);
  const setParts = [];
  const values = [];

  if (typeof updates.message_body === "string") {
    setParts.push("message_body = ?");
    values.push(updates.message_body);
  }
  if (updates.scheduled_at !== undefined) {
    const sql = utcIsoToSqlDatetime(updates.scheduled_at);
    if (!sql) return false;
    setParts.push("scheduled_at = ?");
    values.push(sql);
  }
  if (updates.status !== undefined) {
    setParts.push("status = ?");
    values.push(updates.status);
  }
  if (updates.sent_at !== undefined) {
    if (updates.sent_at === null) {
      setParts.push("sent_at = NULL");
    } else {
      const sentSql = utcIsoToSqlDatetime(updates.sent_at);
      if (!sentSql) return false;
      setParts.push("sent_at = ?");
      values.push(sentSql);
    }
  }

  if (setParts.length === 0) return false;
  values.push(id);
  const [result] = await db.query(
    `UPDATE scheduled_messages SET ${setParts.join(", ")} WHERE id = ?`,
    values,
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Delete a pending scheduled message by id and owner.
 * @param {number} id - scheduled_messages.id
 * @param {number} userId - chat_member_mapping.id owner.
 * @returns {Promise<boolean>} True when a row was deleted.
 */
export async function deletePendingScheduledMessageByIdForUser(id, userId) {
  const [result] = await db.query(
    "DELETE FROM scheduled_messages WHERE id = ? AND user_id = ? AND status = 'pending'",
    [id, userId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
