import { MessageFlags, SlashCommandBuilder } from "discord.js";
import {
  parseTimeExpression,
  updateScheduledMessageForUser,
} from "../../api/scheduledMessages.js";

const cmdName = "scheduled-update";

const data = new SlashCommandBuilder()
  .setName(cmdName)
  .setDescription("Update your pending scheduled reminder time and/or message.")
  .addIntegerOption((option) =>
    option
      .setName("id")
      .setDescription("Scheduled reminder id")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("time")
      .setDescription('Time expression: "at <time>" or "in <amount>"')
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("New reminder message body")
      .setRequired(false),
  );

/**
 * Handle the scheduled-update slash command.
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - Interaction payload.
 * @returns {Promise<void>} Completes after update and reply.
 */
const execute = async (interaction) => {
  const id = interaction.options.getInteger("id", true);
  const timeExpression = interaction.options.getString("time");
  const messageBody = interaction.options.getString("message");

  if (!timeExpression && !messageBody) {
    await interaction.reply({
      content:
        'Provide at least one option: `time` ("at ..."/"in ...") or `message`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let scheduledAt, messageContent;

  if (timeExpression) {
    const parsedTime = await parseTimeExpression(timeExpression);
    if (!parsedTime.ok) {
      await interaction.reply({
        content: `Could not understand that time: ${parsedTime.error}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    scheduledAt = parsedTime.scheduledAt;
  }

  if (messageBody) {
    messageContent = messageBody.trim();
  }

  try {
    const updated = await updateScheduledMessageForUser({
      id,
      requesterUserId: interaction.user.id,
      messageContent: messageContent,
      scheduledAt,
    });

    if (!updated) {
      await interaction.reply({
        content:
          "Could not update that reminder. It may not exist, may already be sent, or may not belong to you.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `Updated scheduled reminder #${updated.id}. New UTC time: ${updated.scheduled_at}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.log("command: scheduled-update command failed:", err);
    await interaction.reply({
      content: "Failed to update scheduled reminder.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

export { cmdName, data, execute };
