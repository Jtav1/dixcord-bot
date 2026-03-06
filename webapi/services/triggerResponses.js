/**
 * Trigger-response: triggers and responses in separate tables, linked by trigger_response (many-to-many).
 * CRUD by junction id; get response by trigger (random or round-robin).
 * Uses config/db.js (mysql or sqlite) and trigger_response_state for round-robin.
 */

import db from "../config/db.js";

const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";
const orderByResponseOrderClause = isSqlite
  ? "ORDER BY tr.response_order IS NULL, tr.response_order ASC, tr.response_id ASC"
  : "ORDER BY ISNULL(tr.response_order), tr.response_order ASC, tr.response_id ASC";

const WEIGHT_MIN = 0;
const WEIGHT_MAX = 100;
function clampWeight(value) {
  if (value == null || value === "") return WEIGHT_MIN;
  const n = Number(value);
  if (!Number.isFinite(n)) return WEIGHT_MIN;
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, Math.floor(n)));
}

/**
 * @returns {Promise<Array<{ id: number, trigger_string: string, response_string: string, response_order: number|null, weight: number, selection_mode: string, created_at: string, trigger_id: number, response_id: number }>>}
 */
export async function getAll() {
  const nullsOrder = isSqlite ? "tr.response_order IS NULL" : "ISNULL(tr.response_order)";
  const [rows] = await db.query(
    `SELECT tr.id, t.trigger_string, r.response_string, tr.response_order, tr.weight, t.selection_mode, t.created_at, t.id AS trigger_id, r.id AS response_id
     FROM trigger_response tr
     JOIN triggers t ON t.id = tr.trigger_id
     JOIN responses r ON r.id = tr.response_id
     ORDER BY t.trigger_string, ${nullsOrder}, tr.response_order, tr.id`,
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} id - Junction (trigger_response) row id
 * @returns {Promise<{ id: number, trigger_string: string, response_string: string, response_order: number|null, weight: number, selection_mode: string, created_at: string, trigger_id: number, response_id: number }|null>}
 */
export async function getById(id) {
  const [rows] = await db.query(
    `SELECT tr.id, t.trigger_string, r.response_string, tr.response_order, tr.weight, t.selection_mode, t.created_at, t.id AS trigger_id, r.id AS response_id
     FROM trigger_response tr
     JOIN triggers t ON t.id = tr.trigger_id
     JOIN responses r ON r.id = tr.response_id
     WHERE tr.id = ?`,
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
    "SELECT trigger_string FROM triggers ORDER BY trigger_string",
  );
  return Array.isArray(rows) ? rows.map((r) => r.trigger_string) : [];
}

/**
 * All triggers with id and selection_mode (for CRUD clients).
 * @returns {Promise<Array<{ id: number, trigger_string: string, selection_mode: string }>>}
 */
export async function getTriggers() {
  const [rows] = await db.query(
    "SELECT id, trigger_string, selection_mode FROM triggers ORDER BY trigger_string",
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Get last_used_response_id (responses.id) for a trigger from trigger_response_state.
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
 * Set last_used_response_id (responses.id) for a trigger (INSERT or UPDATE).
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
 * Increment frequency for the selected trigger, response, and trigger_response row.
 * @param {number} triggerId
 * @param {number} responseId
 * @param {number} triggerResponseId - junction (trigger_response) row id
 */
async function incrementSelectionFrequencies(triggerId, responseId, triggerResponseId) {
  await db.query("UPDATE triggers SET frequency = frequency + 1 WHERE id = ?", [triggerId]);
  await db.query("UPDATE responses SET frequency = frequency + 1 WHERE id = ?", [responseId]);
  await db.query("UPDATE trigger_response SET frequency = frequency + 1 WHERE id = ?", [triggerResponseId]);
}

/**
 * One response for the given trigger: random, or next in round-robin order.
 * @param {string} trigger
 * @returns {Promise<{ id: number, response_string: string }|null>} id is responses.id
 */
export async function getRandomResponse(trigger) {
  if (!trigger || typeof trigger !== "string" || !trigger.trim()) return null;
  const t = trigger.trim();

  const [triggerRows] = await db.query(
    "SELECT id, selection_mode FROM triggers WHERE trigger_string = ? LIMIT 1",
    [t],
  );
  if (!triggerRows || triggerRows.length === 0) return null;
  const triggerId = triggerRows[0].id;
  const selection_mode = (triggerRows[0].selection_mode || "random").toLowerCase();

  const [orderedRows] = await db.query(
    `SELECT r.id, r.response_string, tr.id AS trigger_response_id
     FROM trigger_response tr
     JOIN responses r ON r.id = tr.response_id
     WHERE tr.trigger_id = ?
     ${orderByResponseOrderClause}`,
    [triggerId],
  );
  if (!orderedRows || orderedRows.length === 0) return null;

  if (selection_mode === "ordered") {
    const lastId = await getLastUsedResponseId(t);
    let nextIndex = 0;
    if (lastId != null) {
      const idx = orderedRows.findIndex((r) => Number(r.id) === Number(lastId));
      nextIndex = idx < 0 ? 0 : (idx + 1) % orderedRows.length;
    }
    const chosen = orderedRows[nextIndex];
    await setLastUsedResponseId(t, chosen.id);
    await incrementSelectionFrequencies(triggerId, chosen.id, chosen.trigger_response_id);
    return { id: chosen.id, response_string: chosen.response_string };
  }

  const [weightRows] = await db.query(
    `SELECT r.id, r.response_string, COALESCE(tr.weight, 0) AS weight, tr.id AS trigger_response_id
     FROM trigger_response tr
     JOIN responses r ON r.id = tr.response_id
     WHERE tr.trigger_id = ?`,
    [triggerId],
  );
  if (!weightRows || weightRows.length === 0) return null;
  let totalWeight = 0;
  for (const row of weightRows) {
    const w = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, Number(row.weight) || WEIGHT_MIN));
    totalWeight += w;
  }
  let chosen = null;
  if (totalWeight <= 0) {
    chosen = weightRows[0];
  } else {
    let r = Math.random() * totalWeight;
    for (const row of weightRows) {
      const w = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, Number(row.weight) || WEIGHT_MIN));
      r -= w;
      if (r < 0) {
        chosen = row;
        break;
      }
    }
    if (!chosen) chosen = weightRows[weightRows.length - 1];
  }
  if (!chosen) return null;
  await incrementSelectionFrequencies(triggerId, chosen.id, chosen.trigger_response_id);
  return { id: chosen.id, response_string: chosen.response_string };
}

