/**
 * Trigger-response pairs: trigger strings map to response strings.
 * CRUD, get response by trigger (random or round-robin ordered).
 * Uses config/db.js (mysql or sqlite) and trigger_response_state for round-robin.
 */

import db from "../config/db.js";

const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";
const orderByResponseOrderClause = isSqlite
  ? "ORDER BY response_order IS NULL, response_order ASC"
  : "ORDER BY ISNULL(response_order), response_order ASC";

/**
 * @returns {Promise<Array<{ id: number, trigger_string: string, response_string: string, response_order: number|null, selection_mode: string, created_at: string }>>}
 */
export async function getAll() {
  const nullsOrder = isSqlite ? "response_order IS NULL" : "ISNULL(response_order)";
  const [rows] = await db.query(
    `SELECT id, trigger_string, response_string, response_order, selection_mode, created_at FROM trigger_responses ORDER BY trigger_string, ${nullsOrder}, response_order, id`,
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} id
 * @returns {Promise<{ id: number, trigger_string: string, response_string: string, response_order: number|null, selection_mode: string, created_at: string }|null>}
 */
export async function getById(id) {
  const [rows] = await db.query(
    "SELECT id, trigger_string, response_string, response_order, selection_mode, created_at FROM trigger_responses WHERE id = ?",
    [id],
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Unique trigger strings (for bot to match against message content).
 * @returns {Promise<string[]>}
 */
export async function getTriggerList() {
  const [rows] = await db.query(
    "SELECT DISTINCT trigger_string FROM trigger_responses ORDER BY trigger_string",
  );
  return Array.isArray(rows) ? rows.map((r) => r.trigger_string) : [];
}

/**
 * Get last_used_response_id for a trigger from trigger_response_state.
 * @param {string} trigger
 * @returns {Promise<number|null>}
 */
async function getLastUsedResponseId(trigger) {
  const [rows] = await db.query(
    "SELECT last_used_response_id FROM trigger_response_state WHERE trigger_string = ?",
    [trigger],
  );
  if (!rows || rows.length === 0) return null;
  const id = rows[0].last_used_response_id;
  return id == null ? null : Number(id);
}

/**
 * Set last_used_response_id for a trigger (INSERT or UPDATE).
 * @param {string} trigger
 * @param {number|null} responseId
 */
async function setLastUsedResponseId(trigger, responseId) {
  if (isSqlite) {
    await db.query(
      "INSERT INTO trigger_response_state (trigger_string, last_used_response_id) VALUES (?, ?) ON CONFLICT(trigger_string) DO UPDATE SET last_used_response_id = excluded.last_used_response_id",
      [trigger, responseId],
    );
  } else {
    await db.query(
      "INSERT INTO trigger_response_state (trigger_string, last_used_response_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_used_response_id = VALUES(last_used_response_id)",
      [trigger, responseId],
    );
  }
}

/**
 * One response for the given trigger: random, or next in round-robin order.
 * @param {string} trigger
 * @returns {Promise<{ id: number, response_string: string }|null>}
 */
export async function getRandomResponse(trigger) {
  if (!trigger || typeof trigger !== "string" || !trigger.trim()) return null;
  const t = trigger.trim();

  const [modeRows] = await db.query(
    "SELECT selection_mode FROM trigger_responses WHERE trigger_string = ? LIMIT 1",
    [t],
  );
  if (!modeRows || modeRows.length === 0) return null;

  const selection_mode = (modeRows[0].selection_mode || "random").toLowerCase();

  if (selection_mode === "ordered") {
    const [orderedRows] = await db.query(
      `SELECT id, response_string FROM trigger_responses WHERE trigger_string = ? ${orderByResponseOrderClause}`,
      [t],
    );
    if (!orderedRows || orderedRows.length === 0) return null;

    const lastId = await getLastUsedResponseId(t);
    let nextIndex = 0;
    if (lastId != null) {
      const idx = orderedRows.findIndex((r) => Number(r.id) === Number(lastId));
      nextIndex = idx < 0 ? 0 : (idx + 1) % orderedRows.length;
    }
    const chosen = orderedRows[nextIndex];
    await setLastUsedResponseId(t, chosen.id);
    return { id: chosen.id, response_string: chosen.response_string };
  }

  const orderBy = isSqlite ? "RANDOM()" : "RAND()";
  const [rows] = await db.query(
    `SELECT id, response_string FROM trigger_responses WHERE trigger_string = ? ORDER BY ${orderBy} LIMIT 1`,
    [t],
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

const VALID_MODES = ["random", "ordered"];

/**
 * @param {string} trigger_string
 * @param {string} response_string
 * @param {number|null} [response_order]
 * @param {string} [selection_mode]
 * @returns {Promise<number|null>} Insert id
 */
export async function create(
  trigger_string,
  response_string,
  response_order = null,
  selection_mode = "random",
) {
  const mode =
    selection_mode && VALID_MODES.includes(selection_mode.toLowerCase())
      ? selection_mode.toLowerCase()
      : "random";
  const [result] = await db.query(
    "INSERT INTO trigger_responses (trigger_string, response_string, response_order, selection_mode) VALUES (?, ?, ?, ?)",
    [
      trigger_string.trim(),
      response_string.trim(),
      response_order ?? null,
      mode,
    ],
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {number} id
 * @param {{ trigger_string?: string, response_string?: string, response_order?: number|null, selection_mode?: string }} updates
 * @returns {Promise<boolean>}
 */
export async function update(
  id,
  { trigger_string, response_string, response_order, selection_mode },
) {
  const updates = [];
  const values = [];
  if (trigger_string !== undefined) {
    updates.push("trigger_string = ?");
    values.push(
      typeof trigger_string === "string"
        ? trigger_string.trim()
        : trigger_string,
    );
  }
  if (response_string !== undefined) {
    updates.push("response_string = ?");
    values.push(
      typeof response_string === "string"
        ? response_string.trim()
        : response_string,
    );
  }
  if (response_order !== undefined) {
    updates.push("response_order = ?");
    values.push(
      response_order === null || response_order === ""
        ? null
        : Number(response_order),
    );
  }
  if (selection_mode !== undefined) {
    const mode =
      selection_mode && VALID_MODES.includes(selection_mode.toLowerCase())
        ? selection_mode.toLowerCase()
        : "random";
    updates.push("selection_mode = ?");
    values.push(mode);
  }
  if (updates.length === 0) return false;
  values.push(id);
  const [result] = await db.query(
    `UPDATE trigger_responses SET ${updates.join(", ")} WHERE id = ?`,
    values,
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function remove(id) {
  const [result] = await db.query(
    "DELETE FROM trigger_responses WHERE id = ?",
    [id],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
