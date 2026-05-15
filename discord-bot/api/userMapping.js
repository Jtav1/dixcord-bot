import * as api from "./client.js";
import { guildId, userMappingImportChannelId } from "../configVars.js";

/**
 * Sync Discord user rows with the web API.
 * The API updates chat_member_mapping.name when a stored row matches both discord_id and
 * discord_handle for a user in this payload, then upserts on discord_id; it never deletes rows.
 *
 * POST /api/message-processing/user-mapping-import
 * @param {Iterable<{ name: string, discord_handle: string, discord_id: string }>} userRows
 * @returns {Promise<void>}
 */
export const importUserMappingList = async (userRows) => {
  const list = Array.isArray(userRows) ? userRows : Array.from(userRows ?? []);
  await api.post("/api/message-processing/user-mapping-import", {
    app: "discord",
    users: list,
  });
  console.log("db: user mapping import complete (via webapi)");
};

/**
 * Collect guild members (non-bot) plus any message authors in the channel from
 * DISCORD_USER_MAPPING_IMPORT_CHANNEL_ID, then POST to webapi via importUserMappingList.
 *
 * @param {import('discord.js').Client} client - logged-in Discord client
 * @returns {Promise<void>}
 */
export async function syncUserMappingFromGuild(client) {
  const oauthGuild = await client.guilds.fetch(guildId);
  const guild = await oauthGuild.fetch();
  const channel = await guild.channels
    .fetch(userMappingImportChannelId)
    .catch(() => null);

  if (!channel || channel.guildId !== guild.id) {
    console.warn(
      "user-mapping: DISCORD_USER_MAPPING_IMPORT_CHANNEL_ID not found or not in guild; skipping user mapping sync",
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
