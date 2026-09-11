/**
 * Prometheus exposition text for /metrics: DB-derived gauges, feature-flag state, and the
 * discord-bot's latest reported counter snapshot (piggybacked on its heartbeat).
 */

import client from "prom-client";
import db from "../config/db.js";
import { getDatabaseStatistics } from "./statistics.js";
import { getSystemStatus } from "./systemStatus.js";
import { CONFIG_METADATA } from "./configMetadata.js";

/**
 * Parse the bot's cumulative counter snapshot stored in bot_status.metrics_json.
 * @param {string|null|undefined} stored
 * @returns {Record<string, unknown>|null}
 */
function parseBotMetrics(stored) {
  if (stored == null || String(stored).trim() === "") return null;
  try {
    return JSON.parse(String(stored));
  } catch {
    return null;
  }
}

/** @returns {Promise<Record<string, unknown>|null>} */
async function getLatestBotMetrics() {
  const [rows] = await db.query(
    "SELECT metrics_json FROM bot_status ORDER BY last_seen_at DESC LIMIT 1",
  );
  return parseBotMetrics(rows?.[0]?.metrics_json);
}

/** @returns {Promise<Array<{ config: string, enabled: boolean }>>} */
async function getFeatureFlagStates() {
  const [rows] = await db.query("SELECT config, value FROM configurations");
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => CONFIG_METADATA[row.config]?.type === "boolean")
    .map((row) => ({
      config: row.config,
      enabled: String(row.value) !== "false",
    }));
}

/** @returns {Promise<Array<{ action: string, resource: string, count: number }>>} */
async function getAuditLogEventCounts() {
  const [rows] = await db.query(
    "SELECT action, resource, COUNT(*) AS n FROM audit_log GROUP BY action, resource",
  );
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    action: String(row.action ?? "unknown"),
    resource: String(row.resource ?? "unknown"),
    count: Number(row.n) || 0,
  }));
}

/** @returns {Promise<{ boostTier: number|null, boostCount: number|null, channels: number, roles: number }>} */
async function getGuildSnapshotCounts() {
  const [guildRows] = await db.query(
    "SELECT boost_tier, boost_count FROM guild_info LIMIT 1",
  );
  const [channelRows] = await db.query(
    "SELECT COUNT(*) AS n FROM guild_channels",
  );
  const [roleRows] = await db.query("SELECT COUNT(*) AS n FROM guild_roles");
  const guildRow = guildRows?.[0];
  return {
    boostTier: guildRow?.boost_tier == null ? null : Number(guildRow.boost_tier),
    boostCount:
      guildRow?.boost_count == null ? null : Number(guildRow.boost_count),
    channels: Number(channelRows?.[0]?.n) || 0,
    roles: Number(roleRows?.[0]?.n) || 0,
  };
}

/**
 * Build the full Prometheus exposition text for the current process/DB/bot state.
 * A fresh Registry is created per call: everything here is either a live query result or an
 * externally-reported cumulative snapshot, so there's no in-process accumulation to preserve
 * across scrapes.
 * @returns {Promise<{ text: string, contentType: string }>}
 */
