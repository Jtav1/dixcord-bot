const fs = require('node:fs');
require('dotenv').config();

// file location for list of URLs
let take_a_look_list_file_loc = '/data/take_a_look_list.txt';

// initialise values that will be exported later
let defaultArray = [];
let rareArray = [];

// Utility function for killing program if missing setup
const writeError = (err) => {
  console.error(err);
  process.exit();
}



/*********** CONFIRM ENVIRONMENT IS SET UP **********/
//INCL: MOUNT DIRECTORY - /data
//      INITIALIZE FILE - /data/take_a_look_list.txt

// Check if data directory mounted
if(!fs.existsSync('/data')){
  console.log("Data directory not mounted. Assuming you are testing locally, using dev env vars");
  take_a_look_list_file_loc = process.env.DEV_TAKE_A_LOOK_AT_THIS_LINKS_FILE;

  if(take_a_look_list_file_loc.length < 1) writeError("Data directory not mounted, and no DEV_TAKE_A_LOOK_AT_THIS_LINKS_FILE in .env")
}

// Put files in the data directory for population if one isn't already there
fs.writeFile(take_a_look_list_file_loc, '', { flag: 'wx' }, function (err) {
  if(err) {
    console.log(take_a_look_list_file_loc + " exists, skipping creation");
  } else {
    console.log("Created " + take_a_look_list_file_loc)
  }
  
  console.log("Make sure you have a list of imgur links in " + take_a_look_list_file_loc + " - one link per line.");
  console.log("And also put a * at the beginning of the default Riker picture e.g. *https://...");
});



/*********** CONFIRM ENVIRONMENT VARIABLES ARE SET **********/
//INCL: token - DISCORD BOT AUTH TOKEN
//      clientId - DISCORD BOT CLIENT ID
//      rareFrequency - HOW OFTEN DO RARE "TAKE A LOOK AT THIS" LINKS GET RETURNED 0-1

let token = process.env.DISCORD_TOKEN;
if(token == null){
  console.log("No token provided. Assuming you are testing locally, using dev env vars");
  token = process.env.DEV_DISCORD_TOKEN;

  if(token.length < 1) writeError("Discord auth token not found, and no DEV_DISCORD_TOKEN in .env") 
}

let clientId = process.env.DISCORD_CLIENT_ID;
if(clientId == null){
  console.log("No clientId provided. Assuming you are testing locally, using dev env vars");
  clientId = process.env.DEV_CLIENT_ID;

  if(clientId.length < 1) writeError("Discord clientId not found, and no DEV_CLIENT_ID in .env") 
}

let rareFreqStr = process.env.RARITY_FREQ
let rareFrequency = parseFloat(rareFreqStr);

if(isNaN(rareFrequency) || rareFrequency > 1.0 || rareFrequency < 0.0){
  console.log("No valid rareFreq provided. Assuming you are testing locally, using dev env vars");
  rareFrequency = process.env.DEV_RARE_FREQ;

  console.log("rareFrequency set to: " + rareFrequency);

  if(isNaN(rareFrequency) || rareFrequency > 1.0 || rareFrequency < 0.0) writeError("Did not provide valid DEV_RARE_FREQ between 0 and 1, defaulting to normal value - 0.10 or 10% chance of rare link.") 
}

/*********** PROCESSING FUNCTIONS **********/

// processTakeImageLinks()
//  Build takeALookSources array of all image links and weights
//  rarity categories are randomly assigned to links other than the default
const processTakeImageLinks = () => {
  const file = fs.readFileSync(take_a_look_list_file_loc, 'utf8');
  let lines = file.split(/\r?\n/);

  lines.forEach((line) => {
    if(line.startsWith("*")) {
      defaultArray.push(line.replace(/[*]/g, "").trim());
    } else {
      rareArray.push(line.trim());
    }

  })

  console.log("Default Array contains " + defaultArray.length + " links");
  console.log("Rare Array contains " + rareArray.length + " links");

}

//Kick off image array building process
processTakeImageLinks();

module.exports = {
  token,
  clientId,
  defaultArray,
  rareArray,
  rareFrequency
};