/**
 * Milestones: admin-defined usage-stat thresholds, checked every time a tracked counter
 * increments. See milestoneTypes.js for the fixed dictionary of valid `type` values.
 */

import db from "../config/db.js";
import { getChatMemberMappingIdByPlatformUserId } from "./chatMemberMapping.js";
import { getPlusPlusTotalByString, getRepostsForUser } from "./leaderboards.js";
import { isMilestoneTypeSupported } from "./milestoneTypes.js";

/**
 * Check unachieved milestones of (type, item) whose quantity has been reached or passed by
 * `value`, mark ALL of them achieved in one pass, and return only the highest-quantity newly
 * achieved one — one message per increment event. Fails open: any DB error is logged and
 * treated as "nothing fired", since a milestone-check bug must never block the counting
 * operation it's embedded in.
 * @param {{ type: string, item?: string|null, value: number }} params
 * @returns {Promise<{ id: number, quantity: number, message: string, type: string, item: string|null } | null>}
 */
export async function checkAndMarkMilestones({ type, item = null, value }) {
  if (!isMilestoneTypeSupported(type)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  try {
    const itemClause = item == null ? "item IS NULL" : "item = ?";
    const params = item == null ? [type, n] : [type, n, item];
    const [rows] = await db.query(
      `SELECT id, quantity, message FROM milestones
       WHERE type = ? AND achieved = 0 AND quantity <= ? AND ${itemClause}
       ORDER BY quantity DESC`,
      params,
    );
    if (!rows || rows.length === 0) return null;

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(", ");
    await db.query(
      `UPDATE milestones SET achieved = 1 WHERE id IN (${placeholders})`,
      ids,
    );

    const winner = rows[0];
    return {
      id: winner.id,
      quantity: winner.quantity,
      message: winner.message,
      type,
      item,
    };
  } catch (err) {
    console.error("checkAndMarkMilestones error:", err);
    return null;
  }
}

// --- Aggregate "current value" helpers for metric types with no on-hand counter ---

export async function computePinTotal() {
  const [rows] = await db.query("SELECT COUNT(*) AS total FROM pin_history");
  return Number(rows?.[0]?.total ?? 0);
}

/** @param {string} app - e.g. "discord" */
export async function computeEmojiFrequencyPerApp(app) {
  const [rows] = await db.query(
    "SELECT COALESCE(SUM(frequency), 0) AS total FROM emoji_frequency WHERE app = ?",
    [app],
  );
  return Number(rows?.[0]?.total ?? 0);
}

export async function computeEmojiTrackedGlobal() {
  // DISTINCT emoid: emoji_frequency is now per-guild, so the same emoji tracked in two guilds
  // has two rows — this counts distinct emoji ever tracked, not usage-rows.
  const [rows] = await db.query(
    "SELECT COUNT(DISTINCT emoid) AS total FROM emoji_frequency WHERE type = 'emoji' OR type IS NULL",
  );
  return Number(rows?.[0]?.total ?? 0);
}

export async function computeStickerTrackedGlobal() {
  const [rows] = await db.query(
    "SELECT COUNT(DISTINCT emoid) AS total FROM emoji_frequency WHERE type = 'sticker'",
  );
  return Number(rows?.[0]?.total ?? 0);
}

export async function computeEmojiUsedGlobal() {
  const [rows] = await db.query(
    "SELECT COALESCE(SUM(frequency), 0) AS total FROM emoji_frequency WHERE type = 'emoji' OR type IS NULL",
  );
  return Number(rows?.[0]?.total ?? 0);
}

export async function computeStickerUsedGlobal() {
  const [rows] = await db.query(
    "SELECT COALESCE(SUM(frequency), 0) AS total FROM emoji_frequency WHERE type = 'sticker'",
  );
  return Number(rows?.[0]?.total ?? 0);
}

export async function computePlusPlusVotesGlobal() {
  const [rows] = await db.query("SELECT COUNT(*) AS total FROM plusplus_tracking");
  return Number(rows?.[0]?.total ?? 0);
}

/**
 * EXISTS, not JOIN — a voter can have more than one guild_members alias for the same app; a
 * JOIN would multiply plusplus_tracking rows per alias and overcount.
 * @param {string} app
 */
export async function computePlusPlusVotesPerApp(app) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total FROM plusplus_tracking pt
     WHERE EXISTS (
       SELECT 1 FROM chat_member_mapping cm
       JOIN member_aliases ma ON ma.chat_member_mapping_id = cm.id
       JOIN guild_members gm ON gm.id = ma.guild_member_id
       WHERE cm.id = pt.voter AND gm.app = ?
     )`,
    [app],
  );
  return Number(rows?.[0]?.total ?? 0);
}

/** @param {string} target @param {'word'|'user'} typestr @param {string} app */
export async function computePlusPlusItemTotal(target, typestr, app) {
  const row = await getPlusPlusTotalByString(target, typestr, app);
  return row?.total ?? 0;
}

async function computePlusPlusItemSignedCount(target, typestr, app, value) {
  if (typestr === "user") {
    const mid = await getChatMemberMappingIdByPlatformUserId(target, app);
    if (mid == null) return 0;
    const [rows] = await db.query(
      "SELECT COUNT(*) AS total FROM plusplus_tracking WHERE type = 'user' AND CAST(string AS INTEGER) = ? AND CAST(value AS INT) = ?",
      [mid, value],
    );
    return Number(rows?.[0]?.total ?? 0);
  }
  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM plusplus_tracking WHERE string = ? AND type = 'word' AND CAST(value AS INT) = ?",
    [String(target), value],
  );
  return Number(rows?.[0]?.total ?? 0);
}

export const computePlusPlusItemPositive = (target, typestr, app) =>
  computePlusPlusItemSignedCount(target, typestr, app, 1);
export const computePlusPlusItemNegative = (target, typestr, app) =>
  computePlusPlusItemSignedCount(target, typestr, app, -1);

/** @param {string} userId - platform snowflake @param {string} app */
export async function computeRepostUserTotal(userId, app) {
  const row = await getRepostsForUser(userId, app);
  return row?.count ?? 0;
}

export async function computeRepostGlobalTotal() {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM member_repost_tracking",
  );
  return Number(rows?.[0]?.total ?? 0);
}

// --- CRUD (validation lives in the route, matching pin-quips.js's convention) ---

/**
 * @param {{ type?: string, item?: string, object?: string, achieved?: boolean }} [filters]
 * @returns {Promise<Array<object>>}
 */
export async function getAll({ type, item, object, achieved } = {}) {
  const clauses = [];
  const params = [];
  if (type != null) {
    clauses.push("type = ?");
    params.push(type);
  }
  if (item != null) {
    clauses.push("item = ?");
    params.push(item);
  }
  if (object != null) {
    clauses.push("object = ?");
    params.push(object);
  }
  if (achieved != null) {
    clauses.push("achieved = ?");
    params.push(achieved ? 1 : 0);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows] = await db.query(
    `SELECT * FROM milestones ${where} ORDER BY type, item, quantity`,
    params,
  );
  return (rows ?? []).map(toMilestoneRow);
}

/** @param {number} id */
export async function getById(id) {
  const [rows] = await db.query("SELECT * FROM milestones WHERE id = ?", [id]);
  if (!rows || rows.length === 0) return null;
  return toMilestoneRow(rows[0]);
}

/**
 * @param {{ type: string, item: string|null, quantity: number, excludeId?: number }} params
 * @returns {Promise<boolean>}
 */
export async function findDuplicate({ type, item, quantity, excludeId }) {
  const itemClause = item == null ? "item IS NULL" : "item = ?";
  let sql = `SELECT 1 FROM milestones WHERE type = ? AND ${itemClause} AND quantity = ?`;
  const params = item == null ? [type, quantity] : [type, item, quantity];
  if (excludeId != null) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await db.query(sql, params);
  return Boolean(rows && rows.length > 0);
}

/**
 * @param {{ quantity: number, type: string, item: string|null, message: string, object: string }} params
 */
export async function create({ quantity, type, item, message, object }) {
  const [result] = await db.query(
    "INSERT INTO milestones (quantity, type, item, message, object, achieved) VALUES (?, ?, ?, ?, ?, 0)",
    [quantity, type, item ?? null, message, object],
  );
  const id = result?.insertId ?? result?.lastInsertRowid;
  return getById(Number(id));
}

/**
 * @param {number} id
 * @param {{ quantity?: number, type?: string, item?: string|null, message?: string, object?: string, achieved?: boolean }} fields
 */
export async function update(id, fields) {
  const columns = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    columns.push(`${key} = ?`);
    params.push(key === "achieved" ? (value ? 1 : 0) : value);
  }
  if (columns.length === 0) return getById(id);
  params.push(id);
  await db.query(`UPDATE milestones SET ${columns.join(", ")} WHERE id = ?`, params);
  return getById(id);
}

/** @param {number} id */
export async function remove(id) {
  const [result] = await db.query("DELETE FROM milestones WHERE id = ?", [id]);
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

function toMilestoneRow(row) {
  return { ...row, achieved: Boolean(row.achieved) };
}
