import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { inspect } from "node:util";

const LOG_PATH = path.join("data", "discord-bot.log");
const logToFile = isTruthy(process.env.log_to_file);

/**
 * Whether an env value is treated as enabled (true, 1, yes).
 * @param {string | undefined} value
 * @returns {boolean}
 */
function isTruthy(value) {
  if (value == null || value === "") return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/**
 * Serialize log arguments for file lines.
 * @param {unknown[]} args
 * @returns {string}
 */
function formatArgs(args) {
  return args
    .map((arg) => (typeof arg === "string" ? arg : inspect(arg)))
    .join(" ");
}

/**
 * Append a formatted log line to the service log file.
 * @param {"log" | "error" | "warn"} level
 * @param {unknown[]} args
 * @returns {void}
 */
function append(level, args) {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${formatArgs(args)}\n`;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, line);
}

/**
 * Log to console; append to ./data/discord-bot.log when log_to_file is enabled.
 * @param {...*} args - Values passed like console.log
 * @returns {void}
 */
export function output(...args) {
  console.log(...args);
  if (logToFile) append("log", args);
}

/**
 * Log an error to console; append to file when log_to_file is enabled.
 * @param {...*} args - Values passed like console.error
 * @returns {void}
 */
output.error = (...args) => {
  console.error(...args);
  if (logToFile) append("error", args);
};

/**
 * Log a warning to console; append to file when log_to_file is enabled.
 * @param {...*} args - Values passed like console.warn
 * @returns {void}
 */
output.warn = (...args) => {
  console.warn(...args);
  if (logToFile) append("warn", args);
};
