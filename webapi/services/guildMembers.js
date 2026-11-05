/**
 * Per-(app, guild_id, platform_user_id) server membership: Discord handle/nickname/roles/
 * joined-at. The link to chat_member_mapping lives in member_aliases, not here.
 */

import crypto from "node:crypto";
import db from "../config/db.js";
import { createBareChatMemberMappingId, getChatMemberAppConfig } from "./chatMemberMapping.js";
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
 * `inserted` (a subset of `imported`) lets callers (e.g. a periodic sync) log only when the
 * roster actually grew, rather than on every tick.
 * @param {string} app
 * @param {string} guildId
 * @param {Array<{ platformUserId: string, handle?: string|null, nickname?: string|null, roles?: string[], joinedAt?: string|null }>} members
 * @returns {Promise<{ ok: true, imported: number, inserted: number, skipped: number } | { ok: false, error: string }>}
 */
export async function upsertGuildMembers(app, guildId, members) {
  if (!getChatMemberAppConfig(app)) {
    return { ok: false, error: "Unsupported app" };
  }
  if (!Array.isArray(members)) {
    return { ok: false, error: "members must be an array" };
  }

  const [existingRows] = await db.query(
    "SELECT platform_user_id AS platformUserId FROM guild_members WHERE app = ? AND guild_id = ?",
    [app, guildId],
  );
  const existingIds = new Set((existingRows ?? []).map((row) => String(row.platformUserId)));

  let imported = 0;
  let inserted = 0;
  let skipped = 0;
  for (const member of members) {
    const result = await upsertOneGuildMember(app, guildId, member);
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    imported += 1;

    const platformUserId = String(member.platformUserId).trim();
    if (!existingIds.has(platformUserId)) {
      inserted += 1;
      existingIds.add(platformUserId); // a duplicate id later in the same batch is an update, not another insert
    }
  }

  return { ok: true, imported, inserted, skipped };
}

/**
 * The member's bot-created color role (!color-me), if any.
 * @param {string} app
 * @param {string} guildId
 * @param {string} platformUserId
 * @returns {Promise<{ name: string, hex: string }|null>}
 */
export async function getColorRole(app, guildId, platformUserId) {
  const [rows] = await db.query(
    "SELECT color_role_name, color_hex FROM guild_members WHERE app = ? AND guild_id = ? AND platform_user_id = ?",
    [app, guildId, platformUserId],
  );
  const row = rows?.[0];
  if (!row?.color_role_name) return null;
  return { name: row.color_role_name, hex: row.color_hex };
}

/**
 * Record the member's color role. Creates a minimal row if the member isn't synced yet; only
 * the color columns are written on conflict, so roster sync data is never touched.
 * @param {string} app
 * @param {string} guildId
 * @param {string} platformUserId
 * @param {{ name: string, hex: string }} colorRole
 * @returns {Promise<void>}
 */
export async function setColorRole(app, guildId, platformUserId, { name, hex }) {
  if (isSqlite) {
    await db.query(
      `INSERT INTO guild_members (app, guild_id, platform_user_id, color_role_name, color_hex)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(app, guild_id, platform_user_id) DO UPDATE SET
         color_role_name = excluded.color_role_name,
         color_hex = excluded.color_hex`,
      [app, guildId, platformUserId, name, hex],
    );
  } else {
    await db.query(
      `INSERT INTO guild_members (app, guild_id, platform_user_id, color_role_name, color_hex)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         color_role_name = VALUES(color_role_name),
         color_hex = VALUES(color_hex)`,
      [app, guildId, platformUserId, name, hex],
    );
  }
}

/**
 * Clear the member's color role record.
 * @param {string} app
 * @param {string} guildId
 * @param {string} platformUserId
 * @returns {Promise<void>}
 */
export async function clearColorRole(app, guildId, platformUserId) {
  await db.query(
    "UPDATE guild_members SET color_role_name = NULL, color_hex = NULL WHERE app = ? AND guild_id = ? AND platform_user_id = ?",
    [app, guildId, platformUserId],
  );
}

/**
 * Register one bot client's own platform account as a guild_members row for (app, guildId),
 * aliased to its own chat_member_mapping identity (not shared across apps — each app's bot
 * account gets its own identity). Normal roster sync (upsertGuildMembers) excludes bot accounts
 * entirely — this is the only path that creates a guild_members row for one. Called by each
 * client at its own startup, idempotent: the guild_member row is stable across reboots
 * (upsertOneGuildMember upserts on (app, guild_id, platform_user_id)), so once that row already
 * has an alias from a previous boot, this reuses it rather than creating a new identity.
 * @param {{ app: string, guildId: string, platformUserId: string, handle?: string|null }} params
 * @returns {Promise<{ ok: true, chatMemberMappingId: number } | { ok: false, error: string }>}
 */
