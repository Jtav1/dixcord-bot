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
    description: "Emoji used for pin reactions",
    type: "emoji",
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
    description: "Emoji used for repost accusation reactions",
    type: "emoji",
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
    description: "Emoji used for plus votes",
    type: "emoji",
    requiresBotRestart: false,
    defaultValue: "",
  },
  minusminus_emoji: {
    description: "Emoji used for minus votes",
    type: "emoji",
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
  timeout_vote_enabled: {
    description: "Enable vote-to-timeout via reaction threshold",
    type: "boolean",
    requiresBotRestart: false,
    defaultValue: "false",
  },
  timeout_vote_emoji: {
    description: "Emoji used for timeout votes",
    type: "emoji",
    requiresBotRestart: false,
    defaultValue: "",
  },
  timeout_vote_threshold: {
    description: "Weighted vote total required to time out a message's author",
    type: "integer",
    requiresBotRestart: false,
    defaultValue: "5",
  },
  timeout_vote_duration_seconds: {
    description: "Timeout duration in seconds once the vote threshold is reached (capped at 86400, Discord's 24h max)",
    type: "integer",
    requiresBotRestart: false,
    defaultValue: "300",
  },
  timeout_vote_response_message: {
    description: "Message the bot sends when a timeout vote succeeds; {user} is replaced with a mention",
    type: "string",
    requiresBotRestart: false,
    defaultValue: "{user} has been timed out by community vote.",
  },
  timeout_vote_double_role_id: {
    description: "Discord role whose timeout votes count double",
    type: "string",
    requiresBotRestart: false,
    defaultValue: "",
  },
  timeout_vote_triple_role_id: {
    description: "Discord role whose timeout votes count triple",
    type: "string",
    requiresBotRestart: false,
    defaultValue: "",
  },
});

const CONFIG_KEY_ORDER = Object.keys(CONFIG_METADATA);

/**
 * Display-order index for a config key, matching CONFIG_METADATA's declaration order above
 * (e.g. plusplus_emoji before minusminus_emoji). Unknown keys sort last.
 * @param {string} config
 * @returns {number}
 */
export function configDisplayOrder(config) {
  const index = CONFIG_KEY_ORDER.indexOf(config);
  return index === -1 ? CONFIG_KEY_ORDER.length : index;
}

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
