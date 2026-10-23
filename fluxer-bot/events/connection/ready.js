import { Events } from "@fluxerjs/core";

import { guildId } from "../../configVars.js";
import { client } from "../../fluxerClient.js";
import { startGuildMembersSync } from "../../api/guildMembers.js";
import { buildInviteUrl } from "../../lib/inviteUrl.js";

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
      startGuildMembersSync();
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
