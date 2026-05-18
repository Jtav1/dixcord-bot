import { REST, Routes } from "discord.js";
import { clientId, guildId, token } from "./configVars.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { output } from "./utils/output.js";

const commands = [];
const foldersPath = path.join(process.cwd(), "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath));
    if ("data" in command && "execute" in command) {
      output("Found command, adding...");
      commands.push(command.data.toJSON());
    } else {
      output(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }

    // if(command.data && command.execute){
    // 	console.log("use this other format 0000000");
    // }
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    output(
      `Started refreshing ${commands.length} application (/) commands.`,
    );
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );
    output(
      `Successfully reloaded ${data.length} application (/) commands.`,
    );
  } catch (error) {
    output.error(error);
    process.exit(1);
  }
})();
