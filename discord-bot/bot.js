// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { token, guildId, isDev, version, clientId } from "./configVars.js";
import { importEmojiList } from "./api/emojis.js";
import { syncUserMappingFromGuild } from "./api/userMapping.js";
import { hydratePinHistory } from "./events/messages/utilities/pinHistoryHydration.js";
import {
  getAnnounceChannelId,
  getMinusEmoji,
  getPinEmoji,
  getPinThreshold,
  getPlusEmoji,
  getRepostEmojiId,
} from "./configStore.js";
import { startCacheVersionPoller } from "./api/cacheRefresh.js";
import { startHeartbeat } from "./api/system.js";
import { startMessageScheduler } from "./scheduler/messageScheduler.js";
import {
  handleReactionAdd,
  handleReactionRemove,
} from "./events/messages/utilities/reactionHandler.js";

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

const commands = [];

const eventsPath = path.join(import.meta.dirname, "events");
const eventCategories = fs.readdirSync(eventsPath);

for (const category of eventCategories) {
  const eventCategoryPath = path.join(eventsPath, category);

  for (const file of fs
    .readdirSync(eventCategoryPath)
    .filter((file) => file.endsWith(".js"))) {
    const { event } = await import(
      pathToFileURL(path.join(eventCategoryPath, file))
    );

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

const commandsPath = path.join(import.meta.dirname, "commands");
const commandsCategories = fs.readdirSync(commandsPath);

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
        `[WARNING] Command ${commandCategoryPath} is missing a required "cmdName" or "data" or "execute" property.`,
      );
    }
  }
}

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
  const oauthGuild = await client.guilds.fetch(guildId);
  const guild = await oauthGuild.fetch();
  const emojis = await guild.emojis.fetch();

  await importEmojiList(emojis);
  await syncUserMappingFromGuild(readyClient);
  await hydratePinHistory(readyClient).catch((err) => {
    console.error("pin-history hydration error:", err);
  });
  await startMessageScheduler(readyClient);
  startCacheVersionPoller();
  startHeartbeat();

  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.id !== clientId) {
    await handleReactionAdd(reaction, user, {
      client,
      pinEmoji: getPinEmoji(),
      pinThreshold: getPinThreshold(),
      plusEmoji: getPlusEmoji(),
      minusEmoji: getMinusEmoji(),
      repostEmojiId: getRepostEmojiId(),
    });
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  await handleReactionRemove(reaction, user, {
    plusEmoji: getPlusEmoji(),
    minusEmoji: getMinusEmoji(),
    repostEmojiId: getRepostEmojiId(),
  });
});

client.on(Events.Error, async (error) => {
  console.error("Discord Client Error: ", error);
});

await client.login(token);

const announceChannelId = getAnnounceChannelId();
if (announceChannelId.length > 0) {
  const announceChannel = await client.channels.fetch(announceChannelId);

  if (isDev) {
    console.log(`Dixbot ${version}-dev online`);
  } else {
    await announceChannel.send(`Dixbot ${version}-prod online`);
  }
}
