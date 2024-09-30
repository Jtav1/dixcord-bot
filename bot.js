// Require the necessary discord.js classes
import { REST, Routes, Client, Collection, Events, GatewayIntentBits, Partials } from 'discord.js';
import { token, clientId, guildId } from './configVars.js';

import fs from 'node:fs';
import path from 'node:path';

import dataLog from './logging/dataLog.js';

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions,
	],
	partials: [
		Partials.Message,
		Partials.Channel,
		Partials.Reaction
	],
});

const commands = [];

//Set up slash commands
//Docs: https://discordjs.guide/creating-your-bot/command-handling.html

// const commands = [];
// const foldersPath = path.join(process.cwd(), 'commands');
// const commandFolders = fs.readdirSync(foldersPath);

// for (const folder of commandFolders) {
// 	const commandsPath = path.join(foldersPath, folder);
// 	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
// 	for (const file of commandFiles) {
// 		const filePath = path.join(commandsPath, file);
// 		const command = await import(filePath);
// 		if ('data' in command && 'execute' in command) {
// 			commands.push(command.data.toJSON());
// 		} else {
// 			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
// 		}
// 	}
// }

//Set up events
//https://discord.js.org/#/docs/main/main/class/Client List of Events to handle

const eventsPath = path.join(import.meta.dirname, 'events');
const eventCategories = fs.readdirSync(eventsPath);

//for each folder (category) under events, get all js files
for (const category of eventCategories) {
	const eventCategoryPath = path.join(eventsPath, category);

	for (const file of fs.readdirSync(eventCategoryPath).filter(file => file.endsWith('.js'))) {

		const { event } = await import(path.join(eventCategoryPath, file));

		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args));
		} else {
			client.on(event.name, (...args) => event.execute(...args));
		}
	}
}


//Set up commands
const commandsPath = path.join(import.meta.dirname, 'commands');
const commandsCategories = fs.readdirSync(commandsPath);

//for each folder (category) under events, get all js files
for (const category of commandsCategories) {
	const commandCategoryPath = path.join(commandsPath, category);

	for (const file of fs.readdirSync(commandCategoryPath).filter(file => file.endsWith('.js'))) {

		const command = await import(path.join(commandCategoryPath, file));

		if ('cmdName' in command && 'data' in command && 'execute' in command) {
			commands.push(command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "cmdName" or "data" or "execute" property.`);
		}
	}
}

// Respond to commands
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isCommand()) return;

	let runCommand = commands.find((cmd) => cmd.cmdName === interaction.commandName);
	try {
		await(runCommand.execute(interaction));
	} catch (e) {
		console.log("command execution error");
	}
	
});


client.once(Events.ClientReady, readyClient => {

	console.log("Initializing emoji set");

	client.guilds.fetch(guildId)
		.then(guild => {
			guild.emojis.fetch()
				.then((result) => {
					dataLog.initializeEmojisList(result.map((r) =>
					({
						id: r.id,
						name: r.name,
						animated: r.animated,
						type: "emoji"
					})
					));
				})
				.catch(console.error)
		})
		.catch(console.error)

	console.log(`Ready! Logged in as ${readyClient.user.tag}`);

});

// https://stackoverflow.com/questions/66793543/reaction-event-discord-js
client.on('messageReactionAdd', async (reaction, user) => {

	let reactStr = "<:" + reaction._emoji.name + ":" + reaction._emoji.id + ">";
	dataLog.countEmoji(reactStr);

});

// Login to Discord with your client's token
client.login(token);

