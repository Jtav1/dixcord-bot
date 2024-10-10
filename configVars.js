import "dotenv/config";
import fs from "node:fs";

let version = "1.6.2";

// file location for list of URLs
let take_a_look_list_file_loc = "/data/take_a_look_list.txt";

let positive_file_loc = "/data/positive.txt";
let negative_file_loc = "/data/negative.txt";
let neutral_file_loc = "/data/neutral.txt";

let log_filter_list_loc = "/data/logfilterlist.txt";

// initialise values that will be exported later
let defaultArray = [];
let rareArray = [];

let filterWordArray = [];

let positiveArray = [];
let negativeArray = [];
let neutralArray = [];

// Utility function for killing program if missing setup
const writeError = (err) => {
  console.error(err);
  process.exit();
};

/*********** CONFIRM ENVIRONMENT IS SET UP **********/
//INCL: MOUNT DIRECTORY - /data
//    TAKE A LOOK AT THIS:
//      INITIALIZE FILE - /data/take_a_look_list.txt

//    FORTUNE TELLER:
//      INITIALIZE FILE - /data/positive.txt
//      INITIALIZE FILE - /data/negative.txt
//      INITIALIZE FILE - /data/neutral.txt

// Check if data directory mounted - these run regardless of dev/prod state
if (!fs.existsSync("/data")) {
  console.log(
    "-- Data directory not mounted. Assuming you are testing locally, using dev env vars"
  );

  take_a_look_list_file_loc = process.env.DEV_TAKE_A_LOOK_AT_THIS_LINKS_FILE;
  positive_file_loc = process.env.DEV_POSITIVE_FILE;
  negative_file_loc = process.env.DEV_NEGATIVE_FILE;
  neutral_file_loc = process.env.DEV_NEUTRAL_FILE;

  log_filter_list_loc = process.env.DEV_LOG_FILTER_LIST_FILE;

  // if (take_a_look_list_file_loc.length < 1)
  //   writeError(
  //     "-- Data directory not mounted, and no DEV_TAKE_A_LOOK_AT_THIS_LINKS_FILE in .env"
  //   );
  if (positive_file_loc.length < 1)
    writeError(
      "-- Data directory not mounted, and no DEV_POSITIVE_FILE in .env"
    );
  if (negative_file_loc.length < 1)
    writeError(
      "-- Data directory not mounted, and no DEV_NEGATIVE_FILE in .env"
    );
  if (neutral_file_loc.length < 1)
    writeError(
      "-- Data directory not mounted, and no DEV_NEUTRAL_FILE in .env"
    );
  if (log_filter_list_loc.length < 1)
    writeError(
      "-- Data directory not mounted, and no DEV_LOG_FILTER_LIST_FILE in .env"
    );
}

// // Put files in the data directory for population if one isn't already there
// fs.writeFile(take_a_look_list_file_loc, "", { flag: "wx" }, function (err) {
//   if (err) {
//     console.log(
//       "-- " + take_a_look_list_file_loc + " exists, skipping creation"
//     );
//   } else {
//     console.log("---- Created " + take_a_look_list_file_loc);
//   }

//   console.log(
//     "---- Make sure you have a list of imgur links in " +
//       take_a_look_list_file_loc +
//       " - one link per line."
//   );
//   console.log(
//     "---- And also put a * at the beginning of the default Riker picture e.g. *https://..."
//   );
// });

fs.writeFile(positive_file_loc, "", { flag: "wx" }, function (err) {
  if (err) {
    console.log("-- " + positive_file_loc + " exists, skipping creation");
  } else {
    console.log("---- Created " + positive_file_loc);
  }
});

fs.writeFile(negative_file_loc, "", { flag: "wx" }, function (err) {
  if (err) {
    console.log("-- " + negative_file_loc + " exists, skipping creation");
  } else {
    console.log("---- Created " + negative_file_loc);
  }
});

fs.writeFile(neutral_file_loc, "", { flag: "wx" }, function (err) {
  if (err) {
    console.log("-- " + neutral_file_loc + " exists, skipping creation");
  } else {
    console.log("---- Created " + neutral_file_loc);
  }
});

