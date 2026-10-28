import { MessageType } from "@fluxerjs/core";

import { createScheduledMessage, parseReminderText } from "../api/scheduledMessages.js";
import { instanceUrl } from "../configVars.js";
import { incrementCounter } from "./metrics.js";

/**
 * Parse free-text reminder input and schedule it, reacting ✅/❌ on the triggering message.
 * Shared by the "@bot remind me ..." mention trigger and the !remind-me command — both just
 * strip their own prefix down to the same reminderText and hand it here.
 * @param {import('@fluxerjs/core').Message} message
 * @param {string} reminderText
 */
export async function handleReminderRequest(message, reminderText) {
  const isReply = message.type === MessageType.Reply;

  const parsedReminder = await parseReminderText({ text: reminderText, isReply });

  if (!parsedReminder.ok) {
    incrementCounter("reminderParseFailuresTotal");
    console.log("bot: scheduler parse failure:", parsedReminder.error);
    await message.react("❌").catch(() => null);
    await message.reply(
      "i can only understand the format '[at/in] [time/length of time] remind me [message]' OR NOW ALSO 'remind me [at/in] [time/length of time] [message]'",
    );
    return;
  }

  // Reply-with-no-explicit-time reminders don't carry their own body text (see webapi's
  // parse-reminder route) - build a mention + link to the replied message instead. No
  // confirmed Fluxer message-permalink format exists yet; this guesses at a Discord-style
  // URL against the configured instance - verify against a real Fluxer instance.
  const messageBody = parsedReminder.usesReplyContext
    ? `<@${message.author.id}> reminder: ${instanceUrl ?? ""}/channels/${message.messageReference?.guildId}/${message.messageReference?.channelId}/${message.messageReference?.messageId}`
    : parsedReminder.messageContent;

  try {
    const created = await createScheduledMessage({
      requesterUserId: message.author.id,
      chatChannelId: message.channelId,
      chatGuildId: message.guildId,
      messageBody,
      scheduledAtUtcIso: parsedReminder.scheduledAt,
    });
    if (!created) {
      console.log("bot: scheduler create failure: no created row returned");
      await message.react("❌").catch(() => null);
      return;
    }
    await message.react("✅").catch(() => null);
    incrementCounter("remindersCreatedTotal");
  } catch (err) {
    console.log("bot: scheduler create failure:", err);
    await message.react("❌").catch(() => null);
  }
}
