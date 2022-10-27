const { clientId, defaultArray, rareArray, rareFrequency } = require('../configVars.js');


module.exports = {
	name: 'messageCreate',
	execute(message) {

		//******* RESPONSE FUNCTIONS *******//
			
		// takeALook()
		//	selects an image and sends a reply containing the link
		//	if the image has a sufficient rarity, also says that
		const takeALook = () => {
			let imgLink = "";

			//New calculation
			let diceRoll = Math.random();

			if(diceRoll <= rareFrequency){
				console.log("diceRoll of " + diceRoll + " is within rare frequency of " + rareFrequency + " - returning rare link.")
				imgLink = rareArray[rareArray.length * Math.random() | 0]
			} else {
				console.log("diceRoll of " + diceRoll + " is outside rare frequency of " + rareFrequency + " - returning default link.")
				imgLink = defaultArray[defaultArray.length * Math.random() | 0]
			}

			console.log("Sending message: " + imgLink);
			message.reply(imgLink);
		}


		//******* INCOMING MESSAGE PROCESSING *******//
			
		if(!message.author.bot && !(message.author.id === clientId)){
			
			// List of all response functions
			let commandDict = {
				'takealookatthis': takeALook,
			}

			// Strip incoming message for comparison
			let contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
			
			// If the incoming message contains a response trigger phrase
			for(var key in commandDict){
				if(contentStripped.includes(key)){
					commandDict[key]();
				}
			}
		}
	},
};