/**
 * Client/feature navigation tree: left nav per feature, scoped under the active guild tab
 * (AppShell.vue). `guildScoped: true` marks a feature as backed by per-guild data (guild_config,
 * etc.) — hidden from the nav while the "Global" tab is active. `app` is the chat-app value this
 * client's features should query webapi with (CHAT_MEMBER_APP_CONFIG keys: "discord"/"fluxer")
 * — explicit rather than derived from `key`, so a client's own routes/features always load that
 * client's own bot's data, never another client's.
 * @type {{ key: string, label: string, app: string, features: { key: string, label: string, icon: string, guildScoped?: boolean }[] }[]}
 */
export const CLIENTS = [
  {
    key: "discord-bot",
    label: "Discord Bot",
    app: "discord",
    features: [
      { key: "dashboard", label: "Dashboard", icon: "mdi-view-dashboard-outline" },
      { key: "config", label: "Config & Feature Flags", icon: "mdi-tune", guildScoped: true },
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
      { key: "react-for-role", label: "React For Role", icon: "mdi-account-sync-outline", guildScoped: true },
    ],
  },
  {
    key: "fluxer-bot",
    label: "Fluxer Bot",
    app: "fluxer",
    features: [
      // Non-guild-scoped landing route: AppShell's guild-tab switcher falls back to "dashboard"
      // whenever a guild-scoped feature (react-for-role) is active and the Global tab is picked.
      { key: "dashboard", label: "Dashboard", icon: "mdi-view-dashboard-outline" },
      { key: "react-for-role", label: "React For Role", icon: "mdi-account-sync-outline", guildScoped: true },
    ],
  },
];

/**
 * Resolve a client key (e.g. from the route path) to its chat-app value. Falls back to the
 * first client's app for an unrecognized key, so callers never silently query with `undefined`.
 * @param {string} clientKey
 * @returns {string}
 */
export function appForClientKey(clientKey) {
  return CLIENTS.find((client) => client.key === clientKey)?.app ?? CLIENTS[0].app;
}
