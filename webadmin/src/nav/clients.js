/**
 * Client/feature navigation tree: top tabs per client, left nav per feature.
 * @type {{ key: string, label: string, features: { key: string, label: string, icon: string }[] }[]}
 */
export const CLIENTS = [
  {
    key: "discord-bot",
    label: "Discord Bot",
    features: [
      { key: "dashboard", label: "Dashboard", icon: "mdi-view-dashboard-outline" },
      { key: "config", label: "Config & Feature Flags", icon: "mdi-tune" },
      { key: "triggers", label: "Trigger Responses", icon: "mdi-message-reply-text-outline" },
      { key: "pin-quips", label: "Pin Quips", icon: "mdi-comment-quote-outline" },
      { key: "eight-ball", label: "8-Ball Responses", icon: "mdi-billiards" },
      { key: "reminders", label: "Reminders", icon: "mdi-clock-outline" },
      { key: "link-replacements", label: "Link Replacements", icon: "mdi-link-variant" },
      { key: "user-mappings", label: "User Mappings", icon: "mdi-account-multiple-outline" },
      { key: "activity", label: "Leaderboards & Events", icon: "mdi-trophy-outline" },
      { key: "pin-archive", label: "Pin Archive", icon: "mdi-pin-outline" },
      { key: "audit-log", label: "Audit Log", icon: "mdi-clipboard-text-clock-outline" },
    ],
  },
];
