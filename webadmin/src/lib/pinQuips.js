import { apiFetch, apiFetchJson } from "./http.js";

/**
 * List all pin quips.
 * @returns {Promise<Array<{ id: number, quip: string }>>}
 */
export async function fetchPinQuips() {
  const data = await apiFetch("/pin-quips", undefined, "Pin quips");
  return data.pinQuips;
}

/**
 * @param {string} quip
 * @returns {Promise<{ id: number, quip: string }>}
 */
export async function createPinQuip(quip) {
  return apiFetchJson("POST", "/pin-quips", { quip }, "Create pin quip");
}

/**
 * @param {number} id
 * @param {string} quip
 * @returns {Promise<{ id: number, quip: string }>}
 */
export async function updatePinQuip(id, quip) {
  return apiFetchJson("PUT", `/pin-quips/${id}`, { quip }, "Update pin quip");
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deletePinQuip(id) {
  await apiFetch(`/pin-quips/${id}`, { method: "DELETE" }, "Delete pin quip");
}
