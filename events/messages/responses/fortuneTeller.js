import {
  getAllFortunes,
  incrementFortune,
} from "../../../middleware/responses.js";

const allFortunes = await getAllFortunes();
// const positiveFortunes = allFortunes.filter((fortune) => {
//   return fortune.sentiment === "positive";
// });
// const negativeFortunes = allFortunes.filter((fortune) => {
//   return fortune.sentiment === "negative";
// });
// const neutralFortunes = allFortunes.filter((fortune) => {
//   return fortune.sentiment === "neutral";
// });

// fortuneTeller()
//	Randomly sends a fortune
//  return: response (string)
const fortuneTeller = (rawMessage, clientId) => {
  const processedMessage = rawMessage.replace("<@" + clientId + ">", "");

  // var Sentiment = require('sentiment');
  // var sentiment = new Sentiment();

  //var result = sentiment.analyze(processedMessage);
  let fortuneReply =
    allFortunes[Math.floor(Math.random() * allFortunes.length)];
  incrementFortune(fortuneReply);

  return fortuneReply.response_string;
};

export default fortuneTeller;
