import * as chrono from "chrono-node";
import { MessageType } from "discord.js";

/**
 * Parse scheduler intent from a bot-mention chat message.
 * Accepted formats (after mention):
 * - [at <time> / in <amount>] remind me <message>
 * - remind me <message> [at <time> / in <amount>]
 * @param {{ content: string, botId: string, message: discordjs message object }} payload - Parse payload.
 * @returns {{ ok: true, scheduledAt: string, reminderMessage: string, parsedTimeInput: string } | { ok: false, error: string, parsedTimeInput: string|null, reminderMessage: string|null }} Parse result.
 */
export function parseReminderMessage(payload) {
  const content = String(payload?.content ?? "");
  const botId = String(payload?.botId ?? "").trim();

  if (!content || !botId) {
    return {
      ok: false,
      error: "Missing content or bot id",
      parsedTimeInput: null,
      reminderMessage: null,
    };
  }

  const mentionRegex = new RegExp(`^<@!?${botId}>\\s+`, "i");
  const afterMention = content.replace(mentionRegex, "").trim();

  const remindMeIdx = afterMention.toLowerCase().indexOf("remind me"); // where "remind me" is in the string
  let messageTime,
    messageIdx,
    messageContent = "";

  if (
    afterMention.toLowerCase().startsWith("at") ||
    afterMention.toLowerCase().startsWith("in")
  ) {
    if (remindMeIdx < 0) {
      return {
        ok: false,
      };
    }

    messageTime = chrono.parseDate(
      afterMention.trim().substring(0, remindMeIdx),
      Date.now(),
      { forwardDate: true },
    );

    messageIdx = afterMention.toLowerCase().indexOf("remind me") + 10;
    messageContent = afterMention
      .substring(messageIdx, afterMention.length)
      .trim();

    return {
      ok: true,
      scheduledAt: messageTime,
      messageContent: messageContent,
    };
  } else if (afterMention.toLowerCase().trim().startsWith("remind me")) {
    const postRemindMe = afterMention
      .substring(afterMention.toLowerCase().indexOf("remind me") + 10)
      .trim();

    if (
      postRemindMe.toLowerCase().startsWith("at") ||
      postRemindMe.toLowerCase().startsWith("in")
    ) {
      const parseResult = chrono.parse(postRemindMe, Date.now(), {
        forwardDate: true,
      });

      if (!parseResult?.length) {
        return {
          ok: false,
        };
      }

      const firstResult = parseResult[0];
      messageTime = firstResult.start.date();
      messageIdx = firstResult.index + firstResult.text.length;
      messageContent = postRemindMe
        .substring(messageIdx, postRemindMe.length)
        .trim();

      if (!messageContent) {
        return {
          ok: false,
        };
      }

      // STrip leading "to"
      if (messageContent.toLowerCase().startsWith("to")) {
        messageContent = messageContent.substring(3).trim();
      }

      return {
        ok: true,
        scheduledAt: messageTime,
        messageContent: messageContent,
      };
    }

    if (payload.message.type === MessageType.Reply) {
      messageTime = chrono.parseDate(postRemindMe);

      const repliedMessageLink = `https://discord.com/channels/${payload.message.reference.guildId}/${payload.message.reference.channelId}/${payload.message.reference.messageId}`;

      return {
        ok: true,
        scheduledAt: messageTime,
        messageContent:
          `<@${payload.message.author.id}> reminder: ` + repliedMessageLink,
      };
    }
  }

  return {
    ok: false,
  };
}
