import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { waitForWebapi } from "./wait-for-webapi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

function deploySlashCommandsEnabled() {
  const v = process.env.DEPLOY_SLASH_COMMANDS;
  if (v == null || String(v).trim() === "") return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

await waitForWebapi();

if (deploySlashCommandsEnabled()) {
  console.log(
    "command-deployment: DEPLOY_SLASH_COMMANDS is set; clearing guild commands then registering …",
  );
  const del = spawnSync("node", ["delete-all-commands.js"], {
    cwd: appDir,
    stdio: "inherit",
  });
  if (del.status !== 0) {
    console.log(
      "command-deployment: Failed to delete all guild commands. Exiting.",
    );
    process.exit(del.status ?? 1);
  }
  const deploy = spawnSync("node", ["deploy-commands.js"], {
    cwd: appDir,
    stdio: "inherit",
  });
  if (deploy.status !== 0) {
    console.log(
      "command-deployment: Failed to deploy slash commands. Exiting.",
    );
    process.exit(deploy.status ?? 1);
  }
  console.log("command-deployment: Slash commands successfully deployed.");
} else {
  console.log(
    "command-deployment: Slash commands were not deployed (DEPLOY_SLASH_COMMANDS is not set).",
  );
}

const child = spawn("node", ["bot.js"], {
  cwd: appDir,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  console.log("Bot shutting down…");
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  // Format error details with stack trace if available
  let errorMsg = "BOT ERROR: ";
  if (error instanceof Error) {
    errorMsg += `${error.name}: ${error.message}\n${error.stack}`;
  } else {
    errorMsg += String(error);
  }
  console.log(errorMsg);
});