export async function registerBotSelf({ app, guildId, platformUserId, handle }) {
  if (!getChatMemberAppConfig(app)) return { ok: false, error: "Unsupported app" };
  const gid = String(guildId ?? "").trim();
  const pid = String(platformUserId ?? "").trim();
  if (!gid || !pid) {
    return { ok: false, error: "guildId and platformUserId are required" };
  }

  await upsertOneGuildMember(app, gid, { platformUserId: pid, handle: handle ?? null });
  const [rows] = await db.query(
    "SELECT id FROM guild_members WHERE app = ? AND guild_id = ? AND platform_user_id = ?",
    [app, gid, pid],
  );
  const guildMemberId = Number(rows?.[0]?.id);

  const [aliasRows] = await db.query(
    "SELECT chat_member_mapping_id AS id FROM member_aliases WHERE guild_member_id = ?",
    [guildMemberId],
  );
  const chatMemberMappingId =
    aliasRows?.[0]?.id != null ? Number(aliasRows[0].id) : await createBareChatMemberMappingId();
  await linkGuildMemberAlias(guildMemberId, chatMemberMappingId);

  return { ok: true, chatMemberMappingId };
}

/**
 * List one server's members, left-joined through member_aliases for linked-identity id.
 * Unlinked members (no member_aliases row yet) appear with id null.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<Array<{ id: number|null, handle: string|null, platformUserId: string, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string }> | null>} null if app unsupported. `roles` entries are full guild_roles rows (see attachRoleObjects), not bare ids.
 */
