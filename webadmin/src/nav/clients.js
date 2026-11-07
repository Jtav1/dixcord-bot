/**
 * Feature navigation, in two tiers selected via AppShell's single top dropdown ("Global", or
 * one of the configured bots — guild_info is keyed on (app, guild_id), so each non-Global
 * dropdown entry names one specific bot+guild pair):
 * - GLOBAL_FEATURES: cross-app features with no guild scope (left nav while "Global" is active).
 *   Routed at `/global/:feature`.
 * - BOT_FEATURES: per-(app, guildId) features — the same feature set for every bot, applied to
 *   whichever bot+guild is selected (left nav while a specific bot is active).
 *   Routed at `/bot/:app/:guildId/:feature`.
 * @type {{ key: string, label: string, icon: string }[]}
 */
export const GLOBAL_FEATURES = [
  { key: "dashboard", label: "Dashboard", icon: "mdi-view-dashboard-outline" },
  { key: "triggers", label: "Trigger Responses", icon: "mdi-message-reply-text-outline" },
  { key: "pin-quips", label: "Pin Quips", icon: "mdi-comment-quote-outline" },
  { key: "eight-ball", label: "8-Ball Responses", icon: "mdi-billiards" },
  { key: "reminders", label: "Reminders", icon: "mdi-clock-outline" },
  { key: "link-replacements", label: "Link Replacements", icon: "mdi-link-variant" },
  { key: "user-mappings", label: "User Mappings", icon: "mdi-account-multiple-outline" },
  { key: "unmapped-users", label: "Unmapped Users", icon: "mdi-account-question-outline" },
  { key: "activity", label: "Leaderboards & Events", icon: "mdi-trophy-outline" },
  { key: "milestones", label: "Milestones", icon: "mdi-flag-checkered" },
  { key: "pin-archive", label: "Pin Archive", icon: "mdi-pin-outline" },
  { key: "audit-log", label: "Audit Log", icon: "mdi-clipboard-text-clock-outline" },
  { key: "guild-emojis", label: "Emoji/Sticker Catalog", icon: "mdi-emoticon-outline" },
];

/** @type {{ key: string, label: string, icon: string }[]} */
export const BOT_FEATURES = [
  { key: "config", label: "Config & Feature Flags", icon: "mdi-tune" },
  { key: "react-for-role", label: "React For Role", icon: "mdi-account-sync-outline" },
];

/** Display label for a chat-app value (CHAT_MEMBER_APP_CONFIG keys), for the bot-picker dropdown. */
const APP_LABELS = { discord: "Discord Bot", fluxer: "Fluxer Bot" };

/**
 * @param {string} app
 * @returns {string}
 */
export function appLabel(app) {
  return APP_LABELS[app] ?? app;
}
