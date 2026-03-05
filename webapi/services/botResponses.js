/**
 * Bot response logic using configured DB (mysql or sqlite via config/db.js).
 * Compatible with dixcord-bot tables: configurations, eight_ball_responses, link_replacements.
 * Trigger-based responses use the trigger-response API (triggers/responses/trigger_response).
 */

import db from "../config/db.js";
import { getAll as getLinkReplacements } from "./linkReplacements.js";

/**
 * Get all configuration rows.
 * @returns {Promise<Array<{ config: string, value: string }>>}
 */
export async function getAllConfigurations() {
  const [rows] = await db.query("SELECT config, value FROM configurations");
  return rows || [];
}

/**
 * Get a single config value by key, or null.
 * @param {Array<{ config: string, value: string }>} configs
 * @param {string} key
 * @returns {string|null}
 */
export function getConfigValue(configs, key) {
  const entry = configs.find((c) => c.config === key);
  return entry ? entry.value : null;
}

// --- Fortune teller (8-ball) ---

/** @private Bot DB may have typo column resoponse_string; we accept both. */
function fortuneResponseString(row) {
  return row.response_string ?? row.resoponse_string ?? "";
}

export async function getAllFortunes() {
  const [rows] = await db.query("SELECT * FROM eight_ball_responses");
  return rows || [];
}

export async function incrementFortune(fortuneRow) {
  if (!fortuneRow || fortuneRow.id == null) return;
  await db.query(
    "UPDATE eight_ball_responses SET frequency = frequency + 1 WHERE id = ?",
    [fortuneRow.id],
  );
}

/**
 * Random 8-ball style fortune.
 * @returns {Promise<{ response: string }>}
 */
export async function fortuneTeller() {
  const allFortunes = await getAllFortunes();
  if (allFortunes.length === 0) {
    return { response: "No fortunes configured." };
  }
  const fortune = allFortunes[Math.floor(Math.random() * allFortunes.length)];
  await incrementFortune(fortune);
  return { response: fortuneResponseString(fortune) };
}

// --- Twitter/social link fixer ---

/**
 * Fix social links in message; returns "fixed link: ..." or empty if not applicable.
 * @param {string} messageContents
 * @returns {Promise<{ response: string }>}
 */
export async function twitterFixer(messageContents) {
  const configs = await getAllConfigurations();
  const twitterFixEnabled =
    getConfigValue(configs, "twitter_fix_enabled") === "true";

  let reply = "";

  if (
    twitterFixEnabled &&
    messageContents &&
    (messageContents.includes(" dd") ||
      messageContents.includes(" dixbot") ||
      messageContents.includes(" fix"))
  ) {
    const replacements = await getLinkReplacements();
    const words = messageContents.split(" ");
    for (const word of words) {
      const clean = word.replace(/[<>]/g, "").replace(/www\./g, "");
      for (const { source_host, target_host } of replacements) {
        const prefix = "https://" + source_host;
        if (clean.startsWith(prefix)) {
          reply = "fixed link: " + clean.replace(source_host, target_host);
          break;
        }
      }
    }
  }

  return { response: reply };
}
