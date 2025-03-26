// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";

import fs from "node:fs";
import path from "node:path";
import { exec } from "child_process";

import { token, clientId, guildId, isDev, version } from "./configVars.js";
import { initializeDatabase } from "./database/initialize.js";
import { importAll } from "./database/import.js";
import {
  importEmojiList,
  countRepost,
  countEmoji,
  uncountRepost,
} from "./middleware/emojis.js";
import { messagePinner } from "./events/messages/utilities/messagePinner.js";
import { getAllConfigurations } from "./middleware/configurations.js";

import { doplus, dominus } from "./events/messages/utilities/plusplus.js";

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

await initializeDatabase();
await importAll();

const configs = await getAllConfigurations();

const pinThreshold = parseInt(
  configs.filter((config_entry) => config_entry.config === "pin_threshold")[0]
    .value
);

const pinEmoji = configs.filter(
  (config_entry) => config_entry.config === "pin_emoji"
)[0].value;

const repostEmojiId = configs.filter(
  (config_entry) => config_entry.config === "repost_emoji"
)[0].value;

const announceChannelId = configs.filter(
  (config_entry) => config_entry.config === "announce_channel_id"
)[0].value;

const plusEmoji = configs.filter(
  (config_entry) => config_entry.config === "plusplus_emoji"
)[0].value;

const minusEmoji = configs.filter(
  (config_entry) => config_entry.config === "minusminus_emoji"
)[0].value;

const commands = [];

//Set up events
//https://discord.js.org/#/docs/main/main/class/Client List of Events to handle
const eventsPath = path.join(import.meta.dirname, "events");
const eventCategories = fs.readdirSync(eventsPath);

// for each folder (category) under events, get all js files
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

client.once(Events.ClientReady, async (readyClient) => {
  // Once connected: import emojis
  const oauthGuild = await client.guilds.fetch(guildId);
  const guild = await oauthGuild.fetch();
  const emojis = await guild.emojis.fetch();

  await importEmojiList(emojis);

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
      await messagePinner(message, pinReact, user, client); // returns success bool
    }
  }

  if (reaction._emoji.id === plusEmoji && (user.id !== message.author.id)) {
    await doplus(reaction.message.author.id, "user", user.id);
  }
  if (reaction._emoji.id === minusEmoji && (user.id !== message.author.id)) {
    await dominus(reaction.message.author.id, "user", user.id);
  }

  let reactStr = "<:" + reaction._emoji.name + ":" + reaction._emoji.id + ">";

  // This shouldnt be necessary because countEmoji only counts server emoji BUT if we ever use a custom one, or add that in as another option...
  if (
    reaction._emoji.name === pinEmoji ||
    reaction._emoji.id === plusEmoji ||
    reaction._emoji.id === minusEmoji
  ) {
    // do nothing - bad form i know
  } else {
    countEmoji(reactStr, user.id);
  }

  const repostReact = allReactions.get(repostEmojiId);

  if (repostReact) {
    countRepost(message.author.id, message.id, user.id);
  }

  //this is how to split unicode emojis into their composite unicode string sorry i forgot to save the S.O. link
  //emoji.split("").map((unit) => "\\u" + unit.charCodeAt(0).toString(16).padStart(4, "0")).join("");
});

// https://stackoverflow.com/questions/66793543/reaction-event-discord-js
client.on("messageReactionRemove", async (reaction, user) => {
  // fetch the message if it's not cached
  const message = !reaction.message.author
    ? await reaction.message.fetch()
    : reaction.message;

  if (reaction._emoji.id === repostEmojiId) {
    uncountRepost(message.id, user.id);
  }

  // if the reactions are removed, do the opposite
  if (reaction._emoji.id === plusEmoji && (user.id !== message.author.id)) {
    await dominus(reaction.message.author.id, "user", user.id);
  }
  if (reaction._emoji.id === minusEmoji && (user.id !== message.author.id)) {
    await doplus(reaction.message.author.id, "user", user.id);
  }
});

client.on(Events.Error, async (error) => {
  console.error("Discord Client Error: ", error);
});

// Login to Discord with your client's token
await client.login(token);

if (announceChannelId.length > 0) {
  const announceChannel = await client.channels.fetch(announceChannelId);

  if (isDev) {
    console.log(`Dixbot ${version}-dev online`);
    //await announceChannel.send(`Dixbot ${version}-dev online`);
  } else {
    await announceChannel.send(`Dixbot ${version}-prod online`);
  }
}
