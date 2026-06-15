/**
 * CRUD for chat_member_mapping rows (Discord user identity mapping).
 */

import db from "../config/db.js";
import {
  getChatMemberAppConfig,
  isChatMemberAppSupported,
} from "./chatMemberMapping.js";

/**
 * Serialize a mapping row for API responses.
 * @param {Record<string, unknown>} row
 * @param {string} app
 * @returns {{ id: number, name: string, handle: string, platformUserId: string, app: string }}
 */
export function serializeUserMappingRow(row, app) {
  const cfg = getChatMemberAppConfig(app);
  if (!cfg) throw new Error(`Unsupported app: ${app}`);
  return {
    id: Number(row.id),
    name: String(row.name),
    handle: String(row[cfg.handleColumn]),
    platformUserId: String(row[cfg.idColumn]),
    app,
  };
}

/**
 * List user mappings with pagination.
 * @param {string} app
 * @param {{ limit?: number, offset?: number, search?: string }} opts
 * @returns {Promise<{ rows: Array<ReturnType<typeof serializeUserMappingRow>>, total: number }>}
 */
export async function listUserMappings(app, opts = {}) {
  if (!isChatMemberAppSupported(app)) return { rows: [], total: 0 };
  const cfg = getChatMemberAppConfig(app);
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const search = opts.search?.trim();

  let countSql = "SELECT COUNT(*) AS total FROM chat_member_mapping";
  let listSql = "SELECT * FROM chat_member_mapping";
  const params = [];

  if (search) {
    const where =
      " WHERE name LIKE ? OR `" +
      cfg.handleColumn +
      "` LIKE ? OR `" +
      cfg.idColumn +
      "` LIKE ?";
    const pattern = `%${search}%`;
    countSql += where;
    listSql += where;
    params.push(pattern, pattern, pattern);
  }

  listSql += " ORDER BY id ASC LIMIT ? OFFSET ?";

  const [countRows] = await db.query(countSql, params);
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(listSql, [...params, limit, offset]);
  const list = Array.isArray(rows)
    ? rows.map((r) => serializeUserMappingRow(r, app))
    : [];

  return { rows: list, total };
}

/**
 * @param {string} app
 * @param {number} id
 * @returns {Promise<ReturnType<typeof serializeUserMappingRow>|null>}
 */
export async function getUserMappingById(app, id) {
  const [rows] = await db.query(
    "SELECT * FROM chat_member_mapping WHERE id = ?",
    [id],
  );
  if (!rows || rows.length === 0) return null;
  return serializeUserMappingRow(rows[0], app);
}

/**
 * @param {string} app
 * @param {{ name: string, handle: string, platformUserId: string }} payload
 * @returns {Promise<number|null>}
 */
export async function createUserMapping(app, payload) {
  if (!isChatMemberAppSupported(app)) return null;
  const cfg = getChatMemberAppConfig(app);
  const [result] = await db.query(
    `INSERT INTO chat_member_mapping (name, \`${cfg.handleColumn}\`, \`${cfg.idColumn}\`) VALUES (?, ?, ?)`,
    [
      payload.name.trim(),
      payload.handle.trim(),
      payload.platformUserId.trim(),
    ],
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {number} id
 * @param {string} app
 * @param {{ name?: string, handle?: string, platformUserId?: string }} updates
 * @returns {Promise<boolean>}
 */
export async function updateUserMapping(id, app, updates) {
  if (!isChatMemberAppSupported(app)) return false;
  const cfg = getChatMemberAppConfig(app);
  const setParts = [];
  const values = [];

  if (updates.name !== undefined) {
    setParts.push("name = ?");
    values.push(String(updates.name).trim());
  }
  if (updates.handle !== undefined) {
    setParts.push(`\`${cfg.handleColumn}\` = ?`);
    values.push(String(updates.handle).trim());
  }
  if (updates.platformUserId !== undefined) {
    setParts.push(`\`${cfg.idColumn}\` = ?`);
    values.push(String(updates.platformUserId).trim());
  }

  if (setParts.length === 0) return false;
  values.push(id);
  const [result] = await db.query(
    `UPDATE chat_member_mapping SET ${setParts.join(", ")} WHERE id = ?`,
    values,
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
