import "dotenv/config";

import packageJson from "./package.json" with { type: "json" };
const version = packageJson.version;

// =========== REQUIRED ============= //
// DEV_FLAG must be non-empty. isDev is false when the value is loosely == false
// (e.g. "0"); otherwise treated as development (data paths, announce behavior).

let isDev = true;
let dataDirectory = "";

if (process.env.DEV_FLAG.length < 1) {
  console.log("config: missing DEV_FLAG env var");
}

if (process.env.DEV_FLAG == false) {
  console.log("config: running in PRODUCTION mode");
  isDev = false;
  dataDirectory = "/data";
} else {
  console.log("config: running in DEVELOPMENT mode");
  dataDirectory = "./data";
}

const token = process.env.FLUXER_TOKEN;
const guildId = process.env.FLUXER_GUILD_ID; // Community/guild the bot operates in
const commandPrefix = process.env.FLUXER_COMMAND_PREFIX || "!"; // prefix for text commands (no slash commands in fluxer.js)
const instanceUrl = process.env.FLUXER_INSTANCE_URL || null; // self-hosted instance origin; unset = hosted fluxer.app

//prettier-ignore
if (!token || token.length < 1) console.log("config: missing FLUXER_TOKEN env var");

//prettier-ignore
if (!guildId || guildId.length < 1) console.log("config: missing FLUXER_GUILD_ID env var");

// bot expects all three at runtime (no in-code defaults; api/client throws if unset).
const webapiUrl = process.env.WEBAPI_URL?.replace(/\/$/, "") || null;
const webapiUsername = process.env.WEBAPI_USERNAME || null;
const webapiPassword = process.env.WEBAPI_PASSWORD || null;

console.log("config: successfully loaded environment configuration");

export {
  token,
  guildId,
  instanceUrl,
  commandPrefix,
  dataDirectory,
  isDev,
  version,
  webapiUrl,
  webapiUsername,
  webapiPassword,
};
