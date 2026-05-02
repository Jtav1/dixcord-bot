import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { deleteScheduledMessageForUser } from "../../api/scheduledMessages.js";
import { refreshScheduledMessagesCache } from "../../scheduler/messageScheduler.js";

const cmdName = "scheduled-delete";

const data = new SlashCommandBuilder()
  .setName(cmdName)
  .setDescription("Delete one of your pending scheduled reminders by id.")
  .addIntegerOption((option) =>
    option
      .setName("id")
      .setDescription("Scheduled reminder id")
      .setRequired(true),
  );

/**
 * Handle the scheduled-delete slash command.
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - Interaction payload.
 * @returns {Promise<void>} Completes after deleting and replying.
 */
const execute = async (interaction) => {
  const id = interaction.options.getInteger("id", true);
  try {
    const ok = await deleteScheduledMessageForUser({
      id,
      requesterUserId: interaction.user.id,
    });
    if (!ok) {
      await interaction.reply({
        content:
          "Could not delete that reminder. It may not exist, may already be sent, or may not belong to you.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await refreshScheduledMessagesCache();
    await interaction.reply({
      content: `Deleted scheduled reminder #${id}.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.log("scheduled-delete command failed:", err);
    await interaction.reply({
      content: "Failed to delete scheduled reminder.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

export { cmdName, data, execute };

