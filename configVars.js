const fs = require('node:fs');

// file location for list of URLs
const take_a_look_list_file_loc = '/data/take_a_look_list.txt';

// initialise values that will be exported later
let takeALookSources = [];
let takeALookAry = null;

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
  writeError("Data directory not mounted. Add external volume, mounted internaly at /data")
}

// Put files in the data directory for population if one isn't already there
fs.writeFile(take_a_look_list_file_loc, '', { flag: 'wx' }, function (err) {
  if(err) {
    console.log(take_a_look_list_file_loc + " exists, skipping creation");
  } 
  
  console.log("Created /data/take_a_look_at_this.txt")
  console.log("Make sure you have a list of imgur links in /data/take_a_look_at_this.txt - one link per line.");
  console.log("And also put a * at the beginning of the default Riker picture e.g. *https://...");
});



/*********** CONFIRM ENVIRONMENT VARIABLES ARE SET **********/
//INCL: token - DISCORD BOT AUTH TOKEN
//      clientId - DISCORD BOT CLIENT ID
//      [weight scale values] - FOR BUILDING RANDOM IMG LINK ARRAY

let token = process.env.DISCORD_TOKEN;
if(token == null){
  writeError("No token provided. Please add environment variable called DISCORD_TOKEN with bots discord auth token."); 
}

let clientId = process.env.DISCORD_CLIENT_ID;
if(clientId == null){
  writeError("No token provided. Please add environment variable called DISCORD_CLIENT_ID with bots discord client id."); 
}

let uncommonScale = process.env.RARITY_UNCOMMON;
let rareScale = process.env.RARITY_RARE;
let ultraScale = process.env.RARITY_ULTRA;
let defaultScale = process.env.RARITY_DEFAULT;
if(uncommonScale == null || rareScale == null ||  ultraScale == null ||  defaultImgWeight == null){
  console.log("Did not provide RARITY_UNCOMMON, RARITY_RARE, RARITY_ULTRA, RARITY_DEFAULT env vars - defaulting to normal values.")

  uncommonScale = 180;
  rareScale = 80;
  ultraScale = 10;
  defaultScale = 3000;
}



/*********** CONFIRM ENVIRONMENT VARIABLES ARE SET **********/
//INCL: token - DISCORD BOT AUTH TOKEN
//      clientId - DISCORD BOT CLIENT ID
//      [weight scale values] - FOR BUILDING RANDOM IMG LINK ARRAY

// processTakeImageLinks()
//  Build takeALookSources array of all image links and weights
//  rarity categories are randomly assigned to links other than the default
const processTakeImageLinks = () => {
  const file = fs.readFileSync(take_a_look_list_file_loc, 'utf8');
  let lines = file.split(/\r?\n/);

  for (const line of lines) {
    const weightScale = () => {
      let scaleSelect = Math.floor(Math.random() * 3) + 1;

      switch(scaleSelect){
        case 1:
          return uncommonScale;
        case 2:
          return rareScale;
        case 3:
          return ultraScale;
        default:
          writeError("Whoa math itself has broken somehow");
      }
    }

    let weight = Math.floor(Math.random() * weightScale()) + 1;
    
    //Pull the asterisk out if it exists
    addLine = line;
    if(line.startsWith("*")) {
      weight = defaultScale; 
      addLine = line.replace(/[*]/g, "");
    }

    takeALookSources.push({ link: addLine, weight: weight })
  }
  cacheSources();
}

// cacheSources()
//  Build a full array on initialization to choose response links from
//  each link will be in here its [weight] times
const cacheSources = () => {

  if(takeALookAry == null) {
    linkTbl = [];

    takeALookSources.forEach((img) => {
      for(i = 0; i < img.weight; i++){
        linkTbl.push(img.link);
      }
    });
  
    takeALookAry = linkTbl;
  }
}

//Kick off image array building process
processTakeImageLinks();

module.exports = {
  token,
  clientId,
  takeALookAry,
  takeALookSources,
  uncommonScale,
  rareScale,
  ultraScale
};