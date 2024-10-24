import {
  incrementTakeALookLink,
  getAllTakeALookLinks,
} from "../../../middleware/responses.js";
import { getAllConfigurations } from "../../../middleware/configurations.js";

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
const configuredLimit = parseInt(
  configs.filter(
    (config_entry) => config_entry.config === "take_a_look_repost_limit"
  )[0].value
);

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
  let response = "";

  // If there has not been a last reply or it has been long enough since the last reply, reset counter
  if (
    (lastReplyTimestamp &&
      Math.floor(nowTime - lastReplyTimestamp) >= repostTrackerTimeframe_ms) ||
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
