/**
 * Periodic guild membership sync: pushes per-member nickname/roles/joined-at to webapi.
 */

import * as api from "./client.js";
import { guildId } from "../configVars.js";

const GUILD_MEMBERS_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** @type {import("discord.js").Client|null} */
let syncClient = null;

/**
 * Build the full membership list from discord.js's member cache (fetched fresh so
 * handle/nickname/roles/joined-at are current). Excludes bot accounts.
 * @param {import("discord.js").Guild} guild
 * @returns {Promise<Array<{ platformUserId: string, handle: string, nickname: string|null, roles: string[], joinedAt: string|null }>>}
 */
async function buildMemberList(guild) {
  await guild.members.fetch();
  return guild.members.cache
    .filter((member) => !member.user.bot)
    .map((member) => ({
      platformUserId: String(member.id),
      handle: String(member.user.username ?? ""),
      nickname: member.nickname ?? null,
      roles: member.roles.cache.map((r) => r.id),
      joinedAt: member.joinedAt?.toISOString() ?? null,
    }));
}

/**
 * Build and push the guild's membership list. POST /api/guild-members/sync with
 * { app: "discord", guildId, members }.
 * @param {import("discord.js").Client} client
 * @returns {Promise<void>}
 */
export async function syncGuildMembers(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.log("bot: guild not in cache yet; skipping guild-members sync");
    return;
  }
  const members = await buildMemberList(guild);
  await api.post("/api/guild-members/sync", {
    app: "discord",
    guildId,
    members,
  });
}

/**
 * Push a single member's row without affecting the rest of the guild's roster — sync never
 * deletes, so this is just an upsert of one row via the same endpoint. Used for join events.
 * @param {import("discord.js").GuildMember} member
 * @returns {Promise<void>}
 */
export async function syncSingleGuildMember(member) {
  await api.post("/api/guild-members/sync", {
    app: "discord",
    guildId: member.guild.id,
    members: [
      {
        platformUserId: String(member.id),
        handle: String(member.user.username ?? ""),
        nickname: member.nickname ?? null,
        roles: member.roles.cache.map((r) => r.id),
        joinedAt: member.joinedAt?.toISOString() ?? null,
      },
    ],
  });
}

/**
 * Start periodic guild-members sync.
 * @param {import("discord.js").Client} client
 * @returns {void}
 */
export function startGuildMembersSync(client) {
  syncClient = client;
  const tick = async () => {
    try {
      await syncGuildMembers(syncClient);
    } catch (err) {
      console.error("bot: guild-members sync error:", err);
    }
  };
  tick();
  setInterval(tick, GUILD_MEMBERS_SYNC_INTERVAL_MS);
}
