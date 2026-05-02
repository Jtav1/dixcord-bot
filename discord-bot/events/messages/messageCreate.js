import { clientId } from "../../configVars.js";

import {
  getLinkFixerResponse,
  getFortuneResponse,
} from "../../api/responses.js";
import {
  getTriggersList,
  getRandomResponseForTrigger,
} from "../../api/triggerResponses.js";
import { getLinkReplacementSourceHosts } from "../../api/linkReplacements.js";
import { createScheduledMessage } from "../../api/scheduledMessages.js";
import { refreshScheduledMessagesCache } from "../../scheduler/messageScheduler.js";
import { parseReminderMessage } from "./utilities/scheduleParser.js";
import { MessageFlags } from "discord.js";

//******* UTILITIES FUNCTIONS ********//;
import { emojiDetector } from "./utilities/emojiDetector.js";
import { plusMinusMsg } from "./utilities/plusplus.js";

const name = "messageCreate";

/** Cached triggers (with selection_mode) from API; loaded on first message. */
let cachedTriggers = null;

/** Cached link-replacement source hosts from API; loaded on first message. */
let cachedLinkHosts = null;

const execute = async (message) => {
  //******* INCOMING MESSAGE PROCESSING *******//
  let response = "";

  if (!message.author.bot && !(message.author.id === clientId)) {
    // check every message for emojis
    await emojiDetector(message);
    await plusMinusMsg(message);

    // Strip incoming message for comparison
    const contentStripped = message.content
      .toLowerCase()
      .replace(/[^a-zA-Z0-9!]/g, "");

    // If there's a link to fix, do that (using source hosts from DB)
    if (cachedLinkHosts === null) {
      cachedLinkHosts = await getLinkReplacementSourceHosts();
    }
    const twitCheck = message.content.split(" ").filter((word) => {
      const tmpWord = word.replace(/[<>]/g, "");
      return cachedLinkHosts.some((host) => tmpWord.includes(host));
    });

    if (twitCheck.length > 0) {
      const twitFixReply = await getLinkFixerResponse(message.content ?? "");
      if (twitFixReply.length > 0) {
        response = twitFixReply;
      }
    }

    // Then, if message matches a trigger from the DB, get a random response for it
    if (cachedTriggers === null) {
      cachedTriggers = await getTriggersList();
    }
    const matchedTrigger = cachedTriggers.find((t) =>
      contentStripped.includes(t.trigger_string),
    );
    if (matchedTrigger) {
      response = await getRandomResponseForTrigger(matchedTrigger);
    }

    // If no response yet, check for fortune teller (mention + ?) and scheduled message (mention + remind me)

    if (message.content.startsWith(`<@${clientId}>`)) {
      if (message.content.toLowerCase().includes("remind me")) {
        const parsedReminder = parseReminderMessage({
          content: message.content,
          botId: clientId,
          message: message,
        });

        if (!parsedReminder.ok) {
          console.log("scheduler parse failure: full_message", parsedReminder);
          await message.react("❌").catch(() => null);

          await message.reply(
            "i can only understand the format '[at/in] [time/length of time] [message]' sorry justin is lazy",
          );

          return;
        } else if (parsedReminder.ok === true) {
          try {
            console.log({
              requesterUserId: message.author.id,
              chatChannelId: message.channelId,
              chatGuildId: message.guildId,
              messageBody: parsedReminder.messageContent,
              scheduledAtUtcIso: parsedReminder.scheduledAt,
            });
            const created = await createScheduledMessage({
              requesterUserId: message.author.id,
              chatChannelId: message.channelId,
              chatGuildId: message.guildId,
              messageBody: parsedReminder.messageContent,
              scheduledAtUtcIso: parsedReminder.scheduledAt,
            });
            if (!created) {
              console.log("scheduler create failure: no created row returned");
              await message.react("❌").catch(() => null);
              return;
            }
            await refreshScheduledMessagesCache();
            await message.react("✅").catch(() => null);
          } catch (err) {
            console.log("scheduler create failure:", err);
            await message.react("❌").catch(() => null);
            return;
          }
        }
      } else if (!response && message.content.endsWith("?")) {
        response = await getFortuneResponse();
      }
    }

    // if a reply was generated, send it
    if (response.length > 0) {
      message.reply(response);
    }
  }
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