const VALID_MODES = ["random", "ordered", "weighted"];

/** Get or create trigger by trigger_string; return trigger id. */
async function getOrCreateTriggerId(trigger_string, selection_mode) {
  const mode =
    selection_mode && VALID_MODES.includes(selection_mode.toLowerCase())
      ? selection_mode.toLowerCase()
      : "random";
  const [rows] = await db.query(
    "SELECT id, selection_mode FROM triggers WHERE trigger_string = ? LIMIT 1",
    [trigger_string],
  );
  if (rows && rows.length > 0) {
    const existing = rows[0];
    if (mode !== (existing.selection_mode || "random")) {
      await db.query("UPDATE triggers SET selection_mode = ? WHERE id = ?", [mode, existing.id]);
    }
    return existing.id;
  }
  const [result] = await db.query(
    "INSERT INTO triggers (trigger_string, selection_mode) VALUES (?, ?)",
    [trigger_string, mode],
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/** Get or create response by response_string; return response id. Dedupes by string. */
async function getOrCreateResponseId(response_string) {
  const [rows] = await db.query(
    "SELECT id FROM responses WHERE response_string = ? LIMIT 1",
    [response_string],
  );
  if (rows && rows.length > 0) return rows[0].id;
  const [result] = await db.query(
    "INSERT INTO responses (response_string) VALUES (?)",
    [response_string],
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {string} trigger_string
 * @param {string} response_string
 * @param {number|null} [response_order]
 * @param {string} [selection_mode]
 * @param {number} [weight]
 * @returns {Promise<number|null>} Junction (trigger_response) insert id
 */
export async function create(
  trigger_string,
  response_string,
  response_order = null,
  selection_mode = "random",
  weight,
) {
  const triggerId = await getOrCreateTriggerId(trigger_string.trim(), selection_mode);
  const responseId = await getOrCreateResponseId(response_string.trim());
  if (triggerId == null || responseId == null) return null;
  const w = weight == null || weight === "" ? null : clampWeight(weight);
  const [result] = await db.query(
    "INSERT INTO trigger_response (trigger_id, response_id, response_order, weight) VALUES (?, ?, ?, ?)",
    [triggerId, responseId, response_order ?? null, w],
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {number} id - Junction (trigger_response) id
 * @param {{ trigger_string?: string, response_string?: string, response_order?: number|null, selection_mode?: string, weight?: number }} updates
 * @returns {Promise<boolean>}
 */
export async function update(
  id,
  { trigger_string, response_string, response_order, selection_mode, weight },
) {
  const [juncRows] = await db.query(
    "SELECT trigger_id, response_id FROM trigger_response WHERE id = ?",
    [id],
  );
  if (!juncRows || juncRows.length === 0) return false;
  const junction = juncRows[0];
  let triggerId = junction.trigger_id;
  let responseId = junction.response_id;

  if (trigger_string !== undefined && typeof trigger_string === "string" && trigger_string.trim()) {
    const newTriggerId = await getOrCreateTriggerId(trigger_string.trim(), selection_mode ?? "random");
    if (newTriggerId != null) triggerId = newTriggerId;
  }
  if (response_string !== undefined && typeof response_string === "string" && response_string.trim()) {
    const newResponseId = await getOrCreateResponseId(response_string.trim());
    if (newResponseId != null) responseId = newResponseId;
  }
  if (selection_mode !== undefined) {
    const mode =
      selection_mode && VALID_MODES.includes(selection_mode.toLowerCase())
        ? selection_mode.toLowerCase()
        : "random";
    await db.query("UPDATE triggers SET selection_mode = ? WHERE id = ?", [mode, triggerId]);
  }

  const updates = [];
  const values = [];
  updates.push("trigger_id = ?");
  values.push(triggerId);
  updates.push("response_id = ?");
  values.push(responseId);
  if (response_order !== undefined) {
    updates.push("response_order = ?");
    values.push(
      response_order === null || response_order === ""
        ? null
        : Number(response_order),
    );
  }
  if (weight !== undefined) {
    updates.push("weight = ?");
    values.push(weight === null ? null : clampWeight(weight));
  }
  values.push(id);
  const [result] = await db.query(
    `UPDATE trigger_response SET ${updates.join(", ")} WHERE id = ?`,
    values,
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * @param {number} id - Junction (trigger_response) id
 * @returns {Promise<boolean>}
 */
export async function remove(id) {
  const [result] = await db.query(
    "DELETE FROM trigger_response WHERE id = ?",
    [id],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

// --- Trigger-centric (trigger id + responses array) ---

/**
 * Get all responses for a trigger by trigger id or trigger string.
 * @param {number|string} triggerIdOrString - Trigger id (number) or trigger_string
 * @returns {Promise<{ trigger_id: number, trigger_string: string, selection_mode: string, responses: Array<{ id: number, response_string: string, order: number|null, weight: number, linkId: number }> }|null>}
 */
export async function getResponsesForTrigger(triggerIdOrString) {
  let triggerId = null;
  if (typeof triggerIdOrString === "number" && Number.isInteger(triggerIdOrString)) {
    triggerId = triggerIdOrString;
  } else if (typeof triggerIdOrString === "string" && triggerIdOrString.trim()) {
    const [rows] = await db.query(
      "SELECT id FROM triggers WHERE trigger_string = ? LIMIT 1",
      [triggerIdOrString.trim()],
    );
    if (rows && rows.length > 0) triggerId = rows[0].id;
  }
  if (triggerId == null) return null;
  const trigger = await getTriggerById(triggerId);
  if (!trigger) return null;
  return {
    trigger_id: trigger.id,
    trigger_string: trigger.trigger_string,
    selection_mode: trigger.selection_mode,
    responses: trigger.responses,
  };
}

/**
 * Get trigger by id with its responses (ordered by response_order, then response_id).
 * @param {number} triggerId
 * @returns {Promise<{ id: number, trigger_string: string, selection_mode: string, created_at: string, responses: Array<{ id: number, response_string: string, order: number|null, weight: number, linkId: number }> }|null>}
 */
export async function getTriggerById(triggerId) {
  const [tRows] = await db.query(
    "SELECT id, trigger_string, selection_mode, created_at FROM triggers WHERE id = ?",
    [triggerId],
  );
  if (!tRows || tRows.length === 0) return null;
  const trigger = tRows[0];
  const [linkRows] = await db.query(
    `SELECT tr.id AS linkId, tr.response_order AS response_order_val, tr.weight, r.id, r.response_string
     FROM trigger_response tr
     JOIN responses r ON r.id = tr.response_id
     WHERE tr.trigger_id = ?
     ${orderByResponseOrderClause}`,
    [triggerId],
  );
  const responses = (linkRows || []).map((r) => ({
    id: r.id,
    response_string: r.response_string,
    order: r.response_order_val ?? null,
    weight: r.weight != null ? Number(r.weight) : null,
    linkId: r.linkId,
  }));
  return {
    id: trigger.id,
    trigger_string: trigger.trigger_string,
    selection_mode: trigger.selection_mode || "random",
    created_at: trigger.created_at,
    responses,
  };
}

/**
 * Create a trigger (if not exists) with selection_mode and an array of responses.
 * Each response can have response_string and optional order (used when trigger is ordered) and weight.
 * @param {{ trigger_string: string, selection_mode?: string, responses: Array<{ response_string: string, order?: number|null, weight?: number }> }} params
 * @returns {Promise<{ id: number, trigger_string: string, selection_mode: string, created_at: string, responses: Array<{ id: number, response_string: string, order: number|null, weight: number, linkId: number }> }|null>}
 */
export async function createTriggerWithResponses({
  trigger_string,
  selection_mode = "random",
  responses,
}) {
  if (!trigger_string || typeof trigger_string !== "string" || !trigger_string.trim()) return null;
  if (!Array.isArray(responses) || responses.length === 0) return null;
  const mode =
    selection_mode && VALID_MODES.includes(selection_mode.toLowerCase())
      ? selection_mode.toLowerCase()
      : "random";
  const triggerId = await getOrCreateTriggerId(trigger_string.trim(), mode);
  if (triggerId == null) return null;
  const created = [];
  for (const item of responses) {
    const str = item?.response_string;
    if (str == null || typeof str !== "string" || !str.trim()) continue;
    const responseId = await getOrCreateResponseId(str.trim());
    if (responseId == null) continue;
    const order =
      item.order !== undefined && item.order !== null && item.order !== ""
        ? Number(item.order)
        : null;
    const w = item.weight == null || item.weight === "" ? null : clampWeight(item.weight);
    const [ins] = await db.query(
      "INSERT INTO trigger_response (trigger_id, response_id, response_order, weight) VALUES (?, ?, ?, ?)",
      [triggerId, responseId, order, w],
    );
    const linkId = ins?.insertId ?? ins?.lastInsertRowid;
    if (linkId != null) {
      created.push({
        id: responseId,
        response_string: str.trim(),
        order,
        weight: w,
        linkId,
      });
    }
  }
  const trigger = await getTriggerById(triggerId);
  return trigger;
}

/**
 * Update a trigger: selection_mode and/or response list (set order/weight for existing links, add new responses).
 * responses: [ { id: linkId, order?, weight? } ] to set order/weight, or [ { response_string, order?, weight? } ] to add new.
 * @param {number} triggerId
 * @param {{ selection_mode?: string, responses?: Array<{ id?: number, response_string?: string, order?: number|null, weight?: number }> }} updates
 * @returns {Promise<boolean>}
 */
export async function updateTrigger(triggerId, { selection_mode, responses }) {
  const [tRows] = await db.query("SELECT id FROM triggers WHERE id = ?", [triggerId]);
  if (!tRows || tRows.length === 0) return false;
  if (selection_mode !== undefined) {
    const mode =
      selection_mode && VALID_MODES.includes(selection_mode.toLowerCase())
        ? selection_mode.toLowerCase()
        : "random";
    await db.query("UPDATE triggers SET selection_mode = ? WHERE id = ?", [mode, triggerId]);
  }
  if (Array.isArray(responses)) {
    for (const item of responses) {
      if (item.id != null && Number.isInteger(Number(item.id))) {
        const linkId = Number(item.id);
        const order =
          item.order !== undefined && item.order !== null && item.order !== ""
            ? Number(item.order)
            : null;
        const weight = item.weight !== undefined ? (item.weight === null ? null : clampWeight(item.weight)) : undefined;
        if (weight !== undefined) {
          await db.query(
            "UPDATE trigger_response SET response_order = ?, weight = ? WHERE id = ? AND trigger_id = ?",
            [order, weight, linkId, triggerId],
          );
        } else {
          await db.query(
            "UPDATE trigger_response SET response_order = ? WHERE id = ? AND trigger_id = ?",
            [order, linkId, triggerId],
          );
        }
      } else if (item.response_string != null && typeof item.response_string === "string" && item.response_string.trim()) {
        const responseId = await getOrCreateResponseId(item.response_string.trim());
        if (responseId == null) continue;
        const order =
          item.order !== undefined && item.order !== null && item.order !== ""
            ? Number(item.order)
            : null;
        const w = item.weight == null || item.weight === "" ? null : clampWeight(item.weight);
        await db.query(
          "INSERT INTO trigger_response (trigger_id, response_id, response_order, weight) VALUES (?, ?, ?, ?)",
          [triggerId, responseId, order, w],
        );
      }
    }
  }
  return true;
}

/**
 * Get response by id (responses table).
 * @param {number} responseId
 * @returns {Promise<{ id: number, response_string: string, created_at: string }|null>}
 */
export async function getResponseById(responseId) {
  const [rows] = await db.query(
    "SELECT id, response_string, created_at FROM responses WHERE id = ?",
    [responseId],
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Update a response's text (responses table).
 * @param {number} responseId
 * @param {{ response_string?: string }} updates
 * @returns {Promise<boolean>} false if response_string invalid or response not found
 */
export async function updateResponse(responseId, { response_string }) {
  if (response_string == null || typeof response_string !== "string" || !response_string.trim())
    return false;
  const [result] = await db.query(
    "UPDATE responses SET response_string = ? WHERE id = ?",
    [response_string.trim(), responseId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Delete a response (responses table). Cascade removes trigger_response links.
 * @param {number} responseId
 * @returns {Promise<boolean>}
 */
export async function deleteResponse(responseId) {
  const [result] = await db.query("DELETE FROM responses WHERE id = ?", [responseId]);
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
