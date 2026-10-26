import { Events } from "@fluxerjs/core";

import { guildId, isDev, version } from "../../configVars.js";
import { client } from "../../fluxerClient.js";
import { getAnnounceChannelId } from "../../configStore.js";
import { startGuildMembersSync } from "../../api/guildMembers.js";
import { startCacheVersionPoller } from "../../api/cacheRefresh.js";
import { startMessageScheduler } from "../../scheduler/messageScheduler.js";
import { startHeartbeat } from "../../api/system.js";
import { startGuildInfoSync } from "../../api/guildInfo.js";
import { importEmojiList } from "../../api/emojis.js";
import { importStickerList } from "../../api/stickers.js";
import { hydratePinHistory } from "./utilities/pinHistoryHydration.js";
import { buildInviteUrl } from "../../lib/inviteUrl.js";

/**
 * Log, or send, the online-announce message if announce_channel_id is configured.
 * @returns {Promise<void>}
 */
async function sendOnlineAnnounce() {
  const announceChannelId = getAnnounceChannelId();
  if (!announceChannelId) return;

  if (isDev) {
    console.log(`=======Dixbot ${version}-dev online========`);
    return;
  }

  const channel = await client.channels.fetch(announceChannelId);
  await channel.send(`Dixbot ${version}-prod online`);
}

const name = Events.Ready;

/**
 * Log once the client has authenticated and connected. Fluxer's Ready event carries no
 * payload (unlike discord.js's readyClient arg) — read state off the shared `client`.
 */
const execute = async () => {
  console.log(
    `bot: Ready! Logged in as ${client.user?.username} at ${new Date().toLocaleString()}`,
  );

  let inviteLink = null;
  try {
    inviteLink = await buildInviteUrl();
    console.log(`bot: invite link: ${inviteLink}`);
  } catch (err) {
    console.error("bot: failed to build invite link:", err);
  }

  if (guildId) {
    try {
      const guild = await client.guilds.resolve(guildId);
      console.log(`bot: connected to community "${guild.name}" (${guild.id})`);

      const [, , emojis, stickers] = await Promise.all([
        guild.fetchChannels(),
        guild.fetchRoles(),
        guild.fetchEmojis(),
        guild.fetchStickers(),
      ]);
      await importEmojiList(emojis);
      await importStickerList(stickers);

      try {
        await hydratePinHistory(client);
      } catch (err) {
        console.error("bot: pin-history hydration error:", err);
      }

      try {
        await sendOnlineAnnounce();
      } catch (err) {
        console.error("bot: online-announce error:", err);
      }

      startGuildMembersSync();
      startCacheVersionPoller();
      startMessageScheduler();
      startHeartbeat(client.readyAt);
      startGuildInfoSync();
    } catch (err) {
      const status = err?.cause?.statusCode;
      if (status !== 403 && status !== 404) throw err;

      console.error(
        `bot: cannot access configured community ${guildId} — the bot has not been invited to it. ` +
          `Have an admin of that community open this link to add the bot, then restart: ${inviteLink ?? "(invite link unavailable)"}`,
      );
      await client.destroy?.();
      process.exit(1);
    }
  }
};

export const event = {
  name: name,
  execute: execute,
  once: true,
};
