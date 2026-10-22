/**
 * Periodic guild membership sync: pushes per-member nickname/roles/joined-at to webapi.
 */

import * as api from "./client.js";
import { guildId } from "../configVars.js";
import { client } from "../fluxerClient.js";

const GUILD_MEMBERS_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const FETCH_PAGE_SIZE = 1000; // fluxer max per page
const POST_BATCH_SIZE = 200; // keeps each sync body under webapi's 100kb json limit

let syncInProgress = false;

/**
 * Map a fluxer GuildMember to the webapi sync payload shape.
 * @param {import("@fluxerjs/core").GuildMember} member
 * @returns {{ platformUserId: string, handle: string, nickname: string|null, roles: string[], joinedAt: string|null }}
 */
function toSyncMember(member) {
  return {
    platformUserId: String(member.id),
    handle: String(member.user.username ?? ""),
    nickname: member.nick ?? null,
    roles: [...member.roles.roleIds],
    joinedAt: member.joinedAt?.toISOString() ?? null,
  };
}

/**
 * Page through the full member list. Excludes bots.
 * @param {import("@fluxerjs/core").Guild} guild
 * @returns {Promise<import("@fluxerjs/core").GuildMember[]>}
 */
async function fetchAllMembers(guild) {
  const all = [];
  let after;
  for (;;) {
    const page = await guild.members.fetch({ limit: FETCH_PAGE_SIZE, after });
    all.push(...page);
    if (page.length < FETCH_PAGE_SIZE) break;
    after = page[page.length - 1].id;
  }
  return all.filter((member) => !member.user.bot);
}

/**
 * Build and push the community's membership list. POST /api/guild-members/sync with
 * { app: "fluxer", guildId, members }.
 * @returns {Promise<void>}
 */
export async function syncGuildMembers() {
  const guild = await client.guilds.resolve(guildId);
  const members = (await fetchAllMembers(guild)).map(toSyncMember);

  for (let i = 0; i < members.length; i += POST_BATCH_SIZE) {
    await api.post("/api/guild-members/sync", {
      app: "fluxer",
      guildId,
      members: members.slice(i, i + POST_BATCH_SIZE),
    });
  }
  console.log(`bot: synced ${members.length} guild members`);
}

/**
 * Upsert a single member's row without touching the rest of the roster. Used for join events.
 * @param {import("@fluxerjs/core").GuildMember} member
 * @returns {Promise<void>}
 */
export async function syncSingleGuildMember(member) {
  await api.post("/api/guild-members/sync", {
    app: "fluxer",
    guildId: member.guild.id,
    members: [toSyncMember(member)],
  });
}

/**
 * Start periodic guild-members sync.
 * @returns {void}
 */
export function startGuildMembersSync() {
  const tick = async () => {
    if (syncInProgress) {
      console.log("bot: guild-members sync already in progress; skipping tick");
      return;
    }
    syncInProgress = true;
    try {
      await syncGuildMembers();
    } catch (err) {
      console.error("bot: guild-members sync error:", err);
    } finally {
      syncInProgress = false;
    }
  };
  tick();
  setInterval(tick, GUILD_MEMBERS_SYNC_INTERVAL_MS);
}

/**
 * POST a link action; webapi 400s carry a user-facing { error }, surfaced instead of thrown.
 * @param {string} path
 * @param {object} body
 * @returns {Promise<{ ok: boolean, error?: string, [key: string]: any }>}
 */
async function postLinkAction(path, body) {
  try {
    const { data } = await api.post(path, body);
    return data;
  } catch (err) {
    if (err.response?.status === 400 && err.response.data?.error) {
      return { ok: false, error: err.response.data.error };
    }
    throw err;
  }
}

/**
 * Flag another server's account for linking to the requester's. POST /api/guild-members/link-request.
 * @param {string} requesterUserId
 * @param {string} targetUserId
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export function requestAccountLink(requesterUserId, targetUserId) {
  return postLinkAction("/api/guild-members/link-request", {
    app: "fluxer",
    guildId,
    requesterUserId,
    targetUserId,
  });
}

/**
 * Confirm a pending account link. POST /api/guild-members/link-confirm.
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, error?: string, requesterHandle?: string|null }>}
 */
export function confirmAccountLink(userId) {
  return postLinkAction("/api/guild-members/link-confirm", {
    app: "fluxer",
    guildId,
    userId,
  });
}
