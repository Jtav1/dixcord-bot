/**
 * In-memory config store with reload support for hot config application.
 */

import { getAllConfigurations } from "./api/configurations.js";

/** @type {Record<string, string>} */
let configMap = {};

/**
 * Load all configuration from webapi into memory.
 * @returns {Promise<Record<string, string>>}
 */
export async function loadConfig() {
  const entries = await getAllConfigurations();
  configMap = Object.fromEntries(
    entries.map((row) => [row.config, row.value ?? ""]),
  );
  return configMap;
}

/**
 * Get a config value by key.
 * @param {string} key
 * @param {string|null} [defaultValue=null]
 * @returns {string|null}
 */
export function getConfigValue(key, defaultValue = null) {
  if (Object.prototype.hasOwnProperty.call(configMap, key)) {
    return configMap[key];
  }
  return defaultValue;
}

/**
 * @returns {number}
 */
export function getPinThreshold() {
  return parseInt(getConfigValue("pin_threshold", "0"), 10) || 0;
}

/**
 * @returns {string|null}
 */
export function getPinEmoji() {
  return getConfigValue("pin_emoji");
}

/**
 * @returns {string|null}
 */
export function getRepostEmojiId() {
  return getConfigValue("repost_emoji");
}

/**
 * @returns {string|null}
 */
export function getAnnounceChannelId() {
  return getConfigValue("announce_channel_id", "");
}

/**
 * @returns {string|null}
 */
export function getPlusEmoji() {
  return getConfigValue("plusplus_emoji");
}

/**
 * @returns {string|null}
 */
export function getMinusEmoji() {
  return getConfigValue("minusminus_emoji");
}

/**
 * @returns {string|null}
 */
export function getPinChannelId() {
  const id = getConfigValue("pin_channel_id");
  if (!id) {
    throw new Error("pin_channel_id configuration not found or has empty value.");
  }
  return id;
}

/**
 * Discord role IDs allowed to use /pin-message.
 * @returns {string[]}
 */
export function getPinMessageRoleIds() {
  const raw = getConfigValue("pin_message_role_ids", "[]");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

await loadConfig();
