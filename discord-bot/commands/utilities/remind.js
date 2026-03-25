import { SlashCommandBuilder } from "discord.js";
import { createScheduledMessage } from "../../api/scheduledMessages.js";
import { syncScheduledMessagesDueFromApi } from "../../jobs/scheduledMessageDelivery.js";
import { parseWhen } from "../../utils/scheduleParse.js";

// Guild slash commands: after changing command definitions, run from discord-bot:
//   node deploy-commands.js

const cmdName = "remind";

const data = new SlashCommandBuilder()
  .setName("remind")
  .setDescription("Set a reminder in this channel (same as @bot remind me …)")
  .addStringOption((option) =>
    option
      .setName("when")
      .setDescription(
        'When to remind you (e.g. "in 15 minutes", ISO, MM-DD-YYYY HH:mm UTC)',
      )
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("What you want to be reminded about")
      .setRequired(true),
  );

/** @param {import("discord.js").ChatInputCommandInteraction} interaction */
const execute = async (interaction) => {
  if (!interaction.guild || !interaction.channel?.isTextBased()) {
    await interaction.reply({
      ephemeral: true,
      content: "Use this command in a server text channel.",
    });
    return;
  }

  const whenRaw = interaction.options.getString("when", true).trim();
  const reminderText = interaction.options.getString("message", true).trim();

  const parsed = parseWhen(whenRaw);
  if ("error" in parsed) {
    await interaction.reply({ ephemeral: true, content: parsed.error });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const { data } = await createScheduledMessage({
      discord_user_id: interaction.user.id,
      discord_channel_id: interaction.channel.id,
      discord_guild_id: interaction.guild.id,
      message_body: " reminder: " + reminderText,
      scheduled_at: parsed.scheduledAt,
    });

    if (!data?.ok) {
      await interaction.editReply({
        content: data?.error || "Could not schedule that reminder.",
      });
      return;
    }

    const at = new Date(data.scheduled_at ?? parsed.scheduledAt).toISOString();
    await interaction.editReply({
      content: `Reminder scheduled (#${data.id}) for <t:${Math.floor(new Date(at).getTime() / 1000)}:F> (UTC).`,
    });
    await syncScheduledMessagesDueFromApi(interaction.client);
  } catch (e) {
    const err = /** @type {{ response?: { data?: { error?: string } } }} */ (
      e
    );
    const msg = err?.response?.data?.error || "Request failed.";
    await interaction.editReply({ content: msg });
  }
};

export { cmdName, data, execute };
