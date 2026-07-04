import * as api from "./client.js";

/**
 * List pin_history rows that still need metadata hydration.
 * GET /api/pin-history/incomplete
 * @param {{ limit?: number, offset?: number }} opts
 * @returns {Promise<{ entries: object[], total: number }>}
 */
export async function listIncompletePinHistory(opts = {}) {
  const { data } = await api.get("/api/pin-history/incomplete", {
    params: {
      limit: opts.limit ?? 200,
      offset: opts.offset ?? 0,
    },
  });
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to list incomplete pin history");
  }
  return {
    entries: Array.isArray(data.pinHistory) ? data.pinHistory : [],
    total: Number(data.total) ?? 0,
  };
}

/**
 * Update one pin_history row.
 * PUT /api/pin-history/:id
 * @param {number} id - pin_history.id
 * @param {object} body
 * @returns {Promise<object>}
 */
export async function updatePinHistoryRow(id, body) {
  const { data } = await api.put(`/api/pin-history/${id}`, body);
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to update pin history row");
  }
  return data.pin;
}
