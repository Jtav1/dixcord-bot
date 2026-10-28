import { buildCommandListEmbed } from "./dixbot.js";

const cmdName = "help";

const data = {
  description: "List available commands (alias for dixbot)",
  usage: "help",
};

const execute = async (message) => {
  await message.author.send({ embeds: [buildCommandListEmbed()] }).catch(() => null);
};

export { cmdName, data, execute };
