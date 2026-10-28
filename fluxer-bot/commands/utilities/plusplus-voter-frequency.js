import { getVotesById } from "../../api/plusplus.js";
import { parseUserMention, sendUsageError } from "../../utilities/commandHelpers.js";

const cmdName = "plusplus-voter-frequency";
const featureKey = "plusplus_enabled";

const data = {
  description: "The number of times a user has +/-'d something",
  usage: "plusplus-voter-frequency <@user>",
};

const execute = async (message, args) => {
  const userId = parseUserMention(args[0]);
  if (!userId) {
    await sendUsageError(message, { cmdName, data });
    return;
  }

  const totalVotes = await getVotesById(userId);
  await message.reply({
    content: `User <@${userId}> has ${totalVotes[0].total} plusplus votes`,
    allowedMentions: { users: [] },
  });
};

export { cmdName, data, execute, featureKey };
