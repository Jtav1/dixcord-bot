import { SlashCommandBuilder } from "discord.js";
import { getRepostsForUser } from "../../middleware/emojis.js";

const cmdName = "reposts-by-user";
const repostEmojiId = "1072368151922233404"; // use db for this somehow

const data = new SlashCommandBuilder()
  .setName("reposts-by-user")
  .setDescription("Number of reposts for the given user")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user you want to query for")
      .setRequired(true)
  );

const execute = async (interaction) => {
  const user = interaction.options.getUser("user");

  const repostCount = await getRepostsForUser(user.id);
  await interaction.reply({
    content: `User <@${user.id}> has ${repostCount} reposts`,
    allowedMentions: {
      users: [],
    },
  });
};

export { cmdName, data, execute };
