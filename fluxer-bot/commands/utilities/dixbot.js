import { EmbedBuilder } from "@fluxerjs/builders";

import { commands } from "../../commandRegistry.js";
import { commandPrefix } from "../../configVars.js";

const cmdName = "dixbot";

const data = {
  description: "List available commands",
  usage: "dixbot",
};

/**
 * Generated from the live command registry, not hand-maintained, so it can't go stale. Shared
 * with !help and the "@bot help" mention trigger (messageCreate.js) — same response everywhere.
 * @returns {EmbedBuilder}
 */
export function buildCommandListEmbed() {
  const lines = commands
    .map((cmd) => `**${commandPrefix}${cmd.data.usage}** — ${cmd.data.description}`)
    .sort();
  return new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("📖 Dixbot Commands")
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Prefix: ${commandPrefix}` });
}

const execute = async (message) => {
  await message.reply({ embeds: [buildCommandListEmbed()] });
};

export { cmdName, data, execute };
