import { getUpcomingScheduledMessagesForUser } from "../../api/scheduledMessages.js";

const cmdName = "scheduled-list";

const data = {
  description: "List your upcoming scheduled reminder messages (UTC)",
  usage: "scheduled-list",
};

const execute = async (message) => {
  try {
    const rows = await getUpcomingScheduledMessagesForUser(message.author.id);
    if (!rows.length) {
      await message.author.send("You have no upcoming scheduled reminders.").catch(() => null);
      return;
    }

    const lines = rows.slice(0, 25).map((row) => `#${row.id} | ${row.scheduled_at} | ${row.message_body}`);
    await message.author
      .send(`Upcoming scheduled reminders (UTC):\n${lines.join("\n")}`)
      .catch(() => null);
  } catch (err) {
    console.log("command: scheduled-list command failed:", err);
    await message.author.send("Failed to list scheduled reminders.").catch(() => null);
  }
};

export { cmdName, data, execute };
