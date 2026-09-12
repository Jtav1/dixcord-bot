import { apiFetch } from "./http.js";

/**
 * Fetch the most recently synced guild snapshot (channels/roles for config pickers).
 * Throws if nothing has been synced yet (POST /api/guild/sync from discord-bot) — callers
 * should treat this as a soft failure and fall back to plain text inputs.
 * @returns {Promise<{ guild: object, channels: Array<{id:string,name:string}>, roles: Array<{id:string,name:string}>, syncedAt: string }>}
 */
export async function fetchGuildSnapshot() {
  return apiFetch("/guild", undefined, "Guild snapshot");
}
