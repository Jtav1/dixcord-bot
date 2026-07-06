import { REST, Routes } from "discord.js";
import { clientId, guildId, token } from "./configVars.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
      commands.push(command.data.toJSON());
    } else {
      console.log(
        `bot: WARNING Command at ${filePath} is missing "data" or "execute" property`,
      );
    }
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(
      `bot: Refreshing ${commands.length} application (/) commands...`,
    );
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );
    console.log(
      `bot: Successfully reloaded ${data.length} application (/) commands!`,
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
