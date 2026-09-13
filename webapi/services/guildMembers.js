/**
 * Per-(app, guild_id, chat_member_mapping_id) server membership: nickname/roles/joined-at.
 */

import db from "../config/db.js";
import {
  getChatMemberAppConfig,
  getChatMemberMappingIdByPlatformUserId,
} from "./chatMemberMapping.js";
import { utcIsoToSqlDatetime } from "./scheduledMessages.js";

/**
 * Full-replace sync of one server's membership list. Every member is always inserted; a member
 * whose platformUserId isn't yet known to chat_member_mapping is inserted unlinked (chat_member_mapping_id
 * NULL) rather than dropped — this never creates chat_member_mapping rows itself, it only links to
 * ones that already exist. See listUnlinkedGuildMembers for the admin-facing follow-up.
 * @param {string} app
 * @param {string} guildId
 * @param {Array<{ platformUserId: string, nickname?: string|null, roles?: string[], joinedAt?: string|null }>} members
 * @returns {Promise<{ ok: true, imported: number, unlinked: number, skipped: number } | { ok: false, error: string }>}
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
  let unlinked = 0;
  let skipped = 0;
  for (const member of members) {
    const platformUserId = String(member?.platformUserId ?? "").trim();
    if (!platformUserId) {
      skipped += 1;
      continue;
    }
    const chatMemberMappingId = await getChatMemberMappingIdByPlatformUserId(platformUserId, app);
    await db.query(
      `INSERT INTO guild_members (app, guild_id, platform_user_id, chat_member_mapping_id, nickname, roles, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        app,
        guildId,
        platformUserId,
        chatMemberMappingId,
        member.nickname ?? null,
        Array.isArray(member.roles) ? JSON.stringify(member.roles) : null,
        member.joinedAt ? utcIsoToSqlDatetime(member.joinedAt) : null,
      ],
    );
    imported += 1;
    if (chatMemberMappingId == null) unlinked += 1;
  }

  return { ok: true, imported, unlinked, skipped };
}

/**
 * List one server's members, left-joined with chat_member_mapping for display name/handle.
 * Unlinked members (no chat_member_mapping match yet) appear with id/name/handle null.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<Array<{ id: number|null, name: string|null, handle: string|null, platformUserId: string, nickname: string|null, roles: string[], joinedAt: string|null, syncedAt: string }> | null>} null if app unsupported.
 */
export async function listGuildMembers(app, guildId) {
  const appConfig = getChatMemberAppConfig(app);
  if (!appConfig) return null;

  const [rows] = await db.query(
    `SELECT gm.chat_member_mapping_id AS id, cmm.name AS name,
            cmm.\`${appConfig.handleColumn}\` AS handle, gm.platform_user_id AS platformUserId,
            gm.nickname AS nickname, gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM guild_members gm
     LEFT JOIN chat_member_mapping cmm ON cmm.id = gm.chat_member_mapping_id
     WHERE gm.app = ? AND gm.guild_id = ?`,
    [app, guildId],
  );
  return (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
}

/**
 * List guild_members rows with no resolved chat_member_mapping_id yet (admin manual-link workflow).
 * Linking/merging these is a future capability; this is read-only.
 * @param {{ app?: string, guildId?: string }} [filters]
 * @returns {Promise<Array<{ app: string, guildId: string, platformUserId: string, nickname: string|null, roles: string[], joinedAt: string|null, syncedAt: string }>>}
 */
export async function listUnlinkedGuildMembers({ app, guildId } = {}) {
  const conditions = ["chat_member_mapping_id IS NULL"];
  const params = [];
  if (app) {
    conditions.push("app = ?");
    params.push(app);
  }
  if (guildId) {
    conditions.push("guild_id = ?");
    params.push(guildId);
  }
  const [rows] = await db.query(
    `SELECT app, guild_id AS guildId, platform_user_id AS platformUserId,
            nickname, roles, joined_at AS joinedAt, synced_at AS syncedAt
     FROM guild_members
     WHERE ${conditions.join(" AND ")}
     ORDER BY synced_at DESC`,
    params,
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
