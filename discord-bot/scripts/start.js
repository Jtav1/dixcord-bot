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
    "start: DEPLOY_SLASH_COMMANDS is set; clearing guild commands then registering …",
  );
  const del = spawnSync("node", ["delete-all-commands.js"], {
    cwd: appDir,
    stdio: "inherit",
  });
  if (del.status !== 0) {
    process.exit(del.status ?? 1);
  }
  const deploy = spawnSync("node", ["deploy-commands.js"], {
    cwd: appDir,
    stdio: "inherit",
  });
  if (deploy.status !== 0) {
    process.exit(deploy.status ?? 1);
  }
}

const child = spawn("node", ["bot.js"], {
  cwd: appDir,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
