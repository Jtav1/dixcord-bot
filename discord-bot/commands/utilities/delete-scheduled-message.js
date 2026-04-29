import { SlashCommandBuilder } from "discord.js";
import { deleteScheduledMessage } from "../../api/scheduledMessages.js";
import { syncScheduledMessagesDueFromApi } from "../../jobs/scheduledMessageDelivery.js";
import {
  scheduledMessageRoutesEnabled,
  scheduledMessagesDisabledUserMessage,
} from "../../configVars.js";

// Guild slash commands: after changing command definitions, run from discord-bot:
//   node deploy-commands.js

const cmdName = "delete-scheduled-message";

const data = new SlashCommandBuilder()
  .setName("delete-scheduled-message")
  .setDescription("Delete one of your pending scheduled messages (use list for IDs)")
  .addIntegerOption((option) =>
    option
      .setName("id")
      .setDescription("Scheduled message id from /list-scheduled-messages")
      .setRequired(true)
      .setMinValue(1),
  );

/** @param {import("discord.js").ChatInputCommandInteraction} interaction */
const execute = async (interaction) => {
  if (!scheduledMessageRoutesEnabled) {
    await interaction.reply({
      ephemeral: true,
      content: scheduledMessagesDisabledUserMessage,
    });
    return;
  }

  const id = interaction.options.getInteger("id", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    const { data } = await deleteScheduledMessage(id, interaction.user.id);
    if (!data?.ok) {
      await interaction.editReply({
        content:
          data?.error ||
          "Could not delete that message (wrong id or already sent).",
      });
      return;
    }
    await interaction.editReply({
      content: `Deleted scheduled message #${id}.`,
    });
    await syncScheduledMessagesDueFromApi(interaction.client, {
      deliver: false,
    });
  } catch (e) {
    const err = /** @type {{ response?: { data?: { error?: string } } }} */ (
      e
    );
    const msg = err?.response?.data?.error || "Request failed.";
    await interaction.editReply({ content: msg });
  }
};

export { cmdName, data, execute };
