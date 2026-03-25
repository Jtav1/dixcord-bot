import { createScheduledMessage } from "../api/scheduledMessages.js";
import { syncScheduledMessagesDueFromApi } from "../jobs/scheduledMessageDelivery.js";
import { parseRemindBody } from "./scheduleParse.js";

/** message.id -> first-claim timestamp; prevents duplicate schedules for duplicate MESSAGE_CREATE. */
const remindScheduleDedupe = new Map();
const REMIND_DEDUPE_TTL_MS = 86_400_000;

/**
 * @param {string} messageId
 * @returns {boolean} true if this invocation may POST schedule (first claim)
 */
function claimRemindScheduleForMessage(messageId) {
  const now = Date.now();
  for (const [id, t] of remindScheduleDedupe) {
    if (now - t > REMIND_DEDUPE_TTL_MS) remindScheduleDedupe.delete(id);
  }
  if (remindScheduleDedupe.has(messageId)) return false;
  remindScheduleDedupe.set(messageId, now);
  return true;
}

/**
 * @param {string} messageId
 */
function releaseRemindScheduleClaim(messageId) {
  remindScheduleDedupe.delete(messageId);
}

/**
 * If the message mentions the bot and starts with "remind me", schedule a reminder.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} true if this handler consumed the message (caller should skip other replies)
 */
export async function handleRemindMeIfApplicable(message) {
  if (message.author.bot) return false;
  if (!message.guild || !message.channel?.isTextBased()) return false;

  const botId = message.client.user.id;
  if (!message.mentions.has(botId)) return false;

  const rest = message.content
    .replace(new RegExp(`^<@!?${botId}>\\s*`), "")
    .trim();
  if (!/^remind me\b/i.test(rest)) return false;

  const afterRemind = rest.replace(/^remind me\b/i, "").trim();
  const parsed = parseRemindBody(afterRemind);

  if ("error" in parsed) {
    await message.reply(parsed.error);
    return true;
  }

  if (!claimRemindScheduleForMessage(message.id)) {
    return true;
  }

  try {
    const { data } = await createScheduledMessage({
      discord_user_id: message.author.id,
      discord_channel_id: message.channel.id,
      discord_guild_id: message.guild.id,
      message_body: " reminder: " + parsed.remainderText,
      scheduled_at: parsed.scheduledAt,
    });

    if (!data?.ok) {
      releaseRemindScheduleClaim(message.id);
      await message.reply(data?.error || "Could not schedule that reminder.");
      return true;
    }

    const at = new Date(data.scheduled_at ?? parsed.scheduledAt).toISOString();
    await message.reply(
      `Reminder scheduled (#${data.id}) for <t:${Math.floor(new Date(at).getTime() / 1000)}:F> (UTC).`,
    );
    await syncScheduledMessagesDueFromApi(message.client);
    return true;
  } catch (e) {
    releaseRemindScheduleClaim(message.id);
    const err = /** @type {{ response?: { data?: { error?: string } } }} */ (e);
    const msg = err?.response?.data?.error || "Request failed.";
    await message.reply(msg);
    return true;
  }
}
