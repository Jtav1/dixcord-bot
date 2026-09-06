/**
 * Static metadata for configuration keys exposed to admin consumers.
 */

/** @type {Record<string, { description: string, type: string, requiresBotRestart: boolean, deprecated?: boolean }>} */
export const CONFIG_METADATA = Object.freeze({
  pin_threshold: {
    description: "Number of pin reactions required before auto-pin alert",
    type: "integer",
    requiresBotRestart: false,
  },
  pin_emoji: {
    description: "Emoji name or ID used for pin reactions",
    type: "string",
    requiresBotRestart: false,
  },
  pin_channel_id: {
    description: "Discord channel ID where pin embeds are posted",
    type: "string",
    requiresBotRestart: false,
  },
  repost_emoji: {
    description: "Discord emoji ID for repost accusation reactions",
    type: "string",
    requiresBotRestart: false,
  },
  announce_channel_id: {
    description:
      "Discord channel ID for bot online announcements (read once at bot startup)",
    type: "string",
    requiresBotRestart: true,
  },
  plusplus_emoji: {
    description: "Discord emoji ID for plus votes",
    type: "string",
    requiresBotRestart: false,
  },
  minusminus_emoji: {
    description: "Discord emoji ID for minus votes",
    type: "string",
    requiresBotRestart: false,
  },
  pin_message_role_ids: {
    description: "JSON array of Discord role IDs allowed to use /pin-message",
    type: "json",
    requiresBotRestart: false,
  },
  twitter_fix_enabled: {
    description: "Enable link fixer when message contains dd/dixbot/fix",
    type: "boolean",
    requiresBotRestart: false,
  },
  user_mapping_import_channel_id: {
    description:
      "Extra text channel merged into user-mapping sync; applied on next sync (bot startup)",
    type: "string",
    requiresBotRestart: true,
  },
});

/**
 * Enrich config entries with metadata for admin consumers.
 * @param {Array<{ config: string, value: string }>} entries
 * @returns {Array<{ config: string, value: string, description: string|null, type: string, requiresBotRestart: boolean, deprecated: boolean }>}
 */
export function enrichConfigEntries(entries) {
  return entries.map((row) => {
    const meta = CONFIG_METADATA[row.config];
    return {
      config: row.config,
      value: row.value ?? "",
      description: meta?.description ?? null,
      type: meta?.type ?? "string",
      requiresBotRestart: meta?.requiresBotRestart ?? true,
      deprecated: meta?.deprecated ?? false,
    };
  });
}
