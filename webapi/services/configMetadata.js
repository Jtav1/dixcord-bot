/**
 * Static metadata for configuration keys exposed to admin consumers.
 */

/** @type {Record<string, { description: string, type: string, requiresBotRestart: boolean, deprecated?: boolean, defaultValue: string }>} */
export const CONFIG_METADATA = Object.freeze({
  pin_threshold: {
    description: "Number of pin reactions required before auto-pin alert",
    type: "integer",
    requiresBotRestart: false,
    defaultValue: "1",
  },
  pin_emoji: {
    description: "Emoji name or ID used for pin reactions",
    type: "string",
    requiresBotRestart: false,
    defaultValue: "",
  },
  pin_channel_id: {
    description: "Discord channel ID where pin embeds are posted",
    type: "string",
    requiresBotRestart: false,
    defaultValue: "",
  },
  repost_emoji: {
    description: "Discord emoji ID for repost accusation reactions",
    type: "string",
    requiresBotRestart: false,
    defaultValue: "",
  },
  announce_channel_id: {
    description:
      "Discord channel ID for bot online announcements (read once at bot startup)",
    type: "string",
    requiresBotRestart: true,
    defaultValue: "",
  },
  plusplus_emoji: {
    description: "Discord emoji ID for plus votes",
    type: "string",
    requiresBotRestart: false,
    defaultValue: "",
  },
  minusminus_emoji: {
    description: "Discord emoji ID for minus votes",
    type: "string",
    requiresBotRestart: false,
    defaultValue: "",
  },
  pin_message_role_ids: {
    description: "JSON array of Discord role IDs allowed to use /pin-message",
    type: "json",
    requiresBotRestart: false,
    defaultValue: "[]",
  },
  twitter_fix_enabled: {
    description: "Enable link fixer when message contains dd/dixbot/fix",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  trigger_responses_enabled: {
    description: "Enable trigger-string auto-reply matching on messages",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  reminders_enabled: {
    description:
      "Enable creating new reminders via '@bot remind me ...' (does not affect delivery or /scheduled-* management of existing ones)",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  eight_ball_enabled: {
    description: "Enable 8-ball/fortune replies when mentioning the bot with a message ending in '?'",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  emoji_tracking_enabled: {
    description:
      "Enable emoji usage tracking from message content and reactions (excludes the plusplus_enabled vote-reply shortcut)",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  sticker_tracking_enabled: {
    description: "Enable sticker usage tracking from message content",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  plusplus_enabled: {
    description:
      "Enable plus/minus reputation voting (++/-- text, vote reactions, emoji-reply shortcut) and its leaderboard commands",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  repost_detection_enabled: {
    description: "Enable repost accusation reaction tracking and its leaderboard commands",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  pin_system_enabled: {
    description: "Enable auto-pin via reaction threshold and the /pin-message command",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "true",
  },
  user_mapping_import_channel_id: {
    description:
      "Extra text channel merged into user-mapping sync; applied on next sync (bot startup)",
    type: "string",
    requiresBotRestart: true,
    defaultValue: "",
  },
});

/**
 * Default {config, value} entries for seeding a new server's guild_config rows.
 * @returns {Array<{ config: string, value: string }>}
 */
export function getDefaultConfigEntries() {
  return Object.entries(CONFIG_METADATA).map(([config, meta]) => ({
    config,
    value: meta.defaultValue,
  }));
}

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
