import { apiFetch, apiFetchJson } from "./http.js";

/**
 * Fetch all configuration entries, enriched with type/description/restart metadata.
 * @returns {Promise<Array<{ config: string, value: string, description: string|null, type: string, requiresBotRestart: boolean, deprecated: boolean }>>}
 */
export async function fetchConfigEntries() {
  const data = await apiFetch("/config", undefined, "Config");
  return data.entriesWithMeta;
}

/**
 * Update an existing configuration value.
 * @param {string} config Configuration key name.
 * @param {string} value New value.
 * @returns {Promise<void>}
 */
export async function updateConfigValue(config, value) {
  await apiFetchJson("PUT", "/config", { config, value }, "Config update");
}
