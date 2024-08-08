import { SlashCommandBuilder } from "discord.js";
//import { getTopEmoji } from "../../Logging/dataLog.js";

const data = new SlashCommandBuilder()
		.setName('top-emojis')
		.setDescription('Top 5 Most Used Emojis in Dixcord');

const execute = async (interaction) => {
        // let topAry = getTopEmoji(5);

        // console.log(topAry);

        await interaction.reply('bing bong');
    };

export const command = {
    data: data,
    execute: execute
}