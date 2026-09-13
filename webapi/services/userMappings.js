/**
 * CRUD for chat_member_mapping rows (bare canonical identity: id + name only).
 * Linking a mapping to its guild_members aliases is a separate, future admin action.
 */

import db from "../config/db.js";

/**
 * Serialize a mapping row for API responses.
 * @param {Record<string, unknown>} row
 * @returns {{ id: number, name: string }}
 */
export function serializeUserMappingRow(row) {
  return {
    id: Number(row.id),
    name: String(row.name),
  };
}

/**
 * List user mappings with pagination.
 * @param {{ limit?: number, offset?: number, search?: string }} opts
 * @returns {Promise<{ rows: Array<ReturnType<typeof serializeUserMappingRow>>, total: number }>}
 */
export async function listUserMappings(opts = {}) {
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const search = opts.search?.trim();

  let countSql = "SELECT COUNT(*) AS total FROM chat_member_mapping";
  let listSql = "SELECT * FROM chat_member_mapping";
  const params = [];

  if (search) {
    const where = " WHERE name LIKE ?";
    const pattern = `%${search}%`;
    countSql += where;
    listSql += where;
    params.push(pattern);
  }

  listSql += " ORDER BY id ASC LIMIT ? OFFSET ?";

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
    "SELECT * FROM chat_member_mapping WHERE id = ?",
    [id],
  );
  if (!rows || rows.length === 0) return null;
  return serializeUserMappingRow(rows[0]);
}

/**
 * @param {{ name: string }} payload
 * @returns {Promise<number|null>}
 */
export async function createUserMapping(payload) {
  const [result] = await db.query(
    "INSERT INTO chat_member_mapping (name) VALUES (?)",
    [payload.name.trim()],
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {number} id
 * @param {{ name?: string }} updates
 * @returns {Promise<boolean>}
 */
export async function updateUserMapping(id, updates) {
  if (updates.name === undefined) return false;
  const [result] = await db.query(
    "UPDATE chat_member_mapping SET name = ? WHERE id = ?",
    [String(updates.name).trim(), id],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
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
