/**
 * Pin history read/write access for admin audit and bot pin logging.
 */

import db from "../config/db.js";
import {
  getChatMemberMappingIdByPlatformUserId,
  isChatMemberAppSupported,
} from "./chatMemberMapping.js";
import { normalizeAttachmentPathsForStorage, parseAttachmentPaths } from "./pinFiles.js";

/**
 * Parse pinners JSON array stored in pin_history.pinners.
 * @param {string|null|undefined} stored
 * @returns {number[]}
 */
export function parsePinners(stored) {
  if (stored == null || String(stored).trim() === "") return [];
  try {
    const parsed = JSON.parse(String(stored));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
}

/**
 * Serialize chat_member_mapping IDs for pin_history.pinners.
 * @param {number[]} mappingIds
 * @returns {string|null}
 */
export function serializePinnersForStorage(mappingIds) {
  if (!Array.isArray(mappingIds) || mappingIds.length === 0) return null;
  return JSON.stringify(mappingIds);
}

/**
 * Resolve platform user IDs to chat_member_mapping IDs for pinners.
 * Unknown users are skipped.
 * @param {unknown} pinnerIds
 * @param {string} app
 * @returns {Promise<number[]>}
 */
export async function resolvePinnerMappingIds(pinnerIds, app) {
  if (!Array.isArray(pinnerIds)) return [];
  const mappingIds = [];
  for (const platformUserId of pinnerIds) {
    const mid = await getChatMemberMappingIdByPlatformUserId(platformUserId, app);
    if (mid != null) mappingIds.push(mid);
  }
  return mappingIds;
}

/**
 * Normalize pin metadata fields from an API payload for database storage.
 * @param {Record<string, unknown>} payload
 * @param {string} app
 * @returns {Promise<{ ok: true, row: { author: number|null, contents: string|null, attachments: string|null, channelId: string|null, channelName: string|null, pinners: string|null } } | { ok: false, error: string }>}
 */
export async function normalizePinLogPayload(payload, app) {
  let attachments = null;
  try {
    attachments = normalizeAttachmentPathsForStorage(payload.attachments);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid attachments",
    };
  }

  const contentsRaw = payload.contents;
  const contents =
    contentsRaw == null || String(contentsRaw).trim() === ""
      ? null
      : String(contentsRaw).slice(0, 5000);

  const channelIdRaw = payload.channelId;
  const channelId =
    channelIdRaw == null || String(channelIdRaw).trim() === ""
      ? null
      : String(channelIdRaw).slice(0, 32);

  const channelNameRaw = payload.channelName;
  const channelName =
    channelNameRaw == null || String(channelNameRaw).trim() === ""
      ? null
      : String(channelNameRaw).slice(0, 100);

  let author = null;
  if (payload.authorId != null && String(payload.authorId).trim() !== "") {
    author = await getChatMemberMappingIdByPlatformUserId(payload.authorId, app);
  }

  const pinnerMappingIds = await resolvePinnerMappingIds(payload.pinnerIds, app);

  return {
    ok: true,
    row: {
      author,
      contents,
      attachments,
      channelId,
      channelName,
      pinners: serializePinnersForStorage(pinnerMappingIds),
    },
  };
}

/**
 * Map a pin_history database row to an API entry object.
 * @param {Record<string, unknown>} row
 * @returns {{ id: number, msgid: string, timestamp: string, author: number|null, contents: string|null, attachments: string[], channelId: string|null, channelName: string|null, pinners: number[], hydrated: boolean }}
 */
function mapPinHistoryRow(row) {
  return {
    id: Number(row.id),
    msgid: String(row.msgid),
    timestamp: row.timestamp,
    author: row.author == null ? null : Number(row.author),
    contents: row.contents == null ? null : String(row.contents),
    attachments: parseAttachmentPaths(row.attachments),
    channelId: row.channel_id == null ? null : String(row.channel_id),
    channelName: row.channel_name == null ? null : String(row.channel_name),
    pinners: parsePinners(row.pinners),
    hydrated: Boolean(Number(row.hydrated)),
  };
}

/**
 * List pin history entries with pagination.
 * @param {{ limit?: number, offset?: number }} opts
 * @returns {Promise<{ entries: Array<{ id: number, msgid: string, timestamp: string, author: number|null, contents: string|null, attachments: string[], channelId: string|null, channelName: string|null, pinners: number[] }>, total: number }>}
 */
export async function listPinHistory(opts = {}) {
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const offset = Math.max(0, opts.offset ?? 0);

  const [countRows] = await db.query("SELECT COUNT(*) AS total FROM pin_history");
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT id, msgid, timestamp, author, contents, attachments, channel_id, channel_name, pinners, hydrated
     FROM pin_history
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  const entries = (Array.isArray(rows) ? rows : []).map(mapPinHistoryRow);

  return { entries, total };
}

/** SQL fragment: pin_history rows awaiting bot hydration. */
const INCOMPLETE_PIN_HISTORY_WHERE = "hydrated = 0";

/**
 * List pin_history rows not yet hydrated (`hydrated = false`).
 * @param {{ limit?: number, offset?: number }} opts
 * @returns {Promise<{ entries: Array<{ id: number, msgid: string, timestamp: string, author: number|null, contents: string|null, attachments: string[], channelId: string|null, channelName: string|null, pinners: number[] }>, total: number }>}
 */
