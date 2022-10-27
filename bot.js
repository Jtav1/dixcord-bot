// Require the necessary discord.js classes
const { REST, Routes, Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, clientId } = require('./configVars.js');

const fs = require('node:fs');
const path = require('node:path');

// Create a new client instance
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
] });

//Add command handling code here
//Docs: https://discordjs.guide/creating-your-bot/command-handling.html 
//Note: LITERALLY DOES NOT FUCKING WORK

//Set up slash commands
// client.commands = new Collection();
// const commandsPath = path.join(__dirname, 'commands');
// const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// for (const file of commandFiles) {
// 	const filePath = path.join(commandsPath, file);
// 	const command = require(filePath);
// 	// Set a new item in the Collection
// 	// With the key as the command name and the value as the exported module
// 	client.commands.set(command.data.name, command);
// }

//Set up events
//https://discord.js.org/#/docs/main/main/class/Client List of Events to handle
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);

	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// client.on('interactionCreate', async interaction => {
// 	if (!interaction.isChatInputCommand()) return;

// 	const command = interaction.client.commands.get(interaction.commandName);

// 	if (!command) return;

// 	try {
// 		//dont actually have a command to run yet
// 		//await command.execute(interaction);
// 		return;
		
// 	} catch (error) {
// 		console.error(error);
// 		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
// 	}
// });

// Login to Discord with your client's token
client.login(token);
