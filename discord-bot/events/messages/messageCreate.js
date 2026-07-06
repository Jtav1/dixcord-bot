import { clientId } from "../../configVars.js";

import {
  getLinkFixerResponse,
  getFortuneResponse,
} from "../../api/responses.js";
import { getRandomResponseForTrigger } from "../../api/triggerResponses.js";
import { createScheduledMessage } from "../../api/scheduledMessages.js";
import { refreshScheduledMessagesCache } from "../../scheduler/messageScheduler.js";
import { parseReminderMessage } from "./utilities/scheduleParser.js";
import {
  getCachedLinkHosts,
  getCachedTriggers,
  refreshContentCaches,
} from "../../api/cacheRefresh.js";

import { emojiDetector } from "./utilities/emojiDetector.js";
import { plusMinusMsg } from "./utilities/plusplus.js";

const name = "messageCreate";

const execute = async (message) => {
  let response = "";

  if (!message.author.bot && !(message.author.id === clientId)) {
    await emojiDetector(message);
    await plusMinusMsg(message);

    const contentStripped = message.content
      .toLowerCase()
      .replace(/[^a-zA-Z0-9!]/g, "");

    let linkHosts = getCachedLinkHosts();
    if (linkHosts === null) {
      await refreshContentCaches();
      linkHosts = getCachedLinkHosts() ?? [];
    }
    const twitCheck = message.content.split(" ").filter((word) => {
      const tmpWord = word.replace(/[<>]/g, "");
      return linkHosts.some((host) => tmpWord.includes(host));
    });

    if (twitCheck.length > 0) {
      const twitFixReply = await getLinkFixerResponse(message.content ?? "");
      if (twitFixReply.length > 0) {
        response = twitFixReply;
      }
    }

    let triggers = getCachedTriggers();
    if (triggers === null) {
      await refreshContentCaches();
      triggers = getCachedTriggers() ?? [];
    }
    const matchedTrigger = triggers.find((t) =>
      contentStripped.includes(t.trigger_string),
    );
    if (matchedTrigger) {
      response = await getRandomResponseForTrigger(matchedTrigger);
    }

    if (message.content.startsWith(`<@${clientId}>`)) {
      if (message.content.toLowerCase().includes("remind me")) {
        const parsedReminder = parseReminderMessage({
          content: message.content,
          botId: clientId,
          message: message,
        });

        if (!parsedReminder.ok) {
          console.log(
            "bot: scheduler parse failure: full_message",
            parsedReminder,
          );
          await message.react("❌").catch(() => null);

          await message.reply(
            "i can only understand the format '[at/in] [time/length of time] remind me [message]' OR NOW ALSO 'remind me [at/in] [time/length of time] [message]'",
          );

          return;
        } else if (parsedReminder.ok === true) {
          try {
            const created = await createScheduledMessage({
              requesterUserId: message.author.id,
              chatChannelId: message.channelId,
              chatGuildId: message.guildId,
              messageBody: parsedReminder.messageContent,
              scheduledAtUtcIso: parsedReminder.scheduledAt,
            });
            if (!created) {
              console.log(
                "bot: scheduler create failure: no created row returned",
              );
              await message.react("❌").catch(() => null);
              return;
            }
            await refreshScheduledMessagesCache();
            await message.react("✅").catch(() => null);
          } catch (err) {
            console.log("bot: scheduler create failure:", err);
            await message.react("❌").catch(() => null);
            return;
          }
        }
      } else if (!response && message.content.endsWith("?")) {
        response = await getFortuneResponse();
      }
    }

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
