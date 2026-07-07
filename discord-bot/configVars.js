import "dotenv/config";

import packageJson from "./package.json" with { type: "json" };
const version = packageJson.version;

// =========== REQUIRED ============= //
// DEV_FLAG must be non-empty. isDev is false when the value is loosely == false
// (e.g. "0"); otherwise treated as development (data paths, announce channel).

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

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // Guild targeted by deploy-commands.js and bot context

/** Channel ID for extra message-author union during user-mapping sync; optional. Must belong to DISCORD_GUILD_ID. */
const userMappingImportChannelId =
  process.env.DISCORD_USER_MAPPING_IMPORT_CHANNEL_ID ?? "";

//prettier-ignore
if (!token || token.length < 1) console.log("config: missing DISCORD_TOKEN env var");

//prettier-ignore
if (!clientId || clientId.length < 1) console.log("config: missing DISCORD_CLIENT_ID env var");

//prettier-ignore
if (!guildId || guildId.length < 1) console.log("config: missing DISCORD_GUILD_ID env var");

// bot expects all three at runtime (no in-code defaults; api/client throws if unset).
const webapiUrl = process.env.WEBAPI_URL?.replace(/\/$/, "") || null;
const webapiUsername = process.env.WEBAPI_USERNAME || null;
const webapiPassword = process.env.WEBAPI_PASSWORD || null;

console.log("config: successfully loaded environment configuration");

export {
  token,
  clientId,
  guildId,
  userMappingImportChannelId,
  dataDirectory,
  isDev,
  version,
  webapiUrl,
  webapiUsername,
  webapiPassword,
};
