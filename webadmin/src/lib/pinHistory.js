import { apiFetch } from "./http.js";

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
 * Delete a pin history entry.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deletePinHistoryEntry(id) {
  await apiFetch(`/pin-history/${id}`, { method: "DELETE" }, "Delete pin");
}
