/**
 * CRUD for chat_member_mapping rows (bare canonical identity: just an id). A mapping's display
 * identity (handle/app) is resolved live via its default alias (member_aliases.default_alias ->
 * guild_members), not stored on chat_member_mapping itself.
 */

import db from "../config/db.js";
import { createBareChatMemberMappingId } from "./chatMemberMapping.js";
import { linkGuildMemberAlias } from "./guildMembers.js";

const JOIN_DEFAULT_ALIAS = `
  FROM chat_member_mapping cmm
  LEFT JOIN member_aliases ma ON ma.chat_member_mapping_id = cmm.id AND ma.default_alias = 1
  LEFT JOIN guild_members gm ON gm.id = ma.guild_member_id
`;

/**
 * Serialize a joined mapping row for API responses.
 * @param {Record<string, unknown>} row
 * @returns {{ id: number, handle: string|null, app: string|null, defaultGuildMemberId: number|null }}
 */
export function serializeUserMappingRow(row) {
  return {
    id: Number(row.id),
    handle: row.handle != null ? String(row.handle) : row.nickname != null ? String(row.nickname) : null,
    app: row.app != null ? String(row.app) : null,
    defaultGuildMemberId: row.defaultGuildMemberId != null ? Number(row.defaultGuildMemberId) : null,
  };
}

/**
 * List user mappings with pagination.
 * @param {{ limit?: number, offset?: number, search?: string }} opts `search` matches the default alias's handle (substring, case-insensitive).
 * @returns {Promise<{ rows: Array<ReturnType<typeof serializeUserMappingRow>>, total: number }>}
 */
export async function listUserMappings(opts = {}) {
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const search = opts.search?.trim();

  let countSql = `SELECT COUNT(*) AS total ${JOIN_DEFAULT_ALIAS}`;
  let listSql = `SELECT cmm.id AS id, gm.handle AS handle, gm.nickname AS nickname, gm.app AS app,
                        ma.guild_member_id AS defaultGuildMemberId ${JOIN_DEFAULT_ALIAS}`;
  const params = [];

  if (search) {
    const where = " WHERE gm.handle LIKE ?";
    const pattern = `%${search}%`;
    countSql += where;
    listSql += where;
    params.push(pattern);
  }

  listSql += " ORDER BY cmm.id ASC LIMIT ? OFFSET ?";

  const [countRows] = await db.query(countSql, params);
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(listSql, [...params, limit, offset]);
  const list = Array.isArray(rows) ? rows.map((r) => serializeUserMappingRow(r)) : [];

  return { rows: list, total };
}

/**
 * @param {number} id
 * @returns {Promise<ReturnType<typeof serializeUserMappingRow>|null>}
 */
export async function getUserMappingById(id) {
  const [rows] = await db.query(
    `SELECT cmm.id AS id, gm.handle AS handle, gm.nickname AS nickname, gm.app AS app,
            ma.guild_member_id AS defaultGuildMemberId
     ${JOIN_DEFAULT_ALIAS}
     WHERE cmm.id = ?`,
    [id],
  );
  if (!rows || rows.length === 0) return null;
  return serializeUserMappingRow(rows[0]);
}

/**
 * Create a chat_member_mapping identity and immediately link it to an unlinked guild_member,
 * which becomes its sole (and therefore default) alias.
 * @param {{ guildMemberId: number }} payload
 * @returns {Promise<number>} the new chat_member_mapping.id
 */
export async function createUserMapping({ guildMemberId }) {
  const id = await createBareChatMemberMappingId();
  await linkGuildMemberAlias(guildMemberId, id);
  return id;
}

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function deleteUserMapping(id) {
  const [result] = await db.query(
    "DELETE FROM chat_member_mapping WHERE id = ?",
    [id],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
