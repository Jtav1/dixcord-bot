import "dotenv/config";
import fs from "node:fs";

let version = "1.6.2";

// file location for list of URLs
let take_a_look_list_file_loc = "./data/take_a_look_list.txt";

let positive_file_loc = "./data/positive.txt";
let negative_file_loc = "./data/negative.txt";
let neutral_file_loc = "./data/neutral.txt";

let log_filter_list_loc = "./data/logfilterlist.txt";

// Utility function for killing program if missing setup
const writeError = (err) => {
  console.error(err);
  process.exit();
};

/*********** CONFIRM ENVIRONMENT IS SET UP **********/
//INCL: MOUNT DIRECTORY - /data

fs.writeFile(log_filter_list_loc, "", { flag: "wx" }, function (err) {
  if (!err) {
    console.log("log: text log file created: " + log_filter_list_loc);
  }
});

/*********** CONFIRM ENVIRONMENT VARIABLES ARE SET **********/
//INCL: token - DISCORD BOT AUTH TOKEN
//      clientId - DISCORD BOT CLIENT ID
//      guildId - DISCORD GUILD ID FOR SINGLE-SERVER USE
//      rareFreqStr/rareFrequency - HOW OFTEN DO RARE "TAKE A LOOK AT THIS" LINKS GET RETURNED 0-1
//      logFile - where to store (sanitized) chat logs

// These are the required variables - can be passed into the container as env vars or in a .env file in root directory
//  usually i pass them into the container in prod and put them in .env for dev.
//  note the env var names are different for dev/prod
// To run in production mode, add an env var (in docker or in .env file) called DEV_FLAG and set it to 0

let isDev = true;
if (process.env.DEV_FLAG == false) {
  console.log("RUNNING IN PRODUCTION");
  isDev = false;
} else {
  console.log("RUNNING IN DEVELOPMENT");
}

if (isDev) {
  take_a_look_list_file_loc = "/data/take_a_look_list.txt";
  positive_file_loc = "/data/positive.txt";
  negative_file_loc = "/data/negative.txt";
  neutral_file_loc = "/data/neutral.txt";
  log_filter_list_loc = "/data/logfilterlist.txt";
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

const rareFreqStr = process.env.RARITY_FREQ;
const logFile = process.env.DISCORD_LOG_FILE;

const twitterFixEnabled = process.env.ENABLE_TWITTER_FIXER === "true";

const mysqlHost = process.env.MYSQL_HOST;
const mysqlPort = process.env.MYSQL_PORT;
const mysqlUser = process.env.MYSQL_USER;
const mysqlPw = process.env.MYSQL_PW;
const mysqlDb = process.env.MYSQL_DB;

let rareFrequency = parseFloat(rareFreqStr);
if (isNaN(rareFrequency) || rareFrequency > 1.0 || rareFrequency < 0.0) {
  rareFrequency = 0.1;
  writeError(
    "Did not provide valid DEV_RARE_FREQ between 0 and 1, defaulting to normal value - 0.10 or 10% chance of rare link."
  );
}

console.log("-- sanitized chatlogs will be saved in " + logFile);

if (!mysqlHost || mysqlHost.length < 1) console.log("-- no db config provided");

export {
  token, //----
  clientId, //----
  guildId, //----
  rareFrequency, //----
  logFile, //----
  twitterFixEnabled, //----
  mysqlHost, //used
  mysqlPort, //used
  mysqlUser, //used
  mysqlPw, //used
  mysqlDb, //uzed
  isDev, // used
  version, // used
  log_filter_list_loc, // used for initial database creation & import
  take_a_look_list_file_loc, // used for initial database creation & import
  positive_file_loc, // used for initial database creation & import
  negative_file_loc, // used for initial database creation & import
  neutral_file_loc, // used for initial database creation & import
};
