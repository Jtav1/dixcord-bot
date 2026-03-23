import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Channel used to validate scope and to scan message authors (union with guild members).
 * Hard-coded per deployment; must belong to DISCORD_GUILD_ID.
 */
export const IMPORT_CHANNEL_ID = "";

/**
 * Sync Discord user rows with the web API.
 * POST /api/message-processing/user-mapping-import
 * @param {Iterable<{ name: string, discord_handle: string, discord_id: string }>} userRows
 */
export const importUserMappingList = async (userRows) => {
  const list = Array.isArray(userRows) ? userRows : Array.from(userRows ?? []);
  await api.post("/api/message-processing/user-mapping-import", {
    users: list,
  });
  console.log("db: user mapping import complete (via webapi)");
};

/**
 * Collect guild members (non-bot) plus any message authors in IMPORT_CHANNEL_ID, then POST to webapi.
 * @param {import('discord.js').Client} client
 */
export async function syncUserMappingFromGuild(client) {
  const oauthGuild = await client.guilds.fetch(guildId);
  const guild = await oauthGuild.fetch();
  const channel = await guild.channels
    .fetch(IMPORT_CHANNEL_ID)
    .catch(() => null);

  if (!channel || channel.guildId !== guild.id) {
    console.warn(
      "user-mapping: IMPORT_CHANNEL_ID not found or not in guild; skipping user mapping sync",
    );
    return;
  }

  /** @type {Map<string, { name: string, discord_handle: string, discord_id: string }>} */
  const byId = new Map();

  await guild.members.fetch();
  for (const member of guild.members.cache.values()) {
    if (member.user.bot) continue;
    const u = member.user;
    byId.set(u.id, {
      name: String(member.displayName || u.globalName || u.username || u.id),
      discord_handle: String(u.username ?? ""),
      discord_id: String(u.id),
    });
  }

  if (channel.isTextBased()) {
    let lastId;
    for (;;) {
      const messages = await channel.messages.fetch({
        limit: 100,
        before: lastId,
      });
      if (messages.size === 0) break;
      for (const msg of messages.values()) {
        if (msg.author.bot) continue;
        const u = msg.author;
        if (byId.has(u.id)) continue;
        byId.set(u.id, {
          name: String(u.globalName || u.username || u.id),
          discord_handle: String(u.username ?? ""),
          discord_id: String(u.id),
        });
      }
      lastId = messages.last()?.id;
    }
  }

  await importUserMappingList(byId.values());
}
