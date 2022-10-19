const { clientId, takeALookAry, takeALookSources, uncommonScale, rareScale, ultraScale } = require('../configVars.js');

module.exports = {
	name: 'messageCreate',
	execute(message) {

		/*********** SUPPORT UTILITY FUNCTIONS **********/

		// reduce(num int, den int)
		//	reduces a fraction of num / dem if possible
		const reduce = (num, den) => {
			//too tired to figure this out so i stole it https://stackoverflow.com/questions/4652468/is-there-a-javascript-function-that-reduces-a-fraction dont ever say im not honest
			let gcd = (a, b) => {
				return b ? gcd(b, a%b) : a;
			}

			gcd = gcd(num, den);
			return [num/gcd, den/gcd];
		}

		
		//******* RESPONSE FUNCTIONS *******//
			
		// takeALook()
		//	selects an image and sends a reply containing the link
		//	if the image has a sufficient rarity, also says that
		const takeALook = () => {
			let totalArySize = takeALookAry.length;

			let imgLink = takeALookAry[Math.floor(Math.random() * totalArySize)]
			let imgWeight = takeALookSources.find(item => item.link === imgLink).weight;

			let pct = (imgWeight / totalArySize).toFixed(3);

			message.reply(imgLink);
		
			if(imgWeight <= uncommonScale && imgWeight > rareScale){
				let fraction = reduce(imgWeight, totalArySize);
				message.channel.send("Rare, odds: **" + fraction[0] + "** in **" + fraction[1] + "** or " + pct + "%");
			} 
			else if(imgWeight <= rareScale && imgWeight > ultraScale){
				let fraction = reduce(imgWeight, totalArySize);
				message.channel.send("ULTRA GIGA rare, odds: **" + fraction[0] + "** in **" + fraction[1] + "** or " + pct + "%!");
			} 
			else if(imgWeight <= ultraScale) {
				let fraction = reduce(imgWeight, totalArySize);
				message.channel.send("ULTRA GIGA rare, odds: **" + fraction[0] + "** in **" + fraction[1] + "** or " + pct + "%!!!");
			}
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