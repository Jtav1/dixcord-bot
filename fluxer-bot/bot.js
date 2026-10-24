import { Events } from "@fluxerjs/core";

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { token } from "./configVars.js";
import { client } from "./fluxerClient.js";
import { commands } from "./commandRegistry.js";

// Side-effect imports: both load guild_config / triggers / link-hosts into memory via a
// top-level await, and must finish before any event listener can fire a message handler.
import "./configStore.js";
import "./api/cacheRefresh.js";

// EventEmitter throws if an "error" event has no listener; without this, a failed
// login or dropped gateway connection crashes the process instead of just logging.
client.on(Events.Error, (error) => {
  console.error("bot: Fluxer client error:", error);
});

/**
 * Wrap an event handler so a thrown/rejected execute() is logged instead of crashing the
 * process (the client does not catch async listener rejections, and Node terminates on an
 * unhandled rejection by default).
 * @param {string} eventName
 * @param {(...args: any[]) => any} handler
 * @returns {(...args: any[]) => Promise<void>}
 */
function guardEventHandler(eventName, handler) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (err) {
      console.error(`bot: unhandled error in "${eventName}" handler:`, err);
    }
  };
}

const eventsPath = path.join(import.meta.dirname, "events");
const eventCategories = fs.readdirSync(eventsPath);

for (const category of eventCategories) {
  const eventCategoryPath = path.join(eventsPath, category);
  if (!fs.statSync(eventCategoryPath).isDirectory()) continue;

  for (const file of fs
    .readdirSync(eventCategoryPath)
    .filter((file) => file.endsWith(".js"))) {
    const { event } = await import(
      pathToFileURL(path.join(eventCategoryPath, file))
    );

    const guarded = guardEventHandler(event.name, event.execute);
    if (event.once) {
      client.once(event.name, guarded);
    } else {
      client.on(event.name, guarded);
    }
  }
}

// Mirrors discord-bot's command loader shape ({ cmdName, data, execute }). fluxer.js has no
// slash commands, so these run as prefix commands from events/messages/messageCreate.js.
const commandsPath = path.join(import.meta.dirname, "commands");
const commandsCategories = fs
  .readdirSync(commandsPath)
  .filter((entry) => fs.statSync(path.join(commandsPath, entry)).isDirectory());

for (const category of commandsCategories) {
  const commandCategoryPath = path.join(commandsPath, category);

  for (const file of fs
    .readdirSync(commandCategoryPath)
    .filter((file) => file.endsWith(".js"))) {
    const command = await import(
      pathToFileURL(path.join(commandCategoryPath, file))
    );

    if ("cmdName" in command && "data" in command && "execute" in command) {
      commands.push(command);
    } else {
      console.log(
        `bot: [WARNING] Command ${commandCategoryPath} is missing a required "cmdName" or "data" or "execute" property.`,
      );
    }
  }
}

try {
  await client.login(token);
  console.log("bot: client.login() completed successfully");
} catch (err) {
  console.error("bot: client.login() failed:", err);
  process.exit(1);
}