export async function buildMetricsText() {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const [stats, status, flags, auditCounts, guildCounts, botMetrics] =
    await Promise.all([
      getDatabaseStatistics(),
      getSystemStatus(),
      getFeatureFlagStates(),
      getAuditLogEventCounts(),
      getGuildSnapshotCounts(),
      getLatestBotMetrics(),
    ]);

  const gauge = (name, help, labelNames = []) =>
    new client.Gauge({ name, help, labelNames, registers: [register] });

  // --- DB-derived aggregate counts (webapi/services/statistics.js) ---
  gauge("webapi_chat_member_mappings", "Rows in chat_member_mapping.").set(
    stats.chatMemberMappings,
  );

  const emojiCatalog = gauge(
    "webapi_emoji_catalog",
    "Distinct emoji/sticker catalog entries.",
    ["type"],
  );
  emojiCatalog.set({ type: "emoji" }, stats.emojiCatalog.emojis);
  emojiCatalog.set({ type: "sticker" }, stats.emojiCatalog.stickers);

  const emojiUsage = gauge(
    "webapi_emoji_usage_total",
    "Cumulative emoji/sticker usage (sum of frequency columns).",
    ["type"],
  );
  emojiUsage.set({ type: "emoji" }, stats.emojiUsage.emojis);
  emojiUsage.set({ type: "sticker" }, stats.emojiUsage.stickers);

  gauge("webapi_pin_history_total", "Rows in pin_history.").set(
    stats.pinHistory,
  );
  gauge("webapi_plusplus_tracking_total", "Rows in plusplus_tracking.").set(
    stats.plusplusTracking,
  );
  gauge("webapi_triggers_total", "Rows in triggers.").set(stats.triggers);
  gauge("webapi_responses_total", "Rows in responses.").set(stats.responses);
  gauge(
    "webapi_trigger_response_frequency_total",
    "Sum of trigger_response.frequency across all links.",
  ).set(stats.triggerResponseFrequencySum);
  gauge("webapi_repost_tracking_total", "Rows in user_repost_tracking.").set(
    stats.repostTracking,
  );

  const scheduled = gauge(
    "webapi_scheduled_messages",
    "Scheduled messages by status.",
    ["status"],
  );
  scheduled.set({ status: "pending" }, stats.scheduledMessages.pending);
  scheduled.set({ status: "sent" }, stats.scheduledMessages.sent);

  // --- Process/system status (webapi/services/systemStatus.js) ---
  gauge("webapi_up", "Always 1 while this process is serving requests.").set(1);
  gauge("webapi_db_up", "1 if the last DB health check succeeded, else 0.").set(
    status.db === "ok" ? 1 : 0,
  );
  gauge("webapi_uptime_seconds", "Seconds since this webapi process started.").set(
    status.webapiUptimeSeconds,
  );
  gauge(
    "webapi_memory_rss_bytes",
    "Resident set size of this webapi process, in bytes.",
  ).set(status.webapiMemoryRssBytes);

  if (status.bot) {
    const guildIdLabel = { guild_id: status.bot.guildId };
    gauge("discordbot_up", "1 if the bot's last heartbeat was recent, else 0.", [
      "guild_id",
    ]).set(guildIdLabel, status.bot.online ? 1 : 0);
    if (status.bot.uptimeSeconds != null) {
      gauge(
        "discordbot_uptime_seconds",
        "Seconds since the bot's current gateway session became ready.",
        ["guild_id"],
      ).set(guildIdLabel, status.bot.uptimeSeconds);
    }
    if (status.bot.memberCount != null) {
      gauge("discordbot_member_count", "Guild member count as of the last heartbeat.", [
        "guild_id",
      ]).set(guildIdLabel, status.bot.memberCount);
    }
    if (status.bot.channelCount != null) {
      gauge(
        "discordbot_channel_count",
        "Cached guild channel count as of the last heartbeat.",
        ["guild_id"],
      ).set(guildIdLabel, status.bot.channelCount);
    }
    if (status.bot.wsPingMs != null) {
      gauge(
        "discordbot_ws_ping_ms",
        "Discord gateway heartbeat latency in ms as of the last heartbeat.",
        ["guild_id"],
      ).set(guildIdLabel, status.bot.wsPingMs);
    }
  }

  // --- Feature flags ---
  const featureEnabled = gauge(
    "webapi_feature_enabled",
    "1 if the named feature flag is enabled, else 0.",
    ["flag"],
  );
  for (const flag of flags) {
    featureEnabled.set({ flag: flag.config }, flag.enabled ? 1 : 0);
  }

  // --- Audit log activity ---
  const auditEvents = gauge(
    "webapi_audit_log_events_total",
    "Audit log rows grouped by action and resource.",
    ["action", "resource"],
  );
  for (const row of auditCounts) {
    auditEvents.set({ action: row.action, resource: row.resource }, row.count);
  }

  // --- Guild snapshot (webapi/services/guildInfo.js sync) ---
  if (guildCounts.boostTier != null) {
    gauge("webapi_guild_boost_tier", "Guild boost tier from the last guild sync.").set(
      guildCounts.boostTier,
    );
  }
  if (guildCounts.boostCount != null) {
    gauge(
      "webapi_guild_boost_count",
      "Guild boost count from the last guild sync.",
    ).set(guildCounts.boostCount);
  }
  gauge("webapi_guild_channels_total", "Rows in guild_channels.").set(
    guildCounts.channels,
  );
  gauge("webapi_guild_roles_total", "Rows in guild_roles.").set(
    guildCounts.roles,
  );

  // --- discord-bot's self-reported cumulative counters (from its heartbeat) ---
  if (botMetrics && typeof botMetrics === "object") {
    const breakdownKeys = new Set([
      "commandsTotal",
      "commandErrorsTotal",
      "apiCallErrorsTotal",
    ]);
    const breakdownGaugeNames = {
      commandsTotal: ["discordbot_commands_total", "command"],
      commandErrorsTotal: ["discordbot_command_errors_total", "command"],
      apiCallErrorsTotal: ["discordbot_api_call_errors_total", "module"],
    };

    for (const [key, value] of Object.entries(botMetrics)) {
      if (breakdownKeys.has(key)) {
        if (!value || typeof value !== "object") continue;
        const [gaugeName, labelName] = breakdownGaugeNames[key];
        const g = gauge(gaugeName, `discord-bot reported counter: ${key}.`, [
          labelName,
        ]);
        for (const [label, count] of Object.entries(value)) {
          const n = Number(count);
          if (Number.isFinite(n)) g.set({ [labelName]: label }, n);
        }
      } else {
        const n = Number(value);
        if (!Number.isFinite(n)) continue;
        const snakeName = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        gauge(`discordbot_${snakeName}`, `discord-bot reported counter: ${key}.`).set(
          n,
        );
      }
    }
  }

  return { text: await register.metrics(), contentType: register.contentType };
}
