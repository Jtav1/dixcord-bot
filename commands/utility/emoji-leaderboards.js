import { SlashCommandBuilder } from "discord.js";
import { getTopEmoji } from "../../Logging/dataLog.js";

export const test = "======emoji leaderboards command test";


export let data = new SlashCommandBuilder()
		.setName('top-emojis')
		.setDescription('Top 5 Most Used Emojis in Dixcord');

export const execute = async (interaction) => {
        // let topAry = getTopEmoji(5);

        // console.log(topAry);

        await interaction.reply('bing bong');
    };
