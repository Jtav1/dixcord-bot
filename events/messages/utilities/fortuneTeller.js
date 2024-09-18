
// fortuneTeller()
//	Randomly sends a fortune
//  return: response (string)
const fortuneTeller = (
    rawMessage, 
    clientId, 
    positiveArray, 
    negativeArray, 
    neutralArray
) => {
	const processedMessage = rawMessage.replace("<@" + clientId + ">", "")

    // var Sentiment = require('sentiment');
    // var sentiment = new Sentiment();


	//var result = sentiment.analyze(processedMessage);

	const combinedResponses = positiveArray.concat(negativeArray, neutralArray);


	console.log(combinedResponses.length);
	return (combinedResponses[Math.floor(Math.random() * combinedResponses.length)]);
}

export default fortuneTeller;