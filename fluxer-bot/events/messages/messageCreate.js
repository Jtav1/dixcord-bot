import { Events } from "@fluxerjs/core";

import { commands } from "../../commandRegistry.js";
import { commandPrefix, guildId } from "../../configVars.js";
import { client } from "../../fluxerClient.js";

import { getLinkFixerResponse, getFortuneResponse } from "../../api/responses.js";
import { getRandomResponseForTrigger } from "../../api/triggerResponses.js";
import { executeResponseFunction } from "../../utilities/triggerResponseFunctions.js";
import { handleReminderRequest } from "../../utilities/reminderRequest.js";
import { buildCommandListEmbed } from "../../commands/utilities/dixbot.js";
import {
  getCachedLinkHosts,
  getCachedTriggers,
  refreshContentCaches,
} from "../../api/cacheRefresh.js";

import { emojiDetector } from "./utilities/emojiDetector.js";
import { stickerDetector } from "./utilities/stickerDetector.js";
import { plusMinusMsg } from "./utilities/plusplus.js";
import { announceMilestones } from "../../utilities/milestoneNotifier.js";
import {
  isLinkFixerEnabled,
  isTriggerResponsesEnabled,
  isRemindersEnabled,
  isEightBallEnabled,
  isStickerTrackingEnabled,
  isPlusPlusEnabled,
  isFeatureEnabled,
} from "../../configStore.js";
import { incrementCounter } from "../../utilities/metrics.js";
import {
  hasActiveSession,
  handleWizardReply,
} from "../../utilities/scheduledUpdateWizard.js";

const name = Events.MessageCreate;

/**
 * Parse and run a prefix command. Returns false if the message isn't a recognized command
 * invocation (caller falls through to its own handling); true if it was handled here.
 * @param {import('@fluxerjs/core').Message} message
 * @returns {Promise<boolean>}
 */
async function dispatchCommand(message) {
  if (!message.content.startsWith(commandPrefix)) return false;

  const [cmdName, ...args] = message.content
    .slice(commandPrefix.length)
    .trim()
    .split(/\s+/);
  const command = commands.find((cmd) => cmd.cmdName === cmdName);
  if (!command) return false;

  if (command.featureKey && !isFeatureEnabled(command.featureKey)) {
    await message.author.send("This feature is currently disabled.").catch(() => null);
    return true;
  }

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(`bot: command "${cmdName}" error:`, err);
  }
  return true;
}

/**
 * Dispatch prefix commands (fluxer.js has no slash commands), then run the message-handling
 * feature pipeline (link fixing, triggers, 8-ball, emoji/sticker tracking, plus/minus, reminders)
 * for everything else — mirrors discord-bot's events/messages/messageCreate.js.
 * @param {import('@fluxerjs/core').Message} message
 */
const execute = async (message) => {
  if (message.author.bot) return;

  // DMs carry no guildId. Commands work here too, except while the user is already mid a
  // prompt-response chain (e.g. the !scheduled-update wizard) — then every DM reply routes
  // there instead, until it ends or the user sends "exit".
  if (message.guildId == null) {
    if (hasActiveSession(message.author.id)) {
      await handleWizardReply(message);
    } else {
      await dispatchCommand(message);
    }
    return;
  }

  if (message.guildId !== guildId) return;

  if (await dispatchCommand(message)) return;

  // Exact "@bot help" only — no other phrasing/punctuation. Checked ahead of the rest of the
  // pipeline so nothing else (triggers, link-fixer) can shadow it.
  if (message.content.trim() === `<@${client.user?.id}> help`) {
    await message.reply({ embeds: [buildCommandListEmbed()] });
    return;
  }

  let response = "";

  incrementCounter("messagesProcessedTotal");
  await emojiDetector(message);
  if (isStickerTrackingEnabled()) await stickerDetector(message);
  if (isPlusPlusEnabled()) {
    const plusMinusMilestones = await plusMinusMsg(message);
    await announceMilestones(message, plusMinusMilestones);
  }

  const contentStripped = message.content
    .toLowerCase()
    .replace(/[^a-zA-Z0-9!]/g, "");

  if (isLinkFixerEnabled()) {
    let linkHosts = getCachedLinkHosts();
    if (linkHosts === null) {
      await refreshContentCaches();
      linkHosts = getCachedLinkHosts() ?? [];
    }
    const twitCheck = message.content.split(" ").filter((word) => {
      const tmpWord = word.replace(/[<>]/g, "").toLowerCase();
      return linkHosts.some((host) => tmpWord.includes(host.toLowerCase()));
    });

    if (twitCheck.length > 0) {
      const twitFixReply = await getLinkFixerResponse(message.content ?? "");
      if (twitFixReply.length > 0) {
        response = twitFixReply;
        incrementCounter("linkFixerTriggeredTotal");
      }
    }
  }

  if (isTriggerResponsesEnabled()) {
    let triggers = getCachedTriggers();
    if (triggers === null) {
      await refreshContentCaches();
      triggers = getCachedTriggers() ?? [];
    }
    const matchedTrigger = triggers.find((t) =>
      contentStripped.includes(t.trigger_string),
    );
    if (matchedTrigger) {
      incrementCounter("triggerResponsesMatchedTotal");
      const {
        response: triggerResponse,
        response_function,
        response_function_parameters,
        milestones: triggerMilestones,
      } = await getRandomResponseForTrigger(matchedTrigger, message.author.id);
      if (triggerResponse.length > 0) {
        if (response_function) {
          await executeResponseFunction(response_function, {
            message,
            client,
            responseText: triggerResponse,
            parameters: response_function_parameters,
          });
        } else {
          await message.reply(triggerResponse);
        }
        await announceMilestones(message, triggerMilestones);
        // NOTE: deliberately clobbers a pending link-fixer reply above (same quirk as
        // discord-bot) — a message matching both a link-fixer host and a trigger phrase only
        // ever gets the trigger reply. Preserved for parity, not a bug to "fix" here.
        response = "";
      } else {
        response = triggerResponse;
      }
    }
  }

  if (message.content.startsWith(`<@${client.user?.id}>`)) {
    if (isRemindersEnabled() && message.content.toLowerCase().includes("remind me")) {
      const mentionRegex = new RegExp(`^<@${client.user?.id}>\\s+`, "i");
      const reminderText = message.content.replace(mentionRegex, "").trim();
      await handleReminderRequest(message, reminderText);
    } else if (
      isEightBallEnabled() &&
      !response &&
      message.content.endsWith("?")
    ) {
      response = await getFortuneResponse();
      incrementCounter("eightBallResponsesTotal");
    }
  }

  if (response.length > 0) {
    await message.reply(response);
  }
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
