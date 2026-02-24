/**
 * Bot response logic using configured DB (mysql or sqlite via config/db.js).
 * Compatible with dixcord-bot tables: configurations, take_a_look_responses, eight_ball_responses.
 */

import db from "../config/db.js";

// In-memory rate limit for take-a-look (per process; matches bot behavior)
let takeALookLimit = 0;
let takeALookLastTimestamp = null;

/**
 * Get all configuration rows. Returns [{ config, value }, ...].
 */
export async function getAllConfigurations() {
  const [rows] = await db.query("SELECT config, value FROM configurations");
  return rows || [];
}

/**
 * Get a single config value by key, or null.
 */
export function getConfigValue(configs, key) {
  const entry = configs.find((c) => c.config === key);
  return entry ? entry.value : null;
}

// --- Take a look at this ---

export async function getAllTakeALookLinks() {
  const [rows] = await db.query(
    "SELECT id, link, isdefault, frequency FROM take_a_look_responses",
  );
  return rows || [];
}

export async function incrementTakeALookLink(linkRow) {
  if (!linkRow || linkRow.id == null) return;
  await db.query(
    "UPDATE take_a_look_responses SET frequency = frequency + 1 WHERE id = ?",
    [linkRow.id],
  );
}

/**
 * Returns { response: string } with either an image URL, "No spam!", or the spam image message.
 * Empty string means over limit (no reply).
 */
export async function takeALook() {
  const configs = await getAllConfigurations();
  const delayMs = parseInt(
    getConfigValue(configs, "take_a_look_delay") || "60000",
    10,
  );
  const configuredLimit = parseInt(
    getConfigValue(configs, "take_a_look_repost_limit") || "3",
    10,
  );
  const rareFrequency = parseFloat(
    getConfigValue(configs, "rare_frequency") || "0.1",
  );

  const links = await getAllTakeALookLinks();
  const commonArray = links.filter(
    (x) => x.isdefault === 1 || x.isdefault === "1",
  );
  const rareArray = links.filter(
    (x) => x.isdefault === 0 || x.isdefault === "0",
  );

  const now = Date.now();
  if (
    takeALookLastTimestamp == null ||
    (takeALookLastTimestamp &&
      Math.floor(now - takeALookLastTimestamp) >= delayMs)
  ) {
    takeALookLimit = 0;
    takeALookLastTimestamp = null;
  }

  const diceRoll = Math.random();

  if (takeALookLimit < configuredLimit) {
    takeALookLimit += 1;
    takeALookLastTimestamp = Date.now();
    const pool = diceRoll <= rareFrequency ? rareArray : commonArray;
    if (pool.length === 0) {
      return { response: "" };
    }
    const imgLink = pool[Math.floor(Math.random() * pool.length)];
    await incrementTakeALookLink(imgLink);
    return { response: imgLink.link || "" };
  }

  if (takeALookLimit === configuredLimit) {
    takeALookLimit += 1;
    takeALookLastTimestamp = Date.now();
    if (diceRoll <= rareFrequency / 2) {
      return { response: "https://i.imgur.com/kAClxb0.png no spam loolll" };
    }
    return { response: "No spam!" };
  }

  return { response: "" };
}

// --- Fortune teller (8-ball) ---

/** Bot DB may have typo column resoponse_string; we accept both. */
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
 * Returns { response: string } with a random fortune.
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
 * Returns { response: string } with "fixed link: ..." or empty if not applicable.
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
    const words = messageContents.split(" ");
    for (const word of words) {
      const clean = word.replace(/[<>]/g, "").replace(/www\./g, "");
      if (clean.startsWith("https://x.com")) {
        reply = "fixed link: " + clean.replace("x.com", "fixvx.com");
      } else if (clean.startsWith("https://instagram.com")) {
        reply =
          "fixed link: " + clean.replace("instagram.com", "jgram.jtav.me");
      } else if (clean.startsWith("https://twitter.com")) {
        reply = "fixed link: " + clean.replace("twitter.com", "fixvx.com");
      } else if (clean.startsWith("https://tiktok.com")) {
        reply = "fixed link: " + clean.replace("tiktok.com", "vxtiktok.com");
      } else if (clean.startsWith("https://bsky.app")) {
        reply = "fixed link: " + clean.replace("bsky.app", "bskx.app");
      }
    }
  }

  return { response: reply };
}
