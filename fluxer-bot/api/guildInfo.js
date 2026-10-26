/**
 * Periodic guild snapshot sync: pushes guild metadata, channels, and roles to webapi.
 */

import * as api from "./client.js";
import { guildId } from "../configVars.js";
import { client } from "../fluxerClient.js";

const GUILD_INFO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Build a guild snapshot from fluxer.js's gateway cache - no extra API calls. Fluxer has no
 * description/preferredLocale/boost-tier concept (unlike Discord), so those fields are always
 * null; role color is converted from fluxer's int to the same #rrggbb string discord-bot sends,
 * for consistent display across apps.
 * @param {import("@fluxerjs/core").Client} fluxerClient
 * @returns {{ guild: object, channels: Array<object>, roles: Array<object> } | null}
 */
export function buildGuildSnapshot(fluxerClient) {
  const guild = fluxerClient.guilds.get(guildId);
  if (!guild) return null;

  return {
    guild: {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL?.() ?? null,
      description: null,
      ownerId: guild.ownerId ?? null,
      boostTier: null,
      boostCount: null,
      verificationLevel: String(guild.verificationLevel ?? ""),
      preferredLocale: null,
      createdAt: guild.createdAt?.toISOString() ?? null,
    },
    channels: [...guild.channels.values()].map((c) => ({
      id: c.id,
      name: c.name,
      type: String(c.type),
      position: c.position ?? null,
      parentId: c.parentId ?? null,
    })),
    roles: [...guild.roles.values()].map((r) => ({
      id: r.id,
      name: r.name,
      color: `#${(r.color ?? 0).toString(16).padStart(6, "0")}`,
      position: r.position,
      mentionable: r.mentionable,
      hoisted: r.hoist,
    })),
  };
}

/**
 * Build and push a guild snapshot. POST /api/guild/sync with { app: "fluxer", guildId, ... }.
 * @returns {Promise<void>}
 */
export async function syncGuildInfo() {
  const snapshot = buildGuildSnapshot(client);
  if (!snapshot) {
    console.log("bot: guild not in cache yet; skipping guild-info sync");
    return;
  }
  await api.post("/api/guild/sync", {
    app: "fluxer",
    guildId,
    ...snapshot,
  });
}

/**
 * Start periodic guild-info sync.
 * @returns {void}
 */
export function startGuildInfoSync() {
  const tick = async () => {
    try {
      await syncGuildInfo();
    } catch (err) {
      console.error("bot: guild-info sync error:", err);
    }
  };
  tick();
  setInterval(tick, GUILD_INFO_SYNC_INTERVAL_MS);
}
