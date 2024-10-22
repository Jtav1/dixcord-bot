import { EmbedBuilder } from "discord.js";
import {
  logPinnedMessage,
  isMessageAlreadyPinned,
} from "../../../logging/dataLog.js";
import { getAllConfigurations } from "../../../middleware/configurations.js";

const configs = await getAllConfigurations();
const pinChannelId = configs.filter(
  (config_entry) => config_entry.config === "pin_channel_id"
)[0].value;

// messagePinner
// pins message if sufficent pin emoji reactions are added to it
// return: none/void
export const messagePinner = async (message, pinReaction, user, client) => {
  //check to see if the message is pinned already
  const isPinnedAlready = await isMessageAlreadyPinned(message.id);

  //if not, log that we're pinning this message
  if (!isPinnedAlready) {
    logPinnedMessage(message.id);

    const users = await pinReaction.users.fetch();
    const userArray = [];

    users.each((user) => {
      userArray.push("<@" + user.id + ">");
    });

    const pinEmbed = new EmbedBuilder()
      .setColor(0xbc0302)
      .setAuthor({
        name: message.author.displayName + " (" + message.author.username + ")",
        iconURL: message.author.displayAvatarURL(),
        url: message.url,
      })
      .setTitle("📌 Major Pin Alert")
      .setURL(message.url)
      .setDescription(message.content)
      .addFields(
        {
          name: "Channel",
          value: "<#" + message.channelId + ">",
          inline: true,
        },
        { name: "Pinned by:", value: userArray.join(", "), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "Pinned by dixbot yell at Justin if it broke" });

    //send embed message to the configured channel
    const channel = await client.channels.fetch(pinChannelId);
    await channel.send({ embeds: [pinEmbed] });

    return true;
  }

  return false;
};
