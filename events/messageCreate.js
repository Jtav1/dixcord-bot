const { clientId, defaultArray, rareArray, rareFrequency, positiveArray, negativeArray, neutralArray } = require('../configVars.js');

// var Sentiment = require('sentiment');
// var sentiment = new Sentiment();

let limit = 0;
let lastReplyTimestamp = null;
let ms = (Math.random() * 60000) + 60000; // CUTTING EDGE AI ANTI EXPLOIT TECHNOLOGY
// let ms = 10000;
let configuredLimit = 2;

module.exports =  {
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
				
				message.reply("No spam!"); // https://i.imgur.com/kAClxb0.png = spam picture url lol

				return;

			} else {
				//do nothing
				return;
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

			message.reply(imgLink);
		}


		// fortuneTeller()
		//	Randomly sends a fortune
		const fortuneTeller = (rawMessage) => {
			console.log("Fortune teller: ")
			const processedMessage = rawMessage.replace("<@" + clientId + ">", "")
			console.log(rawMessage + " => " + processedMessage);
			//var result = sentiment.analyze(processedMessage);

			const combinedResponses = positiveArray.concat(negativeArray, neutralArray);
			console.log(combinedResponses.length);
			message.reply(combinedResponses[Math.floor(Math.random() * combinedResponses.length)]);
		}

		//******* INCOMING MESSAGE PROCESSING *******//
			
		if(!message.author.bot && !(message.author.id === clientId)){
			
			// List of all response functions
			//let commandDict = {
			//	'takealookatthis': ,
			//	'dixbotfortune': fortuneTeller,
			//}

			// Strip incoming message for comparison		
			const contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
			
			// If the incoming message contains a response trigger phrase
			if(contentStripped.includes("takealookatthis")){
				takeALook();
			} else if(contentStripped.startsWith(clientId) && message.content.endsWith("?")){
				fortuneTeller(message.content.toLowerCase());
			}
		}
	},
};
