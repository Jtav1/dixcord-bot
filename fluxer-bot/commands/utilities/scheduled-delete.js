import { deleteScheduledMessageForUser } from "../../api/scheduledMessages.js";
import { sendUsageError } from "../../utilities/commandHelpers.js";

const cmdName = "scheduled-delete";

const data = {
  description: "Delete one of your pending scheduled reminders by id",
  usage: "scheduled-delete <id>",
};

const execute = async (message, args) => {
  const id = Number(args[0]);
  if (!args[0] || !Number.isInteger(id)) {
    await sendUsageError(message, { cmdName, data });
    return;
  }

  try {
    const ok = await deleteScheduledMessageForUser({ id, requesterUserId: message.author.id });
    if (!ok) {
      await message.author
        .send(
          "Could not delete that reminder. It may not exist, may already be sent, or may not belong to you.",
        )
        .catch(() => null);
      return;
    }
    await message.author.send(`Deleted scheduled reminder #${id}.`).catch(() => null);
  } catch (err) {
    console.log("command: scheduled-delete command failed:", err);
    await message.author.send("Failed to delete scheduled reminder.").catch(() => null);
  }
};

export { cmdName, data, execute };
