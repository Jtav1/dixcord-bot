/**
 * Resolve platform user id strings to chat_member_mapping.id via guild_members + member_aliases.
 */

import db from "../config/db.js";

/**
 * Chat apps accepted throughout the codebase. Expand when adding platforms.
 */
export const CHAT_MEMBER_APP_CONFIG = Object.freeze({
  discord: {},
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
 * Pure existence guard — guild_members/chat_member_mapping columns are fixed and app-agnostic,
 * so this no longer resolves per-app column names, only whether `app` is a supported value.
 * @param {unknown} app
 * @returns {{} | null}
 */
export function getChatMemberAppConfig(app) {
  if (!isChatMemberAppSupported(app)) return null;
  return CHAT_MEMBER_APP_CONFIG[app];
}

/**
 * A real Discord account's platform_user_id is identical across every guild it's in, so this
 * resolves via any guild_members row for that id that has been manually linked (member_aliases)
 * — no guildId needed. Returns null if unlinked or unknown; never creates a mapping.
 * @param {unknown} platformUserId - snowflake / platform user id string
 * @param {string} app - e.g. "discord"
 * @returns {Promise<number | null>} chat_member_mapping.id, or null if not found/unlinked
 */
export async function getChatMemberMappingIdByPlatformUserId(
  platformUserId,
  app,
) {
  if (!isChatMemberAppSupported(app)) return null;
  const id = String(platformUserId ?? "").trim();
  if (!id) return null;
  const [rows] = await db.query(
    `SELECT ma.chat_member_mapping_id AS id
     FROM guild_members gm
     JOIN member_aliases ma ON ma.guild_member_id = gm.id
     WHERE gm.app = ? AND gm.platform_user_id = ?
     LIMIT 1`,
    [app, id],
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
  const mid = await getChatMemberMappingIdByPlatformUserId(platformUserId, app);
  if (mid == null) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
  return { ok: true, id: mid };
}
