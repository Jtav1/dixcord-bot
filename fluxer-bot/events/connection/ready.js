import { Events } from "@fluxerjs/core";

import { guildId } from "../../configVars.js";
import { client } from "../../fluxerClient.js";

const name = Events.Ready;

/**
 * Log once the client has authenticated and connected. Fluxer's Ready event carries no
 * payload (unlike discord.js's readyClient arg) — read state off the shared `client`.
 */
const execute = async () => {
  console.log(
    `bot: Ready! Logged in as ${client.user?.username} at ${new Date().toLocaleString()}`,
  );

  if (guildId) {
    const guild = await client.guilds.resolve(guildId);
    console.log(`bot: connected to community "${guild.name}" (${guild.id})`);
  }
};

export const event = {
  name: name,
  execute: execute,
  once: true,
};
