import { commands } from "../../commandRegistry.js";
import { commandPrefix } from "../../configVars.js";

const cmdName = "dixbot";

const data = {
  description: "List available commands",
  usage: "dixbot",
};

const execute = async (message) => {
  // Generated from the live command registry, not hand-maintained, so it can't go stale.
  const lines = commands
    .map((cmd) => `${commandPrefix}${cmd.data.usage} — ${cmd.data.description}`)
    .sort();
  await message.reply(`Available commands:\n${lines.join("\n")}`);
};

export { cmdName, data, execute };