export async function listIncompletePinHistory(opts = {}) {
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const offset = Math.max(0, opts.offset ?? 0);

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM pin_history WHERE ${INCOMPLETE_PIN_HISTORY_WHERE}`,
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT id, msgid, timestamp, author, contents, attachments, channel_id, channel_name, pinners, hydrated
     FROM pin_history
     WHERE ${INCOMPLETE_PIN_HISTORY_WHERE}
     ORDER BY id ASC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  const entries = (Array.isArray(rows) ? rows : []).map(mapPinHistoryRow);
  return { entries, total };
}

/**
 * Fetch one pin history entry by primary key (pin_history.id).
 * @param {number} id
 * @returns {Promise<{ id: number, msgid: string, timestamp: string, author: number|null, contents: string|null, attachments: string[], channelId: string|null, channelName: string|null, pinners: number[] } | null>}
 */
export async function getPinHistoryById(id) {
  if (!Number.isFinite(id) || id <= 0) return null;

  const [rows] = await db.query(
    `SELECT id, msgid, timestamp, author, contents, attachments, channel_id, channel_name, pinners, hydrated
     FROM pin_history
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  if (!rows || rows.length === 0) return null;
  return mapPinHistoryRow(rows[0]);
}

/**
 * Update one pin_history row (partial updates supported).
 * @param {number} id - pin_history.id
 * @param {Record<string, unknown>} updates
 * @returns {Promise<{ ok: true, pin: object } | { ok: false, error: string, notFound?: boolean }>}
 */
export async function updatePinHistory(id, updates) {
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "Invalid id" };
  }

  const existing = await getPinHistoryById(id);
  if (!existing) {
    return { ok: false, error: "Pin not found", notFound: true };
  }

  const setParts = [];
  const values = [];
  const app =
    typeof updates.app === "string" && isChatMemberAppSupported(updates.app)
      ? updates.app
      : null;

  if (updates.contents !== undefined) {
    const contents =
      updates.contents == null
        ? null
        : String(updates.contents).slice(0, 5000);
    setParts.push("contents = ?");
    values.push(contents);
  }

  if (updates.attachments !== undefined) {
    if (Array.isArray(updates.attachments) && updates.attachments.length === 0) {
      setParts.push("attachments = ?");
      values.push("");
    } else {
      try {
        const attachments = normalizeAttachmentPathsForStorage(updates.attachments);
        setParts.push("attachments = ?");
        values.push(attachments);
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Invalid attachments",
        };
      }
    }
  }

  if (updates.channelId !== undefined) {
    const channelId =
      updates.channelId == null || String(updates.channelId).trim() === ""
        ? null
        : String(updates.channelId).slice(0, 32);
    setParts.push("channel_id = ?");
    values.push(channelId);
  }

  if (updates.channelName !== undefined) {
    const channelName =
      updates.channelName == null || String(updates.channelName).trim() === ""
        ? null
        : String(updates.channelName).slice(0, 100);
    setParts.push("channel_name = ?");
    values.push(channelName);
  }

  if (updates.author !== undefined) {
    if (updates.author == null) {
      setParts.push("author = ?");
      values.push(null);
    } else {
      const author = Number(updates.author);
      if (!Number.isFinite(author) || author <= 0) {
        return { ok: false, error: "Invalid author" };
      }
      setParts.push("author = ?");
      values.push(author);
    }
  } else if (updates.authorId !== undefined) {
    if (!app) {
      return {
        ok: false,
        error: 'Parameter "app" is required when updating authorId.',
      };
    }
    let author = null;
    if (updates.authorId != null && String(updates.authorId).trim() !== "") {
      author = await getChatMemberMappingIdByPlatformUserId(
        updates.authorId,
        app,
      );
    }
    setParts.push("author = ?");
    values.push(author);
  }

  if (updates.pinners !== undefined) {
    if (updates.pinners == null) {
      setParts.push("pinners = ?");
      values.push(null);
    } else if (!Array.isArray(updates.pinners)) {
      return { ok: false, error: "pinners must be an array of mapping ids" };
    } else if (updates.pinners.length === 0) {
      setParts.push("pinners = ?");
      values.push("[]");
    } else {
      const mappingIds = updates.pinners
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      setParts.push("pinners = ?");
      values.push(serializePinnersForStorage(mappingIds));
    }
  } else if (updates.pinnerIds !== undefined) {
    if (!app) {
      return {
        ok: false,
        error: 'Parameter "app" is required when updating pinnerIds.',
      };
    }
    const mappingIds = await resolvePinnerMappingIds(updates.pinnerIds, app);
    setParts.push("pinners = ?");
    values.push(serializePinnersForStorage(mappingIds) ?? "[]");
  }

  if (updates.hydrated !== undefined) {
    setParts.push("hydrated = ?");
    values.push(updates.hydrated ? 1 : 0);
  }

  if (setParts.length === 0) {
    return { ok: false, error: "No updatable fields provided" };
  }

  values.push(id);
  await db.query(
    `UPDATE pin_history SET ${setParts.join(", ")} WHERE id = ?`,
    values,
  );

  const pin = await getPinHistoryById(id);
  return { ok: true, pin };
}
