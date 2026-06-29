/**
 * Static metadata for configuration keys exposed to admin consumers.
 */

/** @type {Record<string, { description: string, type: string, requiresBotRestart: boolean, deprecated?: boolean }>} */
export const CONFIG_METADATA = Object.freeze({
  pin_threshold: {
    description: "Number of pin reactions required before auto-pin alert",
    type: "integer",
    requiresBotRestart: true,
  },
  pin_emoji: {
    description: "Emoji name or ID used for pin reactions",
    type: "string",
    requiresBotRestart: true,
  },
  pin_channel_id: {
    description: "Discord channel ID where pin embeds are posted",
    type: "string",
    requiresBotRestart: true,
  },
  repost_emoji: {
    description: "Discord emoji ID for repost accusation reactions",
    type: "string",
    requiresBotRestart: true,
  },
  announce_channel_id: {
    description: "Discord channel ID for bot online announcements",
    type: "string",
    requiresBotRestart: true,
  },
  plusplus_emoji: {
    description: "Discord emoji ID for plus votes",
    type: "string",
    requiresBotRestart: true,
  },
  minusminus_emoji: {
    description: "Discord emoji ID for minus votes",
    type: "string",
    requiresBotRestart: true,
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
  rare_frequency: {
    description: "Unused legacy setting",
    type: "number",
    requiresBotRestart: false,
    deprecated: true,
  },
  take_a_look_delay: {
    description: "Unused legacy setting (milliseconds)",
    type: "integer",
    requiresBotRestart: false,
    deprecated: true,
  },
  take_a_look_repost_limit: {
    description: "Unused legacy setting",
    type: "integer",
    requiresBotRestart: false,
    deprecated: true,
  },
  timeout_emoji: {
    description: "Unused legacy setting",
    type: "string",
    requiresBotRestart: false,
    deprecated: true,
  },
  timeout_vote_threshold: {
    description: "Unused legacy setting",
    type: "integer",
    requiresBotRestart: false,
    deprecated: true,
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
