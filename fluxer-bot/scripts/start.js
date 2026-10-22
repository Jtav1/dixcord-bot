import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { waitForWebapi } from "./wait-for-webapi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

await waitForWebapi();

// No slash-command deploy step yet — commands/ is empty until the first feature is ported.

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
  let errorMsg = "BOT ERROR: ";
  if (error instanceof Error) {
    errorMsg += `${error.name}: ${error.message}\n${error.stack}`;
  } else {
    errorMsg += String(error);
  }
  console.log(errorMsg);
});
