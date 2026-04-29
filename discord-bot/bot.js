// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";

import fs from "node:fs";
import path from "node:path";

import {
  token,
  guildId,
  isDev,
  version,
  scheduledMessageRoutesEnabled,
} from "./configVars.js";
import { importEmojiList } from "./api/emojis.js";
import { syncUserMappingFromGuild } from "./api/userMapping.js";
import { getAllConfigurations } from "./api/configurations.js";
import {
  handleReactionAdd,
  handleReactionRemove,
} from "./events/messages/utilities/reactionHandler.js";
import { startScheduledMessageDelivery } from "./jobs/scheduledMessageDelivery.js";

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const configs = await getAllConfigurations();

const pinThreshold = parseInt(
  configs.find((config_entry) => config_entry.config === "pin_threshold")
    ?.value || null,
);

const pinEmoji =
  configs.find((config_entry) => config_entry.config === "pin_emoji")?.value ||
  null;
const repostEmojiId =
  configs.find((config_entry) => config_entry.config === "repost_emoji")
    ?.value || null;
const announceChannelId =
  configs.find((config_entry) => config_entry.config === "announce_channel_id")
    ?.value || null;
const plusEmoji =
  configs.find((config_entry) => config_entry.config === "plusplus_emoji")
    ?.value || null;
const minusEmoji =
  configs.find((config_entry) => config_entry.config === "minusminus_emoji")
    ?.value || null;

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
        `[WARNING] Command ${commandCategoryPath} is missing a required "cmdName" or "data" or "execute" property.`,
      );
    }
  }
}

// Respond to commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  let runCommand = commands.find(
    (cmd) => cmd.cmdName === interaction.commandName,
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
  await syncUserMappingFromGuild(readyClient);

  if (scheduledMessageRoutesEnabled) {
    startScheduledMessageDelivery(readyClient);
  } else {
    console.log(
      "Scheduled message delivery disabled (SCHEDULED_MESSAGE_ROUTES_ENABLED).",
    );
  }

  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on("messageReactionAdd", async (reaction, user) => {
  await handleReactionAdd(reaction, user, {
    client,
    pinEmoji,
    pinThreshold,
    plusEmoji,
    minusEmoji,
    repostEmojiId,
  });
});

client.on("messageReactionRemove", async (reaction, user) => {
  await handleReactionRemove(reaction, user, {
    plusEmoji,
    minusEmoji,
    repostEmojiId,
  });
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
