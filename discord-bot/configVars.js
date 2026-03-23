import "dotenv/config";

// Utility function for killing program if missing setup
const writeError = (err) => {
  console.error(err);
  process.exit();
};

import packageJson from "./package.json" with { type: "json" };
const version = packageJson.version;

// =========== REQUIRED ============= //
// DEV_FLAG — must be non-empty. isDev is false when the value is loosely == false
// (e.g. "0"); otherwise treated as development (data paths, announce channel).

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
const guildId = process.env.DISCORD_GUILD_ID; // Guild targeted by deploy-commands.js and bot context

//prettier-ignore
if (!token || token.length < 1) writeError("config: missing DISCORD_TOKEN env var");

//prettier-ignore
if (!clientId || clientId.length < 1) writeError("config: missing DISCORD_CLIENT_ID env var");

//prettier-ignore
if (!guildId || guildId.length < 1) writeError("config: missing DISCORD_GUILD_ID env var");

// Web API — bot expects all three at runtime (no in-code defaults; api/client throws if unset).
const webapiUrl = process.env.WEBAPI_URL?.replace(/\/$/, "") || null;
const webapiUsername = process.env.WEBAPI_USERNAME || null;
const webapiPassword = process.env.WEBAPI_PASSWORD || null;

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
