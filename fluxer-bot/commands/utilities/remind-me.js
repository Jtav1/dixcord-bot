import { handleReminderRequest } from "../../utilities/reminderRequest.js";
import { sendUsageError } from "../../utilities/commandHelpers.js";

const cmdName = "remind-me";
const featureKey = "reminders_enabled";

const data = {
  description: "Schedule a reminder — alias for '@bot remind me ...'",
  usage: "remind-me [at/in <time>] <message>",
};

const execute = async (message, args) => {
  const rest = args.join(" ").trim();
  if (!rest) {
    await sendUsageError(message, { cmdName, data });
    return;
  }
  // Invoking the command already signals intent — the "remind me" grammar word is webapi's
  // parser requirement, not something the caller should have to type.
  await handleReminderRequest(message, `remind me ${rest}`);
};

export { cmdName, data, execute, featureKey };
