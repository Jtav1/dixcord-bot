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

export {
  token,
  clientId,
  guildId,
  dataDirectory,
  mysqlHost,
  mysqlPort,
  mysqlUser,
  mysqlPw,
  mysqlDb,
  isDev,
  version,
};
