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
	],});

//Set up slash commands
//Docs: https://discordjs.guide/creating-your-bot/command-handling.html

client.commands = new Collection();

//set commands direcotry and get folders inside
const commandsPath = path.join(import.meta.dirname, 'commands');
const commandCategories = fs.readdirSync(commandsPath);

//for each folder (category) under commands, get all js files
for (const category of commandCategories) {
	const categoryPath = path.join(commandsPath, category);
	for (const file of fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'))){

		const { command } = await import(path.join(categoryPath, file));
		
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

//Set up events
//https://discord.js.org/#/docs/main/main/class/Client List of Events to handle

const eventsPath = path.join(import.meta.dirname, 'events');
const eventCategories = fs.readdirSync(eventsPath);

//for each folder (category) under commands, get all js files
for (const category of eventCategories) {
	const categoryPath = path.join(eventsPath, category);

	for (const file of fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'))){

		const { event } = await import(path.join(categoryPath, file));

		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args));
		} else {
			client.on(event.name, (...args) => event.execute(...args));
		}
	}
}

// Register commands
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
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

