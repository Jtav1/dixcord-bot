import "dotenv/config";

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

// Web API (optional: set WEBAPI_URL, WEBAPI_USERNAME, WEBAPI_PASSWORD to use API auth)
const webapiUrl =
  process.env.WEBAPI_URL?.replace(/\/$/, "") || "http://localhost:3000";
const webapiUsername = process.env.WEBAPI_USERNAME || "justin";
const webapiPassword = process.env.WEBAPI_PASSWORD || "password";

export {
  token,
  clientId,
  guildId,
  dataDirectory,
  isDev,
  version,
  webapiUrl,
  webapiUsername,
  webapiPassword,
};
