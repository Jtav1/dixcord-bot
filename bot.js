// Require the necessary discord.js classes
import {
  REST,
  Routes,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { token, clientId, guildId, isDev, version } from "./configVars.js";
import { initializeDatabase } from "./database/initialize.js";
import {
  importEmojiList,
  importTakeALookList,
  importConfigs,
  importFortunes,
} from "./database/import.js";

import fs from "node:fs";
import path from "node:path";

import dataLog from "./logging/dataLog.js";
import messagePinner from "./events/messages/utilities/messagePinner.js";

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

//TODO PUT THESE INTO CONFIG TABLE
const pinThreshold = isDev ? 1 : 3; // TODO emoji pin voting threshold, put into db instead as configuration
const pinEmoji = "\ud83d\udccc"; // TODO pin emoji unicode maybe move into db

const commands = [];
const announceChannelId = "710671234471559228"; //TODO move this to config table in db

const emojiList = [];

await initializeDatabase();
await importConfigs();
await importTakeALookList();
await importFortunes();

//Set up events
//https://discord.js.org/#/docs/main/main/class/Client List of Events to handle

const eventsPath = path.join(import.meta.dirname, "events");
const eventCategories = fs.readdirSync(eventsPath);

//for each folder (category) under events, get all js files
for (const category of eventCategories) {
  const eventCategoryPath = path.join(eventsPath, category);

  for (const file of fs
    .readdirSync(eventCategoryPath)
    .filter((file) => file.endsWith(".js"))) {
    const { event } = await import(path.join(eventCategoryPath, file));

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

//Set up commands
const commandsPath = path.join(import.meta.dirname, "commands");
const commandsCategories = fs.readdirSync(commandsPath);

//for each folder (category) under events, get all js files
for (const category of commandsCategories) {
  const commandCategoryPath = path.join(commandsPath, category);

  for (const file of fs
    .readdirSync(commandCategoryPath)
    .filter((file) => file.endsWith(".js"))) {
    const command = await import(path.join(commandCategoryPath, file));

    if ("cmdName" in command && "data" in command && "execute" in command) {
      commands.push(command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "cmdName" or "data" or "execute" property.`
      );
    }
  }
}

// Respond to commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  let runCommand = commands.find(
    (cmd) => cmd.cmdName === interaction.commandName
  );
  try {
    await runCommand.execute(interaction);
  } catch (e) {
    console.log("command execution error");
  }
});

client.once(Events.ClientReady, (readyClient) => {
  // Once connected: import emojis
  client.guilds
    .fetch(guildId)
    .then((guild) => {
      guild.emojis
        .fetch()
        .then((result) => {
          importEmojiList(
            result.map((r) => ({
              id: r.id,
              name: r.name,
              animated: r.animated,
              type: "emoji",
            }))
          );
        })
        .catch(console.error);
    })
    .catch(console.error);

  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// https://stackoverflow.com/questions/66793543/reaction-event-discord-js
client.on("messageReactionAdd", async (reaction, user) => {
  // fetch the message if it's not cached
  const message = !reaction.message.author
    ? await reaction.message.fetch()
    : reaction.message;

  const allReactions = message.reactions.valueOf();
  const pinReact = allReactions.get(pinEmoji);

  if (pinReact) {
    if (pinReact.count === pinThreshold) {
      //dataLog.logPinnedMessage(message.id);
      await messagePinner(message, pinReact, user, client); // returns success bool
    }
  }

  let reactStr = "<:" + reaction._emoji.name + ":" + reaction._emoji.id + ">";

  // This shouldnt be necessary because countEmoji only counts server emoji BUT if we ever use a custom one, or add that in as another option...
  if (reaction._emoji.name === pinEmoji) {
    //console.log("HIT");
  } else {
    dataLog.countEmoji(reactStr);
  }

  //this is how to split unicode emojis into their composite unicode string sorry i forgot to save the S.O. link
  //emoji.split("").map((unit) => "\\u" + unit.charCodeAt(0).toString(16).padStart(4, "0")).join("");
});

// Login to Discord with your client's token
await client.login(token);

if (announceChannelId.length > 0) {
  const announceChannel = await client.channels.fetch(announceChannelId);

  if (isDev) {
    console.log(version);
    //await announceChannel.send(`Dixbot ${version}-dev online`);
  } else {
    await announceChannel.send(`Dixbot ${version}-prod online`);
  }
}
