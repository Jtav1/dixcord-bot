import { SlashCommandBuilder } from "discord.js";
import { listScheduledMessages } from "../../api/scheduledMessages.js";
import {
  scheduledMessageRoutesEnabled,
  scheduledMessagesDisabledUserMessage,
} from "../../configVars.js";

// Guild slash commands: after changing command definitions, run from discord-bot:
//   node deploy-commands.js

const cmdName = "list-scheduled-messages";

const data = new SlashCommandBuilder()
  .setName("list-scheduled-messages")
  .setDescription("List your unsent scheduled messages");

/** @param {import("discord.js").ChatInputCommandInteraction} interaction */
const execute = async (interaction) => {
  if (!scheduledMessageRoutesEnabled) {
    await interaction.reply({
      ephemeral: true,
      content: scheduledMessagesDisabledUserMessage,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const { data } = await listScheduledMessages(interaction.user.id, "pending");
    if (!data?.ok) {
      await interaction.editReply({
        content: data?.error || "Could not load scheduled messages.",
      });
      return;
    }

    const messages = Array.isArray(data.messages) ? data.messages : [];
    if (messages.length === 0) {
      await interaction.editReply({
        content: "You have no pending scheduled messages.",
      });
      return;
    }

    const lines = messages.map((row) => {
      const id = row.id;
      const raw = row.scheduled_at;
      const d = raw
        ? new Date(
            String(raw).includes("T")
              ? String(raw)
              : `${String(raw).replace(" ", "T")}Z`,
          )
        : null;
      const ts =
        d && !Number.isNaN(d.getTime())
          ? `<t:${Math.floor(d.getTime() / 1000)}:F>`
          : "?";
      const full = String(row.message_body ?? "").replace(/\s+/g, " ");
      const preview = full.slice(0, 80);
      const ell = full.length > 80 ? "…" : "";
      return `**#${id}** · ${ts}\n${preview}${ell}`;
    });

    const text = lines.join("\n\n");
    const content =
      text.length > 3500 ? `${text.slice(0, 3490)}…` : text;
    await interaction.editReply({
      content: `Pending scheduled messages:\n\n${content}`,
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
