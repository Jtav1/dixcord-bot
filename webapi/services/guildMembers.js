/**
 * Per-(app, guild_id, chat_member_mapping_id) server membership: nickname/roles/joined-at
 * held in that server. chat_member_mapping stays the single global cross-server identity
 * these rows hang off of.
 */

import db from "../config/db.js";
import {
  getChatMemberAppConfig,
  requireChatMemberMappingId,
} from "./chatMemberMapping.js";
import { utcIsoToSqlDatetime } from "./scheduledMessages.js";

/**
 * Full-replace sync of one server's membership list, matching the guild_channels/guild_roles
 * delete-then-reinsert pattern. Entries whose platformUserId can't be resolved to an existing
 * chat_member_mapping row are skipped (best-effort), not treated as a failure of the whole sync.
 * @param {string} app
 * @param {string} guildId
 * @param {Array<{ platformUserId: string, nickname?: string|null, roles?: string[], joinedAt?: string|null }>} members
 * @returns {Promise<{ ok: true, imported: number, skipped: number } | { ok: false, error: string }>}
 */
export async function upsertGuildMembers(app, guildId, members) {
  if (!getChatMemberAppConfig(app)) {
    return { ok: false, error: "Unsupported app" };
  }
  if (!Array.isArray(members)) {
    return { ok: false, error: "members must be an array" };
  }

  await db.query("DELETE FROM guild_members WHERE app = ? AND guild_id = ?", [app, guildId]);

  let imported = 0;
  let skipped = 0;
  for (const member of members) {
    const resolved = await requireChatMemberMappingId(member?.platformUserId, app);
    if (!resolved.ok) {
      skipped += 1;
      continue;
    }
    await db.query(
      `INSERT INTO guild_members (app, guild_id, chat_member_mapping_id, nickname, roles, joined_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        app,
        guildId,
        resolved.id,
        member.nickname ?? null,
        Array.isArray(member.roles) ? JSON.stringify(member.roles) : null,
        member.joinedAt ? utcIsoToSqlDatetime(member.joinedAt) : null,
      ],
    );
    imported += 1;
  }

  return { ok: true, imported, skipped };
}

/**
 * List one server's members, joined with chat_member_mapping for display name/handle.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<Array<{ id: number, name: string, handle: string, platformUserId: string, nickname: string|null, roles: string[], joinedAt: string|null, syncedAt: string }> | null>} null if app unsupported.
 */
export async function listGuildMembers(app, guildId) {
  const appConfig = getChatMemberAppConfig(app);
  if (!appConfig) return null;

  const [rows] = await db.query(
    `SELECT gm.chat_member_mapping_id AS id, cmm.name AS name,
            cmm.\`${appConfig.handleColumn}\` AS handle, cmm.\`${appConfig.idColumn}\` AS platformUserId,
            gm.nickname AS nickname, gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM guild_members gm
     JOIN chat_member_mapping cmm ON cmm.id = gm.chat_member_mapping_id
     WHERE gm.app = ? AND gm.guild_id = ?`,
    [app, guildId],
  );
  return (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
}

/**
 * Reverse lookup: every server this internal user id belongs to.
 * @param {number} chatMemberMappingId
 * @returns {Promise<Array<{ app: string, guildId: string, guildName: string|null, nickname: string|null, roles: string[], joinedAt: string|null }>>}
 */
export async function listServersForUser(chatMemberMappingId) {
  const [rows] = await db.query(
    `SELECT gm.app AS app, gm.guild_id AS guildId, gi.name AS guildName,
            gm.nickname AS nickname, gm.roles AS roles, gm.joined_at AS joinedAt
     FROM guild_members gm
     LEFT JOIN guild_info gi ON gi.app = gm.app AND gi.guild_id = gm.guild_id
     WHERE gm.chat_member_mapping_id = ?`,
    [chatMemberMappingId],
  );
  return (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
}
