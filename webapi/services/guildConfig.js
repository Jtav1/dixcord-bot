/**
 * Per-(app, guild_id) configuration/feature-flags, seeded with defaults on first registration.
 */

import db from "../config/db.js";
import {
  CONFIG_METADATA,
  configDisplayOrder,
  enrichConfigEntries,
  getDefaultConfigEntries,
} from "./configMetadata.js";
import { resolveConfigEmojiValue } from "./emojiFrequency.js";

/**
 * List all config entries for one server, enriched with metadata, in CONFIG_METADATA's display order.
 * "emoji"-typed entries resolve to an emoji object (see resolveConfigEmojiValue) instead of a bare string.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<{ config: Record<string, string|object|null>, entries: Array<{config:string,value:string|object|null}>, entriesWithMeta: Array<object> }>}
 */
export async function listGuildConfig(app, guildId) {
  const [rows] = await db.query(
    "SELECT config, value FROM guild_config WHERE app = ? AND guild_id = ?",
    [app, guildId],
  );
  const rawEntries = (Array.isArray(rows) ? rows : []).sort(
    (a, b) => configDisplayOrder(a.config) - configDisplayOrder(b.config),
  );

  const entries = await Promise.all(
    rawEntries.map(async (row) => ({
      config: row.config,
      value:
        CONFIG_METADATA[row.config]?.type === "emoji"
          ? await resolveConfigEmojiValue(app, guildId, row.value)
          : (row.value ?? ""),
    })),
  );

  const config = Object.fromEntries(entries.map((row) => [row.config, row.value]));
  return { config, entries, entriesWithMeta: enrichConfigEntries(entries) };
}

/**
 * @param {string} app
 * @param {string} guildId
 * @param {string} config
 * @returns {Promise<string|null>}
 */
export async function getGuildConfigValue(app, guildId, config) {
  const [rows] = await db.query(
    "SELECT value FROM guild_config WHERE app = ? AND guild_id = ? AND config = ?",
    [app, guildId, config],
  );
  return rows?.[0]?.value ?? null;
}

/**
 * Create a new config key for a server. Returns false if it already exists.
 * @param {string} app
 * @param {string} guildId
 * @param {string} config
 * @param {string} value
 * @returns {Promise<boolean>}
 */
export async function createGuildConfigKey(app, guildId, config, value) {
  const existing = await getGuildConfigValue(app, guildId, config);
  if (existing != null) return false;
  await db.query(
    "INSERT INTO guild_config (app, guild_id, config, value) VALUES (?, ?, ?, ?)",
    [app, guildId, config, value],
  );
  return true;
}

/**
 * Update an existing config key's value. Returns false if the key doesn't exist yet.
 * @param {string} app
 * @param {string} guildId
 * @param {string} config
 * @param {string} value
 * @returns {Promise<boolean>}
 */
export async function setGuildConfigValue(app, guildId, config, value) {
  const [result] = await db.query(
    "UPDATE guild_config SET value = ? WHERE app = ? AND guild_id = ? AND config = ?",
    [value, app, guildId, config],
  );
  const affected = result?.affectedRows ?? result?.changes ?? 0;
  return affected > 0;
}

/**
 * @param {string} app
 * @param {string} guildId
 * @param {string} config
 * @returns {Promise<boolean>}
 */
export async function deleteGuildConfigKey(app, guildId, config) {
  const [result] = await db.query(
    "DELETE FROM guild_config WHERE app = ? AND guild_id = ? AND config = ?",
    [app, guildId, config],
  );
  const affected = result?.affectedRows ?? result?.changes ?? 0;
  return affected > 0;
}

/**
 * Seed every known config key's default value for a server, skipping keys already present.
 * Safe to call repeatedly for an already-configured guild — e.g. to backfill keys added to
 * CONFIG_METADATA after the guild was first registered (see ensureSchema.js's per-boot backfill).
 * @param {string} app
 * @param {string} guildId
 * @param {Array<{config:string,value:string}>} [overrides] Values to use instead of the default
 * @returns {Promise<number>} number of keys actually inserted (0 if the guild already had everything)
 */
export async function seedDefaultConfigForGuild(app, guildId, overrides = []) {
  const overrideMap = new Map(overrides.map((row) => [row.config, row.value]));
  let insertedCount = 0;
  for (const entry of getDefaultConfigEntries()) {
    const existing = await getGuildConfigValue(app, guildId, entry.config);
    if (existing != null) continue;
    const value = overrideMap.has(entry.config) ? overrideMap.get(entry.config) : entry.value;
    await db.query(
      "INSERT INTO guild_config (app, guild_id, config, value) VALUES (?, ?, ?, ?)",
      [app, guildId, entry.config, value],
    );
    insertedCount += 1;
  }
  return insertedCount;
}

/**
 * Whether a server has any guild_config rows yet (used to guard the one-time migration backfill).
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
export async function guildConfigExistsFor(app, guildId) {
  const [rows] = await db.query(
    "SELECT config FROM guild_config WHERE app = ? AND guild_id = ? LIMIT 1",
    [app, guildId],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Whether guild_config has any rows at all, across every app/guild (used to guard dev-mode seeding).
 * @returns {Promise<boolean>}
 */
export async function guildConfigIsEmpty() {
  const [rows] = await db.query("SELECT config FROM guild_config LIMIT 1");
  return !(Array.isArray(rows) && rows.length > 0);
}
