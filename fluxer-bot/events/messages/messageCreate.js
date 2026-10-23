import { Events } from "@fluxerjs/core";

import { commands } from "../../commandRegistry.js";
import { commandPrefix, guildId } from "../../configVars.js";

const name = Events.MessageCreate;

/**
 * Dispatch prefix commands (fluxer.js has no slash commands) from the configured community.
 * @param {import('@fluxerjs/core').Message} message
 */
const execute = async (message) => {
  if (message.author.bot || message.guildId !== guildId) return;
  if (!message.content.startsWith(commandPrefix)) return;

  const [cmdName, ...args] = message.content
    .slice(commandPrefix.length)
    .trim()
    .split(/\s+/);
  const command = commands.find((cmd) => cmd.cmdName === cmdName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(`bot: command "${cmdName}" error:`, err);
  }
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
