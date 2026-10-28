import { startScheduledUpdateWizard } from "../../utilities/scheduledUpdateWizard.js";

const cmdName = "scheduled-update";

const data = {
  description: "Update a pending scheduled reminder's time and/or message, step by step over DM",
  usage: "scheduled-update",
};

const execute = async (message) => {
  await startScheduledUpdateWizard(message.author);
  if (message.guildId != null) {
    await message.reply("Check your DMs to update a reminder.");
  }
};

export { cmdName, data, execute };
