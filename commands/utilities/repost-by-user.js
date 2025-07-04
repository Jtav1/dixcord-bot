import { SlashCommandBuilder } from "discord.js";
import { getRepostsForUser } from "../../database/emojis.js";
import { getAllConfigurations } from "../../database/configurations.js";

const cmdName = "reposts-by-user";

const configs = await getAllConfigurations();
const repostEmojiId = configs.filter(
  (config_entry) => config_entry.config === "repost_emoji"
)[0].value;

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
