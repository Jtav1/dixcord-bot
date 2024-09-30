import { SlashCommandBuilder } from "discord.js";

const cmdName = "dixbot";

const data = new SlashCommandBuilder()
		.setName('dixbot')
		.setDescription('Command reference');

const execute = async (interaction) => {
		await interaction.reply('I can do a few things\n \
			\tIf you post a twitter/x.com link and your message includes "dd" "dixbot" or "fix" I will reply with a better version of that link that embeds right.\n \
			\tIf you say something in the chat that includes the phrase "take a look at this" I will reply with a random rare or common pic of Commander Riker\n \
			\tIf you @ me and ask me a question ending with a question mark I will give you a magic-8-ball style response. More like magic-150-ball but whatever.\n \
			\nNote: If you spam the fuck out of this bot Justin will ban you from using it.\n\n \
			Note: This bot does log a sanitized copy of each message it reads, which will be used for future bot training. All @ usernames, user IDs, irl addresses, phone numbers, email addresses, and all configured keywords are removed from any message saved.');
			//If you have the bot-admin role you can add a keyword to the filter list with the /filteradd command.');
	};

export { cmdName, data, execute };