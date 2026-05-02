import { MessageFlags, SlashCommandBuilder } from "discord.js";
import * as api from "../../api/client.js";
import { sendPinAlert } from "../../events/messages/utilities/messagePinner.js";

/** Discord role IDs allowed to use this command (fill with real IDs). */
const ALLOWED_ROLE_IDS = ["612842488302141441"];

// Guild slash commands: after changing command definitions, run from discord-bot:
//   node deploy-commands.js

const cmdName = "pin-message";

const data = new SlashCommandBuilder()
  .setName("pin-message")
  .setDescription(
    "Send the pin alert for a message in this channel (by message ID)",
  )
  .addStringOption((option) =>
    option
      .setName("message_id")
      .setDescription("Snowflake ID of a message in this channel")
      .setRequired(true),
  );

/** @param {import("discord.js").ChatInputCommandInteraction} interaction */
const execute = async (interaction) => {
  if (!interaction.guild || !interaction.channel?.isTextBased()) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command in a server text channel.",
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!ALLOWED_ROLE_IDS.some((id) => member.roles.cache.has(id))) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You don't have permission to use this command.",
    });
    return;
  }

  const messageId = interaction.options.getString("message_id", true).trim();
  if (!/^\d{17,20}$/.test(messageId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That doesn't look like a valid Discord message ID.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let targetMessage;
  try {
    targetMessage = await interaction.channel.messages.fetch(messageId);
  } catch (e) {
    const code = /** @type {{ code?: number }} */ (e).code;
    if (code === 10008) {
      await interaction.editReply({
        content:
          "No message with that ID in this channel. Run the command in the channel where the message was sent.",
      });
      return;
    }
    throw e;
  }

  const sent = await sendPinAlert(targetMessage, interaction.client, [
    "<@" + interaction.user.id + ">",
  ]);

  if (sent) {
    const quip = await getRandomPinQuip();
    await targetMessage.reply(quip);
    await interaction.editReply({
      content: "Pin alert sent for that message.",
    });
  } else {
    await interaction.editReply({
      content: "That message was already logged as pinned; nothing to do.",
    });
  }
};

async function getRandomPinQuip() {
  try {
    const { data } = await api.get("/api/pin-quips/random");
    if (data?.ok && data?.quip) return data.quip;
  } catch (_) {}
  return "PINNED";
}

export { cmdName, data, execute };
