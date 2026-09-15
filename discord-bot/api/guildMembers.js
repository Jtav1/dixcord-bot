/**
 * Periodic guild membership sync: pushes per-member nickname/roles/joined-at to webapi.
 */

import * as api from "./client.js";
import { guildId } from "../configVars.js";

const GUILD_MEMBERS_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** @type {import("discord.js").Client|null} */
let syncClient = null;
let syncInProgress = false;

/**
 * Duck-types discord.js's GatewayRateLimitError (thrown by guild.members.fetch()
 * when opcode 8 gets throttled, e.g. right after a shard reconnect).
 * @param {unknown} err
 * @returns {err is Error & { data: { retry_after: number } }}
 */
function isGatewayRateLimitError(err) {
  return (
    err instanceof Error &&
    err.name === "GatewayRateLimitError" &&
    typeof (/** @type {any} */ (err).data?.retry_after) === "number"
  );
}

/**
 * Build the full membership list from a freshly-fetched member cache. Excludes bots.
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
 * Upsert a single member's row without touching the rest of the roster. Used for join events.
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
    if (syncInProgress) {
      console.log("bot: guild-members sync already in progress; skipping tick");
      return;
    }
    syncInProgress = true;
    try {
      await syncGuildMembers(syncClient);
    } catch (err) {
      if (isGatewayRateLimitError(err)) {
        const retryAfterSeconds = err.data.retry_after;
        console.warn(
          `bot: guild-members sync rate limited; retrying in ${retryAfterSeconds}s`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryAfterSeconds * 1000),
        );
        try {
          await syncGuildMembers(syncClient);
        } catch (retryErr) {
          console.error("bot: guild-members sync retry error:", retryErr);
        }
      } else {
        console.error("bot: guild-members sync error:", err);
      }
    } finally {
      syncInProgress = false;
    }
  };
  tick();
  setInterval(tick, GUILD_MEMBERS_SYNC_INTERVAL_MS);
}
