import { rareFrequency } from "../../../configVars.js";

import {
  incrementTakeALookLink,
  getAllTakeALookLinks,
} from "../../../middleware/responses.js";

const takeAlookArray = await getAllTakeALookLinks();
const commonArray = takeAlookArray.filter((x) => x.isdefault == 1);
const rareArray = takeAlookArray.filter((x) => x.isdefault == 0);

let limit = 0;
let lastReplyTimestamp = null;
let ms = Math.random() * 60000 + 60000; // CUTTING EDGE AI ANTI EXPLOIT TECHNOLOGY

let configuredLimit = 2;

// takeALook()
//	selects an image and sends a reply containing the link
//	return: response (string)

const takeALook = () => {
  let nowTime = Date.now();
  let response = "";

  // If there has not been a last reply or it has been long enough since the last reply, reset counter
  if (
    (lastReplyTimestamp && Math.floor(nowTime - lastReplyTimestamp) >= ms) ||
    lastReplyTimestamp == null
  ) {
    lastReplyTimestamp = null;
    limit = 0;
  }

  //if the spam counter hasnt hit the limit
  if (limit < configuredLimit) {
    limit++;
    lastReplyTimestamp = Date.now();
  } else if (limit >= configuredLimit) {
    //store the time of the last response and count it
    //lastReplyTimestamp = Date.now();

    response = "No spam!"; // https://i.imgur.com/kAClxb0.png = spam picture url lol
  }

  let imgLink = "";

  //New calculation
  let diceRoll = Math.random();

  if (diceRoll <= rareFrequency) {
    imgLink = rareArray[(rareArray.length * Math.random()) | 0];
  } else {
    imgLink = commonArray[(commonArray.length * Math.random()) | 0];
  }

  response.length < 1 ? (response = imgLink.link) : null;

  incrementTakeALookLink(imgLink);

  return response;
};

export default takeALook;
