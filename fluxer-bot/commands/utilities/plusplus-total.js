import { getTotalScoreByString } from "../../api/plusplus.js";
import { parseUserMention, sendUsageError } from "../../utilities/commandHelpers.js";

const cmdName = "plusplus-total";
const featureKey = "plusplus_enabled";

const data = {
  description: "The ++ score of a given word or user",
  usage: "plusplus-total <word|@user>",
};

const execute = async (message, args) => {
  const arg = args.join(" ").trim();
  if (!arg) {
    await sendUsageError(message, { cmdName, data });
    return;
  }

  const userId = args.length === 1 ? parseUserMention(args[0]) : null;
  const total = userId
    ? await getTotalScoreByString(userId, "user")
    : await getTotalScoreByString(arg, "word");

  await message.reply({
    content: userId
      ? `Total score for <@${userId}> is ${total[0].total}`
      : `Total score for ${arg} is ${total[0].total}`,
    allowedMentions: { users: [] },
  });
};

export { cmdName, data, execute, featureKey };
