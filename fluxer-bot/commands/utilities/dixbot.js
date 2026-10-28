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
  // Field names render bolder/larger than the description text, making the command itself
  // stand out from its one-line explanation (set as the field's value).
  const fields = commands
    .map((cmd) => ({
      name: `${commandPrefix}${cmd.data.usage}`,
      value: cmd.data.description,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("📖 Dixbot Commands")
    .addFields(...fields)
    .setFooter({
      text: `If you need more help contact Justin. Remember all commands start with !`,
    });
}

const execute = async (message) => {
  await message.author
    .send({ embeds: [buildCommandListEmbed()] })
    .catch(() => null);
};

export { cmdName, data, execute };
