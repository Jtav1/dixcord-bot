import { buildCommandListEmbed } from "./dixbot.js";

const cmdName = "help";

const data = {
  description: "List available commands (alias for dixbot)",
  usage: "help",
};

const execute = async (message) => {
  await message.reply({ embeds: [buildCommandListEmbed()] });
};

export { cmdName, data, execute };
