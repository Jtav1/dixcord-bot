import { apiFetch, apiFetchJson } from "./http.js";

/**
 * Fetch all configuration entries for one server, enriched with type/description/restart metadata.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<Array<{ config: string, value: string, description: string|null, type: string, requiresBotRestart: boolean, deprecated: boolean }>>}
 */
export async function fetchConfigEntries(app, guildId) {
  const params = new URLSearchParams({ app, guildId });
  const data = await apiFetch(`/config?${params}`, undefined, "Config");
  return data.entriesWithMeta;
}

/**
 * Update an existing configuration value for one server.
 * @param {string} app
 * @param {string} guildId
 * @param {string} config Configuration key name.
 * @param {string} value New value.
 * @returns {Promise<void>}
 */
export async function updateConfigValue(app, guildId, config, value) {
  await apiFetchJson("PUT", "/config", { app, guildId, config, value }, "Config update");
}
