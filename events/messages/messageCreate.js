import { clientId, defaultArray, rareArray, rareFrequency, positiveArray, negativeArray, neutralArray, twitterFixEnabled } from '../../configVars.js';
import dataLog from '../../logging/dataLog.js';

// var Sentiment = require('sentiment');
// var sentiment = new Sentiment();

const name = 'messageCreate';

let limit = 0;
let lastReplyTimestamp = null;
let ms = (Math.random() * 60000) + 60000; // CUTTING EDGE AI ANTI EXPLOIT TECHNOLOGY
// let ms = 10000;

let configuredLimit = 2;

let once = false;

//******* RESPONSE FUNCTIONS *******//

// takeALook()
//	selects an image and sends a reply containing the link
//	return: response (string)
const takeALook = () => {
	let nowTime = Date.now();

	if (lastReplyTimestamp == null || Math.floor((nowTime - lastReplyTimestamp)) >= ms) {
		timestamp = null
		limit = 0;
	}

	if (limit < configuredLimit) {
		//continue to response
	} else if (limit == (configuredLimit)) {

		lastReplyTimestamp = Date.now();
		limit++;

		return "No spam!"; // https://i.imgur.com/kAClxb0.png = spam picture url lol
	}

	let imgLink = "";

	//New calculation
	let diceRoll = Math.random();

	if (diceRoll <= rareFrequency) {
		imgLink = rareArray[rareArray.length * Math.random() | 0]
	} else {
		imgLink = defaultArray[defaultArray.length * Math.random() | 0]
	}

	limit++;
	lastReplyTimestamp = Date.now();

	return imgLink;
}

// fortuneTeller()
//	Randomly sends a fortune
//  return: response (string)
const fortuneTeller = (rawMessage) => {
	const processedMessage = rawMessage.replace("<@" + clientId + ">", "")

	//var result = sentiment.analyze(processedMessage);

	const combinedResponses = positiveArray.concat(negativeArray, neutralArray);


	console.log(combinedResponses.length);
	return (combinedResponses[Math.floor(Math.random() * combinedResponses.length)]);
}

// twitterFixer(str)
//  reply with a vx twitter link if a non-vx twitter link is posted
//	note: will use the last link in the message
//  return: response (string)
const twitterFixer = (messageContents) => {
	
	const msgAry = messageContents.split(' ');
	let reply = '';

	msgAry.forEach(word => {

		let cleanWord = word.replace(/[<>]/g, '');

		if(cleanWord.startsWith('https://x.com')){
			if(messageContents.includes('dd') ||
				messageContents.includes('dixbot') ||
				messageContents.includes('fix')){

				reply = ("fixed link: " + cleanWord.replace('https://x.com/', 'https://vxtwitter.com/'));
			}
		}

	});

	return reply;
}

// emojiDetector 
//  logs instances of each emojis in the message
//  return: none/void
const emojiDetector = (rawMessage) => {
	const EMOJIREGEX = /((?<!\\)<:[^:]+:(\d+)>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu;
	const emojiDetector = (str) => str.match(EMOJIREGEX);

	let emoAry = emojiDetector(rawMessage.content) || [];

	emoAry.forEach(emo => {
		if (emo.length > 0) dataLog.countEmoji(emo);
	});
}

const execute = (message) => {

	//******* INCOMING MESSAGE PROCESSING *******//

	let response = "";

	if (!message.author.bot && !(message.author.id === clientId)) {

		// check every message for emojis
		emojiDetector(message);

		// Split message content to check each word for trigger keywords
		const sentence = message.content.split(' ');

		// Strip incoming message for comparison		
		const contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

		// If there's a twitter link to fix, do that
		if (twitterFixEnabled) {
			let twitFixReply = twitterFixer(message.content);
			if (twitFixReply.length > 0) {
				response = twitFixReply;
			}
			//if not, check if there's a take a look at this to reply to
		} else if (contentStripped.includes("takealookatthis")) {
			response = takeALook();

			//if not, check if there is a fortune teller request to reply to
		} else if (contentStripped.startsWith(clientId) && message.content.endsWith("?")) {
			response = fortuneTeller(message.content.toLowerCase());
		}

		// if a reply was generated, send it
		if (response.length > 0) {
			// console.log("<@" + message.author.username + '>: ' + message.cleanContent);
			message.reply(response);
			return;
		}

		// If it wasnt a dixbot keyword, log the message for later bot training purposes
		// dataLog.cleanLog pulls out all mentions of userID and a preset list of names
		dataLog.cleanLog(message);

	}
}

export const event = {
	name: name,
	execute: execute,
	once: false,
}