import { apiFetch } from "./http.js";

/**
 * Fetch a guild snapshot (channels/roles/emojis for config pickers). Omitting app/guildId falls
 * back to whichever guild synced most recently — pass both explicitly once a guild is known
 * (e.g. from the tab switcher) to avoid that ambiguity.
 * `emojis` is scoped to this app and excludes stickers (type='emoji' or NULL only).
 * Throws if nothing has been synced yet; callers should fall back to plain text inputs.
 * @param {string} [app]
 * @param {string} [guildId]
 * @returns {Promise<{ guild: object, channels: Array<{id:string,name:string}>, roles: Array<{id:string,name:string}>, emojis: Array<{emoid:string,app:string,emoji:string,frequency:number,animated:number,type:string}>, syncedAt: string }>}
 */
export async function fetchGuildSnapshot(app, guildId) {
  const params = new URLSearchParams();
  if (app) params.set("app", app);
  if (guildId) params.set("guildId", guildId);
  const query = params.toString();
  return apiFetch(`/guild${query ? `?${query}` : ""}`, undefined, "Guild snapshot");
}

/**
 * List every guild that has ever synced, for the guild-tab switcher.
 * @returns {Promise<Array<{app:string,guildId:string,name:string,iconUrl:string|null,syncedAt:string}>>}
 */
export async function fetchAllGuilds() {
  const data = await apiFetch("/guild/all", undefined, "Guild list");
  return data.guilds;
}
