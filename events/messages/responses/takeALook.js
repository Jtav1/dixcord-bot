import {
  incrementTakeALookLink,
  getAllTakeALookLinks,
} from "../../../database/responses.js";
import { getAllConfigurations } from "../../../database/configurations.js";

const takeAlookArray = await getAllTakeALookLinks();
const commonArray = takeAlookArray.filter((x) => x.isdefault == 1);
const rareArray = takeAlookArray.filter((x) => x.isdefault == 0);

let limit = 0;
let lastReplyTimestamp = null;

const configs = await getAllConfigurations();

const repostTrackerTimeframe_ms = parseInt(
  configs.filter(
    (config_entry) => config_entry.config === "take_a_look_delay"
  )[0].value
);
// const configuredLimit = parseInt(
//   configs.filter(
//     (config_entry) => config_entry.config === "take_a_look_repost_limit"
//   )[0].value
// );

const configuredLimit = 1;

// takeALook()
//	selects an image and sends a reply containing the link
//	return: response (string)

export const takeALook = async () => {
  // pull this at response time to get a fresh object
  const configurations = await getAllConfigurations();
  const rareFrequency = parseFloat(
    configurations.filter(
      (config_entry) => config_entry.config === "rare_frequency"
    )[0].value
  );

  let nowTime = Date.now();

  // If there has not been a last reply or it has been long enough since the last reply, reset counter
  if (
    (lastReplyTimestamp &&
      Math.floor(nowTime - lastReplyTimestamp) >= repostTrackerTimeframe_ms) ||
    lastReplyTimestamp == null
  ) {
    lastReplyTimestamp = null;
    limit = 0;
  }

  //New calculation
  const diceRoll = Math.random();

  //if the spam counter hasnt hit the limit
  if (limit < configuredLimit) {
    limit++;
    lastReplyTimestamp = Date.now();

    let imgLink = "";
    if (diceRoll <= rareFrequency) {
      imgLink = rareArray[Math.floor(Math.random() * rareArray.length)];
    } else {
      imgLink = commonArray[Math.floor(Math.random() * commonArray.length)];
    }

  incrementTakeALookLink(imgLink);
  return imgLink.link;

  } else if (limit == configuredLimit) {
    //store the time of the last response and count it
    limit++;
    lastReplyTimestamp = Date.now();

    console.log(diceRoll + " / " + (rareFrequency/2));
    if (diceRoll <= (rareFrequency/2)) {
      return "https://i.imgur.com/kAClxb0.png no spam loolll"; // spam picture url lol
    } else {
      return "No spam!"; 
    }
  } else if ( limit > configuredLimit) {
    // do nothing lol
  }

  return "";
  
};
