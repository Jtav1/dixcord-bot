import { apiFetch } from "./http.js";

/**
 * Fetch the most recently synced guild snapshot (channels/roles for config pickers).
 * Throws if nothing has been synced yet; callers should fall back to plain text inputs.
 * @returns {Promise<{ guild: object, channels: Array<{id:string,name:string}>, roles: Array<{id:string,name:string}>, syncedAt: string }>}
 */
export async function fetchGuildSnapshot() {
  return apiFetch("/guild", undefined, "Guild snapshot");
}