export async function listGuildMembers(app, guildId) {
  const appConfig = getChatMemberAppConfig(app);
  if (!appConfig) return null;

  const [rows] = await db.query(
    `SELECT ma.chat_member_mapping_id AS id,
            gm.handle AS handle, gm.platform_user_id AS platformUserId,
            gm.nickname AS nickname, gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM guild_members gm
     LEFT JOIN member_aliases ma ON ma.guild_member_id = gm.id
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
 * @returns {Promise<Array<{ id: number|null, handle: string|null, platformUserId: string, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string }> | null>} null if app unsupported. `roles` entries are full guild_roles rows (see attachRoleObjects), not bare ids.
 */
export async function listAllGuildMembers(app) {
  const appConfig = getChatMemberAppConfig(app);
  if (!appConfig) return null;

  const [rows] = await db.query(
    `SELECT ma.chat_member_mapping_id AS id,
            gm.handle AS handle, gm.platform_user_id AS platformUserId,
            gm.nickname AS nickname, gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt
     FROM guild_members gm
     LEFT JOIN member_aliases ma ON ma.guild_member_id = gm.id
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
 * mapping id) so an admin can see and deliberately move one to a different identity.
 * @param {{ app?: string, guildId?: string, search?: string }} [filters] `search` matches handle or nickname (substring, case-insensitive).
 * @returns {Promise<Array<{ id: number, app: string, guildId: string, platformUserId: string, handle: string|null, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string, linkedMappingId: number|null }>>} `roles` entries are full guild_roles rows.
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
            ma.chat_member_mapping_id AS linkedMappingId
     FROM guild_members gm
     LEFT JOIN member_aliases ma ON ma.guild_member_id = gm.id
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
 * @returns {Promise<Array<{ id: number, app: string, guildId: string, guildName: string|null, platformUserId: string, handle: string|null, nickname: string|null, roles: object[], joinedAt: string|null, syncedAt: string, defaultAlias: boolean }>>} `roles` entries are full guild_roles rows.
 */
export async function listAliasesForMapping(chatMemberMappingId) {
  const [rows] = await db.query(
    `SELECT gm.id AS id, gm.app AS app, gm.guild_id AS guildId, gi.name AS guildName,
            gm.platform_user_id AS platformUserId, gm.handle AS handle, gm.nickname AS nickname,
            gm.roles AS roles, gm.joined_at AS joinedAt, gm.synced_at AS syncedAt,
            ma.default_alias AS defaultAlias
     FROM member_aliases ma
     JOIN guild_members gm ON gm.id = ma.guild_member_id
     LEFT JOIN guild_info gi ON gi.app = gm.app AND gi.guild_id = gm.guild_id
     WHERE ma.chat_member_mapping_id = ?
     ORDER BY gm.synced_at DESC`,
    [chatMemberMappingId],
  );
  const parsed = (rows ?? []).map((row) => ({
    ...row,
    roles: row.roles ? JSON.parse(row.roles) : [],
    defaultAlias: !!row.defaultAlias,
  }));
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
 * Promote the newest (highest id) alias of a mapping to default_alias, if it has aliases but no
 * current default. No-op if the mapping already has a default (or has no aliases at all).
 * @param {number} chatMemberMappingId
 * @returns {Promise<void>}
 */
async function promoteNewestAliasToDefault(chatMemberMappingId) {
  const [existing] = await db.query(
    "SELECT id FROM member_aliases WHERE chat_member_mapping_id = ? AND default_alias = 1",
    [chatMemberMappingId],
  );
  if (existing?.length) return;
  const [rows] = await db.query(
    "SELECT id FROM member_aliases WHERE chat_member_mapping_id = ? ORDER BY id DESC LIMIT 1",
    [chatMemberMappingId],
  );
  if (rows?.[0]) {
    await db.query("UPDATE member_aliases SET default_alias = 1 WHERE id = ?", [rows[0].id]);
  }
}

/**
 * Link (or re-link, since guild_member_id is unique in member_aliases) a guild_member row to a
 * chat_member_mapping identity as one of its aliases — always becoming that mapping's new
 * default_alias. If this was a re-link away from a different mapping, that mapping's default is
 * repaired (promoted from its next-newest remaining alias) if it just lost its default.
 * @param {number} guildMemberId
 * @param {number} chatMemberMappingId
 * @returns {Promise<void>}
 */
export async function linkGuildMemberAlias(guildMemberId, chatMemberMappingId) {
  const [existingRows] = await db.query(
    "SELECT chat_member_mapping_id AS mappingId FROM member_aliases WHERE guild_member_id = ?",
    [guildMemberId],
  );
  const previousMappingId = existingRows?.[0]?.mappingId ?? null;

  if (isSqlite) {
    await db.query(
      `INSERT INTO member_aliases (chat_member_mapping_id, guild_member_id, default_alias) VALUES (?, ?, 1)
       ON CONFLICT(guild_member_id) DO UPDATE SET chat_member_mapping_id = excluded.chat_member_mapping_id, default_alias = 1`,
      [chatMemberMappingId, guildMemberId],
    );
  } else {
    await db.query(
      `INSERT INTO member_aliases (chat_member_mapping_id, guild_member_id, default_alias) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE chat_member_mapping_id = VALUES(chat_member_mapping_id), default_alias = 1`,
      [chatMemberMappingId, guildMemberId],
    );
  }
  await db.query(
    "UPDATE member_aliases SET default_alias = 0 WHERE chat_member_mapping_id = ? AND guild_member_id <> ?",
    [chatMemberMappingId, guildMemberId],
  );
  if (previousMappingId != null && previousMappingId !== chatMemberMappingId) {
    await promoteNewestAliasToDefault(previousMappingId);
  }
}

/**
 * Unlink a guild_member from whichever identity it's currently aliased to. If it was that
 * mapping's default alias, the next-newest remaining alias (if any) is promoted to default.
 * @param {number} guildMemberId
 * @returns {Promise<boolean>} true if a link existed and was removed.
 */
export async function unlinkGuildMemberAlias(guildMemberId) {
  const [existingRows] = await db.query(
    "SELECT chat_member_mapping_id AS mappingId FROM member_aliases WHERE guild_member_id = ?",
    [guildMemberId],
  );
  const mappingId = existingRows?.[0]?.mappingId ?? null;
  const [result] = await db.query(
    "DELETE FROM member_aliases WHERE guild_member_id = ?",
    [guildMemberId],
  );
  if (mappingId != null) await promoteNewestAliasToDefault(mappingId);
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Is this guild_member already aliased to some identity?
 * @param {number} guildMemberId
 * @returns {Promise<boolean>}
 */
export async function isGuildMemberLinked(guildMemberId) {
  const [rows] = await db.query(
    "SELECT 1 AS x FROM member_aliases WHERE guild_member_id = ?",
    [guildMemberId],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Designate one of a chat_member_mapping identity's already-linked aliases as its default
 * (admin override of the normal "newest alias wins" rule).
 * @param {number} chatMemberMappingId
 * @param {number} guildMemberId
 * @returns {Promise<{ handle: string|null, app: string, defaultGuildMemberId: number }|null>} null if guildMemberId isn't an alias of this identity.
 */
export async function setPrimaryAlias(chatMemberMappingId, guildMemberId) {
  const [rows] = await db.query(
    `SELECT ma.id AS aliasId, gm.app AS app, gm.handle AS handle, gm.nickname AS nickname
     FROM member_aliases ma
     JOIN guild_members gm ON gm.id = ma.guild_member_id
     WHERE ma.guild_member_id = ? AND ma.chat_member_mapping_id = ?`,
    [guildMemberId, chatMemberMappingId],
  );
  if (!rows || rows.length === 0) return null;

  const alias = rows[0];
  await db.query("UPDATE member_aliases SET default_alias = 0 WHERE chat_member_mapping_id = ?", [chatMemberMappingId]);
  await db.query("UPDATE member_aliases SET default_alias = 1 WHERE id = ?", [alias.aliasId]);
  return { handle: alias.handle || alias.nickname || null, app: alias.app, defaultGuildMemberId: guildMemberId };
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

/**
 * Start a self-service account link: snapshots the requester's existing identity (if any),
 * generates a one-time token, and replaces any earlier pending request from them.
 * @param {{ app: string, guildId: string, requesterUserId: string }} params
 * @returns {Promise<{ ok: true, token: string } | { ok: false, error: string }>}
 */
export async function requestAccountLink({ app, guildId, requesterUserId }) {
  if (!getChatMemberAppConfig(app)) return { ok: false, error: "Unsupported app" };

  const [requesterRows] = await db.query(
    "SELECT id FROM guild_members WHERE app = ? AND guild_id = ? AND platform_user_id = ?",
    [app, guildId, requesterUserId],
  );
  const requester = requesterRows?.[0];
  if (!requester) {
    return { ok: false, error: "Your membership hasn't been synced yet; try again in a few minutes" };
  }

  const [aliasRows] = await db.query(
    "SELECT chat_member_mapping_id AS id FROM member_aliases WHERE guild_member_id = ?",
    [requester.id],
  );
  const chatMemberMappingId = aliasRows?.[0]?.id ?? null;

  const token = crypto.randomBytes(16).toString("hex");

  await db.query("DELETE FROM pending_account_links WHERE app = ? AND app_user_id = ?", [app, requesterUserId]);
  await db.query(
    "INSERT INTO pending_account_links (app, app_user_id, chat_member_mapping_id, auth_token) VALUES (?, ?, ?, ?)",
    [app, requesterUserId, chatMemberMappingId, token],
  );

  return { ok: true, token };
}

/**
 * Accept a self-service account link: alias the confirmer to the requester's identity (creating
 * one if needed), keyed by token. The pending row is always deleted once the token resolves —
 * success or failure — so it's usable for exactly one attempt. An unknown token is a no-op.
 * @param {{ app: string, guildId: string, userId: string, token: string }} params
 * @returns {Promise<{ ok: true, requesterHandle: string|null, chatMemberMappingId: number } | { ok: false, error: string }>}
 */
export async function confirmAccountLink({ app, guildId, userId, token }) {
  if (!getChatMemberAppConfig(app)) return { ok: false, error: "Unsupported app" };

  const authToken = String(token ?? "").trim();
  if (!authToken) return { ok: false, error: "A link token is required" };

  const [pendingRows] = await db.query(
    "SELECT id, app, app_user_id, chat_member_mapping_id FROM pending_account_links WHERE auth_token = ?",
    [authToken],
  );
  const pending = pendingRows?.[0];
  if (!pending) return { ok: false, error: "Invalid or expired link token" };

  try {
    const [confirmerRows] = await db.query(
      "SELECT id FROM guild_members WHERE app = ? AND guild_id = ? AND platform_user_id = ?",
      [app, guildId, userId],
    );
    const confirmer = confirmerRows?.[0];
    if (!confirmer) {
      return { ok: false, error: "Your membership hasn't been synced yet; try again in a few minutes" };
    }

    if (pending.app === app && pending.app_user_id === userId) {
      return { ok: false, error: "You can't link an account to itself" };
    }

    const [existingAlias] = await db.query(
      "SELECT id FROM member_aliases WHERE guild_member_id = ?",
      [confirmer.id],
    );
    if (existingAlias?.length) {
      return { ok: false, error: "Your account is already linked to an identity" };
    }

    const [requesterRows] = await db.query(
      "SELECT id, handle, nickname FROM guild_members WHERE app = ? AND platform_user_id = ? ORDER BY synced_at DESC LIMIT 1",
      [pending.app, pending.app_user_id],
    );
    const requester = requesterRows?.[0];
    if (!requester) {
      return { ok: false, error: "The account that requested this link is no longer available" };
    }

    let chatMemberMappingId = pending.chat_member_mapping_id;
    if (chatMemberMappingId == null) {
      chatMemberMappingId = await createBareChatMemberMappingId();
      await linkGuildMemberAlias(requester.id, chatMemberMappingId);
    }

    await linkGuildMemberAlias(confirmer.id, chatMemberMappingId);

    return { ok: true, requesterHandle: requester.handle ?? null, chatMemberMappingId };
  } finally {
    await db.query("DELETE FROM pending_account_links WHERE id = ?", [pending.id]);
  }
}