fs.writeFile(log_filter_list_loc, "", { flag: "wx" }, function (err) {
  if (err) {
    console.log("-- " + log_filter_list_loc + " exists, skipping creation");
  } else {
    console.log("---- Created " + log_filter_list_loc);
  }

  console.log(
    "---- Make sure you have a list of words to filter in " +
      log_filter_list_loc +
      " - one word per line."
  );
  console.log(
    "---- This should include names, vulgar words, etc that shouldn't be used for future dixbot training."
  );
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

let token = "";
let clientId = "";
let guildId = "";
let rareFreqStr = "";
let logFile = "";

let twitterFixEnabled = false;

let mysqlHost = "";
let mysqlPort = "";
let mysqlUser = "";
let mysqlPw = "";
let mysqlDb = "";

if (isDev) {
  //load dev vars from local .env file (prefaced with DEV_)
  token = process.env.DEV_DISCORD_TOKEN;
  clientId = process.env.DEV_CLIENT_ID;
  guildId = process.env.DEV_GUILD_ID;
  rareFreqStr = process.env.DEV_RARITY_FREQ;
  logFile = process.env.DEV_DISCORD_LOG_FILE;

  twitterFixEnabled = process.env.DEV_ENABLE_TWITTER_FIXER === "true";

  mysqlHost = process.env.DEV_MYSQL_HOST;
  mysqlPort = process.env.DEV_MYSQL_PORT;
  mysqlUser = process.env.DEV_MYSQL_USER;
  mysqlPw = process.env.DEV_MYSQL_PW;
  mysqlDb = process.env.DEV_MYSQL_DB;
} else if (!isDev) {
  //load production vars
  token = process.env.DISCORD_TOKEN;
  clientId = process.env.DISCORD_CLIENT_ID;
  guildId = process.env.DISCORD_GUILD_ID;
  rareFreqStr = process.env.RARITY_FREQ;
  logFile = process.env.DISCORD_LOG_FILE;

  twitterFixEnabled = process.env.ENABLE_TWITTER_FIXER === "true";

  mysqlHost = process.env.MYSQL_HOST;
  mysqlPort = process.env.MYSQL_PORT;
  mysqlUser = process.env.MYSQL_USER;
  mysqlPw = process.env.MYSQL_PW;
  mysqlDb = process.env.MYSQL_DB;
}

let rareFrequency = parseFloat(rareFreqStr);
if (isNaN(rareFrequency) || rareFrequency > 1.0 || rareFrequency < 0.0) {
  rareFrequency = 0.1;
  writeError(
    "Did not provide valid DEV_RARE_FREQ between 0 and 1, defaulting to normal value - 0.10 or 10% chance of rare link."
  );
}

console.log("-- sanitized chatlogs will be saved in " + logFile);

if (!mysqlHost || mysqlHost.length < 1) console.log("-- no db config provided");

/*********** PROCESSING FUNCTIONS **********/

// processTakeImageLinks()
//  Build takeALookSources array of all image links and weights
//  rarity categories are randomly assigned to links other than the default
// const processTakeImageLinks = () => {
//   const file = fs.readFileSync(take_a_look_list_file_loc, "utf8");
//   let lines = file.split(/\r?\n/);

//   lines.forEach((line) => {
//     if (line.startsWith("*")) {
//       defaultArray.push(line.replace(/[*]/g, "").trim());
//     } else {
//       rareArray.push(line.trim());
//     }
//   });

//   console.log("-- Default Array contains " + defaultArray.length + " links");
//   console.log("-- Rare Array contains " + rareArray.length + " links");
// };

// processLogFilterList()
//  Build logFilterWords array of all words to be filtered when logging
const processLogFilterList = () => {
  const file = fs.readFileSync(log_filter_list_loc, "utf8");
  let lines = file.split(/\r?\n/);

  lines.forEach((line) => {
    filterWordArray.push(line.toLowerCase().trim());
  });

  console.log(
    "-- Filter Word Array contains " + filterWordArray.length + " keywords"
  );
};

const processFortuneArrays = () => {
  const posFile = fs.readFileSync(positive_file_loc, "utf8").split(/\r?\n/);
  const negFile = fs.readFileSync(negative_file_loc, "utf8").split(/\r?\n/);
  const neuFile = fs.readFileSync(neutral_file_loc, "utf8").split(/\r?\n/);

  posFile.forEach((line) => {
    positiveArray.push(line.trim());
  });

  negFile.forEach((line) => {
    negativeArray.push(line.trim());
  });

  neuFile.forEach((line) => {
    neutralArray.push(line.trim());
  });

  console.log(
    "-- Positive Array contains " + positiveArray.length + " responses"
  );
  console.log(
    "-- Negative Array contains " + negativeArray.length + " responses"
  );
  console.log(
    "-- Neutral Array contains " + neutralArray.length + " responses"
  );
};

//Kick off image array building process
//processTakeImageLinks();
processFortuneArrays();
processLogFilterList();

export {
  token,
  clientId,
  guildId,
  defaultArray,
  rareArray,
  rareFrequency,
  positiveArray,
  negativeArray,
  neutralArray,
  logFile,
  log_filter_list_loc,
  filterWordArray,
  mysqlHost,
  mysqlPort,
  mysqlUser,
  mysqlPw,
  mysqlDb,
  twitterFixEnabled,
  isDev, // used
  version,
  take_a_look_list_file_loc, // used
  positive_file_loc, // used
  negative_file_loc, // used
  neutral_file_loc, // used
};
