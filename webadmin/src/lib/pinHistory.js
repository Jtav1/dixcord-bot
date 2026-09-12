import { apiFetch, apiFetchJson } from "./http.js";

/**
 * Paginated pin history.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<object>, total: number }>}
 */
export async function fetchPinHistory({ limit = 25, offset = 0 } = {}) {
  const data = await apiFetch(`/pin-history?limit=${limit}&offset=${offset}`, undefined, "Pin history");
  return { items: data.pinHistory, total: data.total };
}

/**
 * Correct a pin history entry's metadata.
 * @param {number} id
 * @param {{ contents?: string, channelId?: string, channelName?: string, hydrated?: boolean }} fields
 * @returns {Promise<object>}
 */
export async function updatePinHistoryEntry(id, fields) {
  const data = await apiFetchJson("PUT", `/pin-history/${id}`, fields, "Update pin");
  return data.pin;
}
