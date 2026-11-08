import { API_BASE } from "./api.js";
import { apiFetch, apiFetchForm, apiFetchJson } from "./http.js";

/**
 * Cross-guild, filtered, paginated browse of the whole emoji/sticker catalog.
 * @param {{ app?: string, type?: "emoji"|"sticker", animated?: boolean, name?: string, limit?: number, offset?: number }} [filters]
 * @returns {Promise<{ items: Array<object>, total: number }>}
 */
export async function searchGuildEmojis({ app, type, animated, name, limit = 24, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (app) params.set("app", app);
  if (type) params.set("type", type);
  if (animated != null) params.set("animated", String(animated));
  if (name) params.set("name", name);
  const data = await apiFetch(`/guild-emojis/search?${params}`, undefined, "Guild emojis");
  return { items: data.guildEmojis, total: data.total };
}

/**
 * @param {number} internalId
 * @returns {Promise<object>}
 */
export async function fetchGuildEmoji(internalId) {
  const data = await apiFetch(`/guild-emojis/${internalId}`, undefined, "Guild emoji");
  return data.guildEmoji;
}

/**
 * @param {number} internalId
 * @param {{ name?: string, imagePath?: string|null }} fields
 * @returns {Promise<void>}
 */
export async function updateGuildEmoji(internalId, fields) {
  await apiFetchJson("PUT", `/guild-emojis/${internalId}`, fields, "Update guild emoji");
}

/**
 * @param {number} internalId
 * @returns {Promise<void>}
 */
export async function deleteGuildEmoji(internalId) {
  await apiFetch(`/guild-emojis/${internalId}`, { method: "DELETE" }, "Delete guild emoji");
}

/**
 * URL for a catalog row's current image (404s if it has none) — used directly as a `<v-img>`
 * src; the webadmin proxy attaches auth server-side, so no manual fetch/blob handling is needed.
 * @param {number} internalId
 * @returns {string}
 */
export function guildEmojiImageUrl(internalId) {
  return `${API_BASE}/guild-emojis/${internalId}/image`;
}

/**
 * Replace (or add) a catalog row's image — webapi rejects it if the mimetype doesn't match what
 * the row's name/type/animated combination expects.
 * @param {number} internalId
 * @param {File} file
 * @returns {Promise<string>} the new imagePath
 */
export async function uploadGuildEmojiImage(internalId, file) {
  const formData = new FormData();
  formData.append("image", file);
  const data = await apiFetchForm("POST", `/guild-emojis/${internalId}/image`, formData, "Upload guild emoji image");
  return data.imagePath;
}
