/**
 * Resolve platform user id strings to chat_member_mapping.id for FK writes.
 * SQL uses per-app columns on chat_member_mapping (e.g. discord_id for app "discord").
 */

import db from "../config/db.js";

/**
 * Per chat app: unique id column on chat_member_mapping, handle column for import, row pickers.
 * Only keys listed here are accepted; expand when adding platforms.
 * Column names are whitelisted for dynamic SQL (never from user input).
 */
export const CHAT_MEMBER_APP_CONFIG = Object.freeze({
  discord: {
    handleColumn: "discord_handle",
    idColumn: "discord_id",
    /** @param {Record<string, unknown>} row */
    pickHandle: (row) => row.discord_handle,
    /** @param {Record<string, unknown>} row */
    pickId: (row) => row.discord_id,
  },
});

/**
 * @param {unknown} app
 * @returns {app is keyof typeof CHAT_MEMBER_APP_CONFIG}
 */
export function isChatMemberAppSupported(app) {
  return (
    typeof app === "string" &&
    Object.prototype.hasOwnProperty.call(CHAT_MEMBER_APP_CONFIG, app)
  );
}

/**
 * @param {string} app
 * @returns {string}
 */
export function getChatMemberIdColumn(app) {
  return CHAT_MEMBER_APP_CONFIG[app].idColumn;
}

/**
 * @param {unknown} app
 * @returns {{ handleColumn: string, idColumn: string, pickHandle: Function, pickId: Function } | null}
 */
export function getChatMemberAppConfig(app) {
  if (!isChatMemberAppSupported(app)) return null;
  return CHAT_MEMBER_APP_CONFIG[app];
}

/**
 * @param {unknown} platformUserId - snowflake / platform user id string
 * @param {string} app - e.g. "discord"
 * @returns {Promise<number | null>} chat_member_mapping.id, or null if not found
 */
export async function getChatMemberMappingIdByPlatformUserId(
  platformUserId,
  app,
) {
  if (!isChatMemberAppSupported(app)) return null;
  const idCol = getChatMemberIdColumn(app);
  const id = String(platformUserId ?? "").trim();
  if (!id) return null;
  const [rows] = await db.query(
    `SELECT id FROM chat_member_mapping WHERE \`${idCol}\` = ?`,
    [id],
  );
  if (!rows || rows.length === 0) return null;
  const n = Number(rows[0].id);
  return Number.isFinite(n) ? n : null;
}

/** @deprecated Use getChatMemberMappingIdByPlatformUserId(id, "discord") */
export async function getChatMemberMappingIdByDiscordId(discordId) {
  return getChatMemberMappingIdByPlatformUserId(discordId, "discord");
}

export const UNKNOWN_CHAT_MEMBER_ERROR =
  "Unknown user; not in chat_member_mapping for this app.";

/**
 * @param {unknown} platformUserId
 * @param {string} app
 * @returns {Promise<{ ok: true, id: number } | { ok: false, error: string }>}
 */
export async function requireChatMemberMappingId(platformUserId, app) {
  if (!isChatMemberAppSupported(app)) {
    return { ok: false, error: 'Unsupported app; use "discord".' };
  }
  const mid = await getChatMemberMappingIdByPlatformUserId(
    platformUserId,
    app,
  );
  if (mid == null) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
  return { ok: true, id: mid };
}
