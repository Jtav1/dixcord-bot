import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getUpcomingScheduledMessagesForUser } from "../../api/scheduledMessages.js";

const cmdName = "scheduled-list";

const data = new SlashCommandBuilder()
  .setName(cmdName)
  .setDescription("List your upcoming scheduled reminder messages (UTC).");

/**
 * Handle the scheduled-list slash command.
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - Interaction payload.
 * @returns {Promise<void>} Completes after replying.
 */
const execute = async (interaction) => {
  try {
    const rows = await getUpcomingScheduledMessagesForUser(interaction.user.id);
    if (!rows.length) {
      await interaction.reply({
        content: "You have no upcoming scheduled reminders.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = rows.slice(0, 25).map((row) => {
      return `#${row.id} | ${row.scheduled_at} | ${row.message_body}`;
    });
    await interaction.reply({
      content: `Upcoming scheduled reminders (UTC):\n${lines.join("\n")}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.log("scheduled-list command failed:", err);
    await interaction.reply({
      content: "Failed to list scheduled reminders.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

export { cmdName, data, execute };

