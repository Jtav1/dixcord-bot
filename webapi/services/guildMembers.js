/**
 * Per-(app, guild_id, platform_user_id) server membership: Discord handle/nickname/roles/
 * joined-at. The link to chat_member_mapping lives in member_aliases, not here.
 */

import db from "../config/db.js";
import { getChatMemberAppConfig } from "./chatMemberMapping.js";
import { utcIsoToSqlDatetime } from "./scheduledMessages.js";

const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";

/**
 * Insert or update one guild_members row keyed on (app, guild_id, platform_user_id).
 * Preserves the row's surrogate id (and therefore any member_aliases link) across syncs.
 * @param {string} app
 * @param {string} guildId
 * @param {{ platformUserId: string, handle?: string|null, nickname?: string|null, roles?: string[], joinedAt?: string|null }} member
 * @returns {Promise<{ skipped: boolean }>}
 * @private
 */
async function upsertOneGuildMember(app, guildId, member) {
  const platformUserId = String(member?.platformUserId ?? "").trim();
  if (!platformUserId) return { skipped: true };

  const handle = member.handle ?? null;
  const nickname = member.nickname ?? null;
  const roles = Array.isArray(member.roles) ? JSON.stringify(member.roles) : null;
  const joinedAt = member.joinedAt ? utcIsoToSqlDatetime(member.joinedAt) : null;

  if (isSqlite) {
    await db.query(
      `INSERT INTO guild_members (app, guild_id, platform_user_id, handle, nickname, roles, joined_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(app, guild_id, platform_user_id) DO UPDATE SET
         handle = excluded.handle,
         nickname = excluded.nickname,
         roles = excluded.roles,
         joined_at = excluded.joined_at,
         synced_at = CURRENT_TIMESTAMP`,
      [app, guildId, platformUserId, handle, nickname, roles, joinedAt],
    );
  } else {
    await db.query(
      `INSERT INTO guild_members (app, guild_id, platform_user_id, handle, nickname, roles, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         handle = VALUES(handle),
         nickname = VALUES(nickname),
         roles = VALUES(roles),
         joined_at = VALUES(joined_at),
         synced_at = CURRENT_TIMESTAMP`,
      [app, guildId, platformUserId, handle, nickname, roles, joinedAt],
    );
  }
  return { skipped: false };
}

/**
 * Upsert a batch of members for (app, guildId). Never touches chat_member_mapping or
 * member_aliases — identity linking is a fully separate, manual, future admin action.
 * Never deletes: a member who has left the guild keeps their guild_members row (and any
 * alias link) as a historical record. Safe to call with a full roster or a single member.
 * @param {string} app
 * @param {string} guildId
 * @param {Array<{ platformUserId: string, handle?: string|null, nickname?: string|null, roles?: string[], joinedAt?: string|null }>} members
 * @returns {Promise<{ ok: true, imported: number, skipped: number } | { ok: false, error: string }>}
 */
export async function upsertGuildMembers(app, guildId, members) {
  if (!getChatMemberAppConfig(app)) {
    return { ok: false, error: "Unsupported app" };
  }
  if (!Array.isArray(members)) {
    return { ok: false, error: "members must be an array" };
  }

  let imported = 0;
  let skipped = 0;
  for (const member of members) {
    const result = await upsertOneGuildMember(app, guildId, member);
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    imported += 1;
  }

  return { ok: true, imported, skipped };
}

/**
 * List one server's members, left-joined through member_aliases for display name.
 * Unlinked members (no member_aliases row yet) appear with id/name null.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<Array<{ id: number|null, name: string|null, handle: string|null, platformUserId: string, nickname: string|null, roles: string[], joinedAt: string|null, syncedAt: string }> | null>} null if app unsupported.
 */
export async function listGuildMembers(app, guildId) {
  const appConfig = getChatMemberAppConfig(app);
  if (!appConfig) return null;

  const [rows] = await db.query(
    `SELECT ma.chat_member_mapping_id AS id, cmm.name AS name,
            gm.handle AS handle, gm.platform_user_id AS platformUserId,
            gm.nickname AS nickname, gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM guild_members gm
     LEFT JOIN member_aliases ma ON ma.guild_member_id = gm.id
     LEFT JOIN chat_member_mapping cmm ON cmm.id = ma.chat_member_mapping_id
     WHERE gm.app = ? AND gm.guild_id = ?`,
    [app, guildId],
  );
  return (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
}

/**
 * List every member across all guilds for an app, deduplicated by platformUserId (the
 * most-recently-synced row per id wins). Backs cross-guild identity lookups that don't
 * care which specific guild a member was last seen in (e.g. admin-panel display chips).
 * @param {string} app
 * @returns {Promise<Array<{ id: number|null, name: string|null, handle: string|null, platformUserId: string, nickname: string|null, roles: string[], joinedAt: string|null, syncedAt: string }> | null>} null if app unsupported.
 */
export async function listAllGuildMembers(app) {
  const appConfig = getChatMemberAppConfig(app);
  if (!appConfig) return null;

  const [rows] = await db.query(
    `SELECT ma.chat_member_mapping_id AS id, cmm.name AS name,
            gm.handle AS handle, gm.platform_user_id AS platformUserId,
            gm.nickname AS nickname, gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM guild_members gm
     LEFT JOIN member_aliases ma ON ma.guild_member_id = gm.id
     LEFT JOIN chat_member_mapping cmm ON cmm.id = ma.chat_member_mapping_id
     WHERE gm.app = ?
       AND gm.synced_at = (
         SELECT MAX(gm2.synced_at) FROM guild_members gm2
         WHERE gm2.app = gm.app AND gm2.platform_user_id = gm.platform_user_id
       )`,
    [app],
  );
  return (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
}

/**
 * List guild_members rows with no resolved identity link yet (admin manual-link workflow).
 * Linking/merging these is a future capability; this is read-only.
 * @param {{ app?: string, guildId?: string }} [filters]
 * @returns {Promise<Array<{ app: string, guildId: string, platformUserId: string, handle: string|null, nickname: string|null, roles: string[], joinedAt: string|null, syncedAt: string }>>}
 */
export async function listUnlinkedGuildMembers({ app, guildId } = {}) {
  const conditions = ["NOT EXISTS (SELECT 1 FROM member_aliases ma WHERE ma.guild_member_id = gm.id)"];
  const params = [];
  if (app) {
    conditions.push("gm.app = ?");
    params.push(app);
  }
  if (guildId) {
    conditions.push("gm.guild_id = ?");
    params.push(guildId);
  }
  const [rows] = await db.query(
    `SELECT gm.app AS app, gm.guild_id AS guildId, gm.platform_user_id AS platformUserId,
            gm.handle AS handle, gm.nickname, gm.roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM guild_members gm
     WHERE ${conditions.join(" AND ")}
     ORDER BY gm.synced_at DESC`,
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
     FROM member_aliases ma
     JOIN guild_members gm ON gm.id = ma.guild_member_id
     LEFT JOIN guild_info gi ON gi.app = gm.app AND gi.guild_id = gm.guild_id
     WHERE ma.chat_member_mapping_id = ?`,
    [chatMemberMappingId],
  );
  return (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
}
