/**
 * Per-(app, guild_id, platform_user_id) server membership: Discord handle/nickname/roles/
 * joined-at. The link to chat_member_mapping lives in member_aliases, not here.
 */

import db from "../config/db.js";
import { getChatMemberAppConfig } from "./chatMemberMapping.js";
import { attachRoleObjects } from "./guildInfo.js";
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
 * @returns {Promise<Array<{ id: number|null, name: string|null, handle: string|null, platformUserId: string, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string }> | null>} null if app unsupported. `roles` entries are full guild_roles rows (see attachRoleObjects), not bare ids.
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
  const parsed = (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
  return attachRoleObjects(parsed, { app });
}

/**
 * List every member across all guilds for an app, deduplicated by platformUserId (the
 * most-recently-synced row per id wins). Backs cross-guild identity lookups that don't
 * care which specific guild a member was last seen in (e.g. admin-panel display chips).
 * @param {string} app
 * @returns {Promise<Array<{ id: number|null, name: string|null, handle: string|null, platformUserId: string, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string }> | null>} null if app unsupported. `roles` entries are full guild_roles rows (see attachRoleObjects), not bare ids.
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
  const parsed = (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
  return attachRoleObjects(parsed, { app });
}

/**
 * List guild_members rows with no resolved identity link yet (admin manual-link workflow).
 * Linking/merging these is a future capability; this is read-only.
 * @param {{ app?: string, guildId?: string, search?: string }} [filters] `search` matches handle or nickname (substring, case-insensitive).
 * @returns {Promise<Array<{ id: number, app: string, guildId: string, platformUserId: string, handle: string|null, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string }>>} `roles` entries are full guild_roles rows.
 */
export async function listUnlinkedGuildMembers({ app, guildId, search } = {}) {
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
  if (search) {
    conditions.push("(gm.handle LIKE ? OR gm.nickname LIKE ?)");
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }
  const [rows] = await db.query(
    `SELECT gm.id AS id, gm.app AS app, gm.guild_id AS guildId, gm.platform_user_id AS platformUserId,
            gm.handle AS handle, gm.nickname, gm.roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM guild_members gm
     WHERE ${conditions.join(" AND ")}
     ORDER BY gm.synced_at DESC`,
    params,
  );
  const parsed = (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
  return attachRoleObjects(parsed);
}

/**
 * List every guild_members row (every guild, linked or not) for the admin manual-link picker —
 * unlike listUnlinkedGuildMembers, this includes already-linked rows (with their current
 * mapping id/name) so an admin can see and deliberately move one to a different identity.
 * @param {{ app?: string, guildId?: string, search?: string }} [filters] `search` matches handle or nickname (substring, case-insensitive).
 * @returns {Promise<Array<{ id: number, app: string, guildId: string, platformUserId: string, handle: string|null, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string, linkedMappingId: number|null, linkedMappingName: string|null }>>} `roles` entries are full guild_roles rows.
 */
export async function listAllGuildMemberRows({ app, guildId, search } = {}) {
  const conditions = [];
  const params = [];
  if (app) {
    conditions.push("gm.app = ?");
    params.push(app);
  }
  if (guildId) {
    conditions.push("gm.guild_id = ?");
    params.push(guildId);
  }
  if (search) {
    conditions.push("(gm.handle LIKE ? OR gm.nickname LIKE ?)");
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await db.query(
    `SELECT gm.id AS id, gm.app AS app, gm.guild_id AS guildId, gm.platform_user_id AS platformUserId,
            gm.handle AS handle, gm.nickname AS nickname, gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt,
            ma.chat_member_mapping_id AS linkedMappingId, cmm.name AS linkedMappingName
     FROM guild_members gm
     LEFT JOIN member_aliases ma ON ma.guild_member_id = gm.id
     LEFT JOIN chat_member_mapping cmm ON cmm.id = ma.chat_member_mapping_id
     ${where}
     ORDER BY gm.synced_at DESC`,
    params,
  );
  const parsed = (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
  return attachRoleObjects(parsed);
}

/**
 * List guild_members rows currently linked (via member_aliases) to a chat_member_mapping identity.
 * @param {number} chatMemberMappingId
 * @returns {Promise<Array<{ id: number, app: string, guildId: string, guildName: string|null, platformUserId: string, handle: string|null, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string }>>} `roles` entries are full guild_roles rows.
 */
export async function listAliasesForMapping(chatMemberMappingId) {
  const [rows] = await db.query(
    `SELECT gm.id AS id, gm.app AS app, gm.guild_id AS guildId, gi.name AS guildName,
            gm.platform_user_id AS platformUserId, gm.handle AS handle, gm.nickname AS nickname,
            gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM member_aliases ma
     JOIN guild_members gm ON gm.id = ma.guild_member_id
     LEFT JOIN guild_info gi ON gi.app = gm.app AND gi.guild_id = gm.guild_id
     WHERE ma.chat_member_mapping_id = ?
     ORDER BY gm.synced_at DESC`,
    [chatMemberMappingId],
  );
  const parsed = (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
  return attachRoleObjects(parsed);
}

/**
 * @param {number} guildMemberId
 * @returns {Promise<boolean>}
 */
export async function guildMemberExists(guildMemberId) {
  const [rows] = await db.query("SELECT id FROM guild_members WHERE id = ?", [guildMemberId]);
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Link (or re-link, since guild_member_id is unique in member_aliases) a guild_member row to a
 * chat_member_mapping identity as one of its aliases.
 * @param {number} guildMemberId
 * @param {number} chatMemberMappingId
 * @returns {Promise<void>}
 */
export async function linkGuildMemberAlias(guildMemberId, chatMemberMappingId) {
  if (isSqlite) {
    await db.query(
      `INSERT INTO member_aliases (chat_member_mapping_id, guild_member_id) VALUES (?, ?)
       ON CONFLICT(guild_member_id) DO UPDATE SET chat_member_mapping_id = excluded.chat_member_mapping_id`,
      [chatMemberMappingId, guildMemberId],
    );
  } else {
    await db.query(
      `INSERT INTO member_aliases (chat_member_mapping_id, guild_member_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE chat_member_mapping_id = VALUES(chat_member_mapping_id)`,
      [chatMemberMappingId, guildMemberId],
    );
  }
}

/**
 * Unlink a guild_member from whichever identity it's currently aliased to.
 * @param {number} guildMemberId
 * @returns {Promise<boolean>} true if a link existed and was removed.
 */
export async function unlinkGuildMemberAlias(guildMemberId) {
  const [result] = await db.query(
    "DELETE FROM member_aliases WHERE guild_member_id = ?",
    [guildMemberId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Reverse lookup: every server this internal user id belongs to.
 * @param {number} chatMemberMappingId
 * @returns {Promise<Array<{ app: string, guildId: string, guildName: string|null, nickname: string|null, roles: object[], joinedAt: string|null }>>} `roles` entries are full guild_roles rows.
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
  const parsed = (rows ?? []).map((row) => ({ ...row, roles: row.roles ? JSON.parse(row.roles) : [] }));
  return attachRoleObjects(parsed);
}
