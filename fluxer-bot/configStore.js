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
  try {
    const entries = await getAllConfigurations();
    configMap = Object.fromEntries(
      entries.map((row) => [row.config, row.value ?? ""]),
    );
    const numWithValue = entries.filter(
      (row) => row.value !== null && row.value !== "",
    ).length;
    console.log(
      `config: loaded ${numWithValue} / ${entries.length} configs from webapi successfully`,
    );
    return configMap;
  } catch (error) {
    console.log("config: failed to load configurations from webapi", error);
    throw error;
  }
}

/**
 * Get a config value by key.
 * @param {string} key
 * @param {string|null} [defaultValue=null]
 * @returns {string|null}
 */
export function getConfigValue(key, defaultValue = null) {
  if (Object.prototype.hasOwnProperty.call(configMap, key)) {
    const value = configMap[key];
    if (value === null || value === undefined || value === "") {
      console.log(
        `config: key "${key}" does not have a value (got: ${JSON.stringify(value)})`,
      );
    }
    return value;
  }
  console.log(
    `config: key "${key}" not found; using default value (${JSON.stringify(defaultValue)})`,
  );
  return defaultValue;
}

/**
 * @returns {{app:string|null,emoid:string|null,emoji:string|null}|null} Resolved emoji object (see webapi's resolveConfigEmojiValue); null if unset. app: null means freeform text never synced to guild_emojis — compare with emojisMatch, not by id/name directly.
 */
export function getPlusEmoji() {
  return getConfigValue("plusplus_emoji");
}

/**
 * @returns {{app:string|null,emoid:string|null,emoji:string|null}|null} Resolved emoji object; null if unset. See getPlusEmoji for shape notes.
 */
export function getMinusEmoji() {
  return getConfigValue("minusminus_emoji");
}

/**
 * @returns {string}
 */
export function getAnnounceChannelId() {
  return getConfigValue("announce_channel_id", "");
}

/**
 * @returns {string|null}
 */
export function getPinChannelId() {
  return getConfigValue("pin_channel_id");
}

/**
 * @returns {{app:string|null,emoid:string|null,emoji:string|null}|null} Resolved emoji object; null if unset. See getPlusEmoji for shape notes.
 */
export function getPinEmoji() {
  return getConfigValue("pin_emoji");
}

/**
 * Generic feature-toggle check. Missing/unseeded keys default to enabled.
 * @param {string} key
 * @returns {boolean}
 */
export function isFeatureEnabled(key) {
  return getConfigValue(key, "true") !== "false";
}

/** @returns {boolean} */
export function isLinkFixerEnabled() {
  return isFeatureEnabled("twitter_fix_enabled");
}

/** @returns {boolean} */
export function isTriggerResponsesEnabled() {
  return isFeatureEnabled("trigger_responses_enabled");
}

/** @returns {boolean} */
export function isRemindersEnabled() {
  return isFeatureEnabled("reminders_enabled");
}

/** @returns {boolean} */
export function isEightBallEnabled() {
  return isFeatureEnabled("eight_ball_enabled");
}

/** @returns {boolean} */
export function isEmojiTrackingEnabled() {
  return isFeatureEnabled("emoji_tracking_enabled");
}

/** @returns {boolean} */
export function isStickerTrackingEnabled() {
  return isFeatureEnabled("sticker_tracking_enabled");
}

/** @returns {boolean} */
export function isPlusPlusEnabled() {
  return isFeatureEnabled("plusplus_enabled");
}

await loadConfig();
