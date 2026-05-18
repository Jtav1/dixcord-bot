import { REST, Routes } from "discord.js";
import { clientId, guildId, token } from "./configVars.js";
import { output } from "./utils/output.js";

const rest = new REST().setToken(token);

(async () => {
  try {
    // for guild-based commands
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [],
    });
    output("Successfully deleted all guild commands.");
  } catch (error) {
    output.error(error);
    process.exit(1);
  }
})();
