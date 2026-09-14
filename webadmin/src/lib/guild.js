import { apiFetch } from "./http.js";

/**
 * Fetch the most recently synced guild snapshot (channels/roles/emojis for config pickers).
 * `emojis` is scoped to this app and excludes stickers (type='emoji' or NULL only).
 * Throws if nothing has been synced yet; callers should fall back to plain text inputs.
 * @returns {Promise<{ guild: object, channels: Array<{id:string,name:string}>, roles: Array<{id:string,name:string}>, emojis: Array<{emoid:string,app:string,emoji:string,frequency:number,animated:number,type:string}>, syncedAt: string }>}
 */
export async function fetchGuildSnapshot() {
  return apiFetch("/guild", undefined, "Guild snapshot");
}
