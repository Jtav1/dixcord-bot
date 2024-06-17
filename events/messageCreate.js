const { clientId, defaultArray, rareArray, rareFrequency, positiveArray, negativeArray, neutralArray, twitterFixEnabled } = require('../configVars.js');

const dataLog = require('../Logging/dataLog.js');

// var Sentiment = require('sentiment');
// var sentiment = new Sentiment();

let limit = 0;
let lastReplyTimestamp = null;
let ms = (Math.random() * 60000) + 60000; // CUTTING EDGE AI ANTI EXPLOIT TECHNOLOGY
// let ms = 10000;

let configuredLimit = 2;

module.exports = {
	name: 'messageCreate',
	execute(message) {

		//******* RESPONSE FUNCTIONS *******//
			
		// takeALook()
		//	selects an image and sends a reply containing the link
		//	if the image has a sufficient rarity, also says that
		const takeALook = () => {
			let nowTime = Date.now();

			if(lastReplyTimestamp == null || Math.floor((nowTime - lastReplyTimestamp)) >= ms){
				timestamp = null
				limit = 0;
			}

			if(limit < configuredLimit){
				//continue to response
			} else if(limit == (configuredLimit)) {

				lastReplyTimestamp = Date.now();
				limit++;
				
				return "No spam!"; // https://i.imgur.com/kAClxb0.png = spam picture url lol
			}

			let imgLink = "";

			//New calculation
			let diceRoll = Math.random();

			if(diceRoll <= rareFrequency){
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
		const fortuneTeller = (rawMessage) => {
			const processedMessage = rawMessage.replace("<@" + clientId + ">", "")

			//var result = sentiment.analyze(processedMessage);

			const combinedResponses = positiveArray.concat(negativeArray, neutralArray);


			console.log(combinedResponses.length);
			return(combinedResponses[Math.floor(Math.random() * combinedResponses.length)]);
		}

		// twitterFixer(str, bool)
		//  reply with a vx twitter link if a non-vx twitter link is posted
		//	urlType = true for x.com false for twitter.com
		const twitterFixer =  (url, urlType) => {
			if(urlType){
				return "fixed it: " + url.replace('https://x.com/', 'https://vxtwitter.com/');
			} else {
				return "fixed it: " + url.replace('https://twitter.com/', 'https://vxtwitter.com/');
			}
		}

		//******* INCOMING MESSAGE PROCESSING *******//

		let response = "";
			
		if(!message.author.bot && !(message.author.id === clientId)){

			//console.log(message.content);

			const EMOJIREGEX = /((?<!\\)<:[^:]+:(\d+)>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu;
			const emojiDetector = (str) => str.match(EMOJIREGEX);

			let emoAry = emojiDetector(message.content) || [];

			emoAry.forEach(emo => {
				if(emo.length > 0) dataLog.countEmoji(emo);
			});

			emoAry = [];


			// List of all response functions
			//let commandDict = {
			//	'takealookatthis': ,
			//	'dixbotfortune': fortuneTeller,
			//	'twitterFixer': fixes twitter links
			//}
			const sentence = message.content.split(' ');

			sentence.forEach(async word => {
				if(twitterFixEnabled){
					if(word.startsWith('https://twitter.com/') && twitterFixEnabled){
						response = twitterFixer(word, false);
					} else if(word.startsWith('https://x.com/') && twitterFixEnabled){
						response = twitterFixer(word, true);
					}
				}
			})

			if(response.length > 0){
				//console.log("@" + message.name);
				message.reply(response);
				return;
			}

			// Strip incoming message for comparison		
			const contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
			
			// If the incoming message contains a response trigger phrase
			if(contentStripped.includes("takealookatthis")){
				response = takeALook();
			} else if(contentStripped.startsWith(clientId) && message.content.endsWith("?")){
				response = fortuneTeller(message.content.toLowerCase());
			}

			if(response.length > 0){
				// console.log("<@" + message.author.username + '>: ' + message.cleanContent);
				message.reply(response);
				return;
			}

			// If it wasnt a dixbot keyword, log the message for later bot training purposes
			// dataLog.cleanLog pulls out all mentions of userID and a preset list of names
			dataLog.cleanLog(message);

		}
	},
};
