import { getRepostsForUser } from "../../api/emojis.js";
import { parseUserMention, sendUsageError } from "../../utilities/commandHelpers.js";

const cmdName = "reposts-by-user";
const featureKey = "repost_detection_enabled";

const data = {
  description: "Number of reposts for the given user",
  usage: "reposts-by-user <@user>",
};

const execute = async (message, args) => {
  const userId = parseUserMention(args[0]);
  if (!userId) {
    await sendUsageError(message, { cmdName, data });
    return;
  }

  const repostCount = await getRepostsForUser(userId);
  await message.reply({
    content: `User <@${userId}> has ${repostCount} reposts`,
    allowedMentions: { users: [] },
  });
};

export { cmdName, data, execute, featureKey };
