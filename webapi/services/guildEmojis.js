/**
 * guild_emojis CRUD by internal_id, (app, id), or (app, guild_id, name) — distinct from
 * emojiFrequency.js, which is resolution-only (never mutates, never exposes these lookups).
 */

import db from "../config/db.js";
import { parseLimit } from "./leaderboards.js";

/**
 * Map a raw guild_emojis row to the camelCase API shape.
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {Record<string, unknown>|null}
 */
function toApiShape(row) {
  if (!row) return null;
  return {
    internalId: Number(row.internal_id),
    id: String(row.id),
    app: row.app,
    guildId: row.guild_id,
    type: row.type,
    name: row.name,
    animated: Boolean(row.animated),
    available: row.available == null ? null : Boolean(row.available),
    managed: row.managed == null ? null : Boolean(row.managed),
    requiresColons: row.requires_colons == null ? null : Boolean(row.requires_colons),
    roles: row.roles ? JSON.parse(row.roles) : [],
    imagePath: row.image_path ?? null,
    frequency: Number(row.frequency),
    syncedAt: row.synced_at,
  };
}

/**
 * @param {number} internalId
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function getByInternalId(internalId) {
  const [rows] = await db.query("SELECT * FROM guild_emojis WHERE internal_id = ?", [internalId]);
  return toApiShape(rows?.[0]);
}

/**
 * @param {string} app
 * @param {string} id
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function getByAppId(app, id) {
  const [rows] = await db.query("SELECT * FROM guild_emojis WHERE app = ? AND id = ?", [app, id]);
  return toApiShape(rows?.[0]);
}

/**
 * @param {string} app
 * @param {string} guildId
 * @param {string} name
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function getByAppGuildName(app, guildId, name) {
  const [rows] = await db.query(
    "SELECT * FROM guild_emojis WHERE app = ? AND guild_id = ? AND name = ?",
    [app, guildId, name],
  );
  return toApiShape(rows?.[0]);
}

/**
 * Paginated list of every catalog row owned by one guild.
 * @param {string} app
 * @param {string} guildId
 * @param {{ type?: "emoji"|"sticker", limit?: number, offset?: number }} [opts]
 * @returns {Promise<{ rows: Record<string, unknown>[], total: number }>}
 */
export async function listByGuild(app, guildId, { type, limit, offset = 0 } = {}) {
  const n = parseLimit(limit, 50, 50);
  const off = Math.max(0, parseInt(offset, 10) || 0);

  const conditions = ["app = ?", "guild_id = ?"];
  const params = [app, guildId];
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  const where = conditions.join(" AND ");

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM guild_emojis WHERE ${where}`,
    params,
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT * FROM guild_emojis WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, n, off],
  );

  return { rows: (Array.isArray(rows) ? rows : []).map(toApiShape), total };
}

/**
 * Cross-guild, filtered, paginated browse of the whole catalog — for the webadmin catalog
 * browser (unlike listByGuild, no guildId is required or even accepted).
 * @param {{ app?: string, type?: "emoji"|"sticker", animated?: boolean, name?: string, limit?: number, offset?: number }} [opts]
 * @returns {Promise<{ rows: Record<string, unknown>[], total: number }>}
 */
export async function searchGuildEmojis({ app, type, animated, name, limit, offset = 0 } = {}) {
  const n = parseLimit(limit, 24, 100);
  const off = Math.max(0, parseInt(offset, 10) || 0);

  const conditions = [];
  const params = [];
  if (app) {
    conditions.push("app = ?");
    params.push(app);
  }
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  if (animated != null) {
    conditions.push("animated = ?");
    params.push(animated ? 1 : 0);
  }
  if (name) {
    conditions.push("name LIKE ?");
    params.push(`%${name}%`);
  }
  const where = conditions.length > 0 ? conditions.join(" AND ") : "1=1";

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM guild_emojis WHERE ${where}`,
    params,
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT * FROM guild_emojis WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, n, off],
  );

  return { rows: (Array.isArray(rows) ? rows : []).map(toApiShape), total };
}

/**
 * Update only the mutable fields (`name`, `imagePath`) of one row. `id`/`app`/`guildId`/
 * `frequency` stay sync/usage-owned and are never touched here.
 * @param {string} whereClause - SQL condition, e.g. "internal_id = ?"
 * @param {Array} whereParams
 * @param {{ name?: string, imagePath?: string|null }} fields
 * @returns {Promise<boolean>} true if a row was updated
 */
export async function updateRow(whereClause, whereParams, fields) {
  const sets = [];
  const params = [];
  if (fields.name !== undefined) {
    sets.push("name = ?");
    params.push(fields.name);
  }
  if (fields.imagePath !== undefined) {
    sets.push("image_path = ?");
    params.push(fields.imagePath);
  }
  if (sets.length === 0) return false;

  const [result] = await db.query(
    `UPDATE guild_emojis SET ${sets.join(", ")} WHERE ${whereClause}`,
    [...params, ...whereParams],
  );
  return (result?.affectedRows ?? 0) > 0;
}

/**
 * Hard-delete one row regardless of frequency (admin/CRUD override — distinct from the
 * sync-driven prune in messageProcessing.js, which is frequency-gated).
 * @param {string} whereClause - SQL condition, e.g. "internal_id = ?"
 * @param {Array} whereParams
 * @returns {Promise<string|null|undefined>} the deleted row's image_path, or undefined if nothing matched
 */
export async function deleteRow(whereClause, whereParams) {
  const [rows] = await db.query(`SELECT image_path FROM guild_emojis WHERE ${whereClause}`, whereParams);
  if (!rows || rows.length === 0) return undefined;
  const imagePath = rows[0].image_path;
  await db.query(`DELETE FROM guild_emojis WHERE ${whereClause}`, whereParams);
  return imagePath ?? null;
}
