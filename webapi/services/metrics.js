/**
 * Prometheus exposition text for /metrics: DB-derived gauges, feature-flag state, and every
 * currently-known bot's (app, guild) health + self-reported counter snapshot from its heartbeat.
 */

import client from "@prometheus-io/client";
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

/**
 * Parsed metrics_json for every currently-known (app, guild) bot, keyed by "app:guildId".
 * @returns {Promise<Map<string, Record<string, unknown>>>}
 */
async function getAllBotMetrics() {
  const [rows] = await db.query("SELECT app, guild_id, metrics_json FROM bot_status");
  const result = new Map();
  for (const row of rows ?? []) {
    const metrics = parseBotMetrics(row.metrics_json);
    if (metrics) result.set(`${row.app}:${row.guild_id}`, metrics);
  }
  return result;
}

/** Feature flags are per-guild (guild_config); each guild reports its own gauge series. @returns {Promise<Array<{ config: string, guildId: string, enabled: boolean }>>} */
async function getFeatureFlagStates() {
  const [rows] = await db.query("SELECT guild_id, config, value FROM guild_config");
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => CONFIG_METADATA[row.config]?.type === "boolean")
    .map((row) => ({
      config: row.config,
      guildId: String(row.guild_id),
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

  const [stats, status, flags, auditCounts, guildCounts, botMetricsByKey] =
    await Promise.all([
      getDatabaseStatistics(),
      getSystemStatus(),
      getFeatureFlagStates(),
      getAuditLogEventCounts(),
      getGuildSnapshotCounts(),
      getAllBotMetrics(),
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
  gauge("webapi_repost_tracking_total", "Rows in member_repost_tracking.").set(
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

  const botLabelNames = ["app", "guild_id"];
  const botUp = gauge(
    "bot_up",
    "1 if this (app, guild) bot's last heartbeat was recent, else 0.",
    botLabelNames,
  );
  const botUptime = gauge(
    "bot_uptime_seconds",
    "Seconds since this bot's current gateway session became ready.",
    botLabelNames,
  );
  const botMemberCount = gauge(
    "bot_member_count",
    "Guild member count as of this bot's last heartbeat.",
    botLabelNames,
  );
  const botChannelCount = gauge(
    "bot_channel_count",
    "Cached guild channel count as of this bot's last heartbeat.",
    botLabelNames,
  );
  const botWsPingMs = gauge(
    "bot_ws_ping_ms",
    "Gateway heartbeat latency in ms as of this bot's last heartbeat.",
    botLabelNames,
  );
  for (const botRow of status.bots) {
    const labels = { app: botRow.app, guild_id: botRow.guildId };
    botUp.set(labels, botRow.online ? 1 : 0);
    if (botRow.uptimeSeconds != null) botUptime.set(labels, botRow.uptimeSeconds);
    if (botRow.memberCount != null) botMemberCount.set(labels, botRow.memberCount);
    if (botRow.channelCount != null) botChannelCount.set(labels, botRow.channelCount);
    if (botRow.wsPingMs != null) botWsPingMs.set(labels, botRow.wsPingMs);
  }

  // --- Feature flags (per guild) ---
  const featureEnabled = gauge(
    "webapi_feature_enabled",
    "1 if the named feature flag is enabled for the guild, else 0.",
    ["flag", "guild_id"],
  );
  for (const flag of flags) {
    featureEnabled.set(
      { flag: flag.config, guild_id: flag.guildId },
      flag.enabled ? 1 : 0,
    );
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

  // --- Each bot's self-reported cumulative counters (from its heartbeat) ---
  const breakdownKeys = new Set([
    "commandsTotal",
    "commandErrorsTotal",
    "apiCallErrorsTotal",
  ]);
  const breakdownGaugeNames = {
    commandsTotal: ["bot_commands_total", "command"],
    commandErrorsTotal: ["bot_command_errors_total", "command"],
    apiCallErrorsTotal: ["bot_api_call_errors_total", "module"],
  };
  const scalarGauges = new Map();
  const breakdownGauges = new Map();

  for (const botRow of status.bots) {
    const botMetrics = botMetricsByKey.get(`${botRow.app}:${botRow.guildId}`);
    if (!botMetrics || typeof botMetrics !== "object") continue;
    const labels = { app: botRow.app, guild_id: botRow.guildId };

    for (const [key, value] of Object.entries(botMetrics)) {
      if (breakdownKeys.has(key)) {
        if (!value || typeof value !== "object") continue;
        const [gaugeName, labelName] = breakdownGaugeNames[key];
        let g = breakdownGauges.get(gaugeName);
        if (!g) {
          g = gauge(gaugeName, `Bot-reported counter: ${key}.`, [
            "app",
            "guild_id",
            labelName,
          ]);
          breakdownGauges.set(gaugeName, g);
        }
        for (const [label, count] of Object.entries(value)) {
          const n = Number(count);
          if (Number.isFinite(n)) g.set({ ...labels, [labelName]: label }, n);
        }
      } else {
        const n = Number(value);
        if (!Number.isFinite(n)) continue;
        const snakeName = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        const gaugeName = `bot_${snakeName}`;
        let g = scalarGauges.get(gaugeName);
        if (!g) {
          g = gauge(gaugeName, `Bot-reported counter: ${key}.`, ["app", "guild_id"]);
          scalarGauges.set(gaugeName, g);
        }
        g.set(labels, n);
      }
    }
  }

  return { text: await register.metrics(), contentType: register.contentType };
}
