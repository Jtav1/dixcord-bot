import dataLog from '../../../logging/dataLog.js';
import { EmbedBuilder } from "discord.js";


const pinChannelId = '915462110761349201'; //TODO move this to config table in db

// messagePinner 
// pins message if sufficent pin emoji reactions are added to it
// return: none/void
const messagePinner = async (message, pinReaction, user, client) => {
    //check to see if the message is pinned already
    const isPinnedAlready = await dataLog.isMessageAlreadyPinned(message.id);

    //if not, log that we're pinning this message
    if(!isPinnedAlready){
        dataLog.logPinnedMessage(message.id);

        const users = await pinReaction.users.fetch();
        const userArray = [];

        users.each((user) => {
            userArray.push('<@' + user.id + '>');
        })

        const pinEmbed = new EmbedBuilder()
            .setColor(0xBC0302)
            .setTitle('📌 Major Pin Alert')
            .setURL(message.url)
            .setDescription(message.content)
            .addFields(
                { name: 'Channel', value: '<#' + message.channelId + '>', inline: true },
                { name: 'Pinned by:', value: userArray.join(', '), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Pinned by dixbot yell at Justin if it broke'});

        //send embed message to the configured channel
        const channel = await client.channels.fetch(pinChannelId);
        await channel.send({ embeds: [pinEmbed] });

        return true;
    }
    
    return false;
}

export default messagePinner;