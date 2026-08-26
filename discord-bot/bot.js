// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { token, guildId, isDev, version, clientId } from "./configVars.js";
import { importEmojiList } from "./api/emojis.js";
import { importStickerList } from "./api/stickers.js";
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

/**
 * Wrap an event handler so a thrown/rejected execute() is logged instead of crashing the
 * process (discord.js does not catch async listener rejections, and Node terminates on an
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
        `bot: [WARNING] Command ${commandCategoryPath} is missing a required "cmdName" or "data" or "execute" property.`,
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
    console.log("bot: command execution error");
  }
});

client.once(Events.ClientReady, async (readyClient) => {
  const oauthGuild = await client.guilds.fetch(guildId);
  const guild = await oauthGuild.fetch();
  const emojis = await guild.emojis.fetch();
  const stickers = await guild.stickers.fetch();

  await importEmojiList(emojis);
  await importStickerList(stickers);
  await syncUserMappingFromGuild(readyClient);
  await hydratePinHistory(readyClient).catch((err) => {
    console.error("pin-history hydration error:", err);
  });
  await startMessageScheduler(readyClient);
  startCacheVersionPoller();
  startHeartbeat();

  console.log(
    `bot: Ready! Logged in as ${readyClient.user.tag} at ${new Date().toLocaleString()}`,
  );
});

client.on(
  "messageReactionAdd",
  guardEventHandler("messageReactionAdd", async (reaction, user) => {
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
  }),
);

client.on(
  "messageReactionRemove",
  guardEventHandler("messageReactionRemove", async (reaction, user) => {
    await handleReactionRemove(reaction, user, {
      plusEmoji: getPlusEmoji(),
      minusEmoji: getMinusEmoji(),
      repostEmojiId: getRepostEmojiId(),
    });
  }),
);

client.on(Events.Error, async (error) => {
  console.error("Discord Client Error: ", error);
});

await client.login(token).then(() => {
  console.log("bot: client.login() completed successfully");
});

const announceChannelId = getAnnounceChannelId();
if (announceChannelId.length > 0) {
  const announceChannel = await client.channels.fetch(announceChannelId);

  if (isDev) {
    console.log(`=======Dixbot ${version}-dev online========`);
  } else {
    await announceChannel.send(`Dixbot ${version}-prod online`);
  }
}
