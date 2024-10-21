import "dotenv/config";
import fs from "node:fs";

// Utility function for killing program if missing setup
const writeError = (err) => {
  console.error(err);
  process.exit();
};

import packageJson from "./package.json" with { type: "json" };
const version = packageJson.version;

// =========== REQUIRED ============= //
// DEV_FLAG

let isDev = true;
let dataDirectory = "";
if (process.env.DEV_FLAG == false) {
  console.log("RUNNING IN PRODUCTION");
  isDev = false;
  dataDirectory = "/data";
} else {
  console.log("RUNNING IN DEVELOPMENT");
  dataDirectory = "./data";
}

if (process.env.DEV_FLAG.length < 1)
  writeError("config: missing DEV_FLAG env var, defaulting to DEV mode");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // Eventually this might become dynamic

if (!token || token.length < 1)
  writeError("config: missing DISCORD_TOKEN env var");
if (!clientId || clientId.length < 1)
  writeError("config: missing DISCORD_CLIENT_ID env var");
if (!guildId || guildId.length < 1)
  writeError("config: missing DISCORD_GUILD_ID env var");

// Database stuff
const mysqlHost = process.env.MYSQL_HOST;
const mysqlPort = process.env.MYSQL_PORT;
const mysqlUser = process.env.MYSQL_USER;
const mysqlPw = process.env.MYSQL_PW;
const mysqlDb = process.env.MYSQL_DB;

if (!mysqlHost || mysqlHost.length < 1)
  writeError("config: missing MYSQL_HOST env var");
if (!mysqlPort || mysqlPort.length < 1)
  writeError("config: missing MYSQL_PORT env var");
if (!mysqlUser || mysqlUser.length < 1)
  writeError("config: missing MYSQL_USER env var");
if (!mysqlPw || mysqlPw.length < 1)
  writeError("config: missing MYSQL_PW env var");
if (!mysqlDb || mysqlDb.length < 1)
  writeError("config: missing MYSQL_DB env var");

const logFile = process.env.DISCORD_LOG_FILE; //This is required for now

if (!logFile || logFile.length < 1)
  writeError("config: missing DISCORD_LOG_FILE env var");

// =========== OPTIONAL ============= //

// file location for list of URLs
let take_a_look_list_file_loc = `${dataDirectory}/take_a_look_list.txt`;
let positive_file_loc = `${dataDirectory}/positive.txt`;
let negative_file_loc = `${dataDirectory}/negative.txt`;
let neutral_file_loc = `${dataDirectory}/neutral.txt`;
let log_filter_list_loc = `${dataDirectory}/logfilterlist.txt`;

// =========== END CONFIG VARS ============= //

console.log("log: sanitized chatlogs will be saved in " + logFile);

export {
  token, //----
  clientId, //----
  guildId, //----
  dataDirectory, //----
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
