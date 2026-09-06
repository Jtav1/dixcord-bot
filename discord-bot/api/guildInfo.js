/**
 * Periodic guild snapshot sync: pushes guild metadata, channels, and roles to webapi.
 */

import * as api from "./client.js";
import { guildId } from "../configVars.js";

const GUILD_INFO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** @type {import("discord.js").Client|null} */
let syncClient = null;

/**
 * Build a guild snapshot from discord.js's gateway cache - no extra Discord API calls.
 * @param {import("discord.js").Client} client
 * @returns {{ guild: object, channels: Array<object>, roles: Array<object> } | null}
 */
export function buildGuildSnapshot(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  return {
    guild: {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 256 }),
      description: guild.description ?? null,
      ownerId: guild.ownerId ?? null,
      boostTier: guild.premiumTier ?? null,
      boostCount: guild.premiumSubscriptionCount ?? null,
      verificationLevel: String(guild.verificationLevel ?? ""),
      preferredLocale: guild.preferredLocale ?? null,
      createdAt: guild.createdAt?.toISOString() ?? null,
    },
    channels: guild.channels.cache.map((c) => ({
      id: c.id,
      name: c.name,
      type: String(c.type),
      position: c.position ?? c.rawPosition ?? null,
      parentId: c.parentId ?? null,
    })),
    roles: guild.roles.cache.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
      mentionable: r.mentionable,
      hoisted: r.hoisted,
    })),
  };
}

/**
 * Build and push a guild snapshot. POST /api/guild/sync with { app: "discord", guildId, ... }.
 * @param {import("discord.js").Client} client
 * @returns {Promise<void>}
 */
export async function syncGuildInfo(client) {
  const snapshot = buildGuildSnapshot(client);
  if (!snapshot) {
    console.log("bot: guild not in cache yet; skipping guild-info sync");
    return;
  }
  await api.post("/api/guild/sync", {
    app: "discord",
    guildId,
    ...snapshot,
  });
}

/**
 * Start periodic guild-info sync.
 * @param {import("discord.js").Client} client
 * @returns {void}
 */
export function startGuildInfoSync(client) {
  syncClient = client;
  const tick = async () => {
    try {
      await syncGuildInfo(syncClient);
    } catch (err) {
      console.error("bot: guild-info sync error:", err);
    }
  };
  tick();
  setInterval(tick, GUILD_INFO_SYNC_INTERVAL_MS);
}
