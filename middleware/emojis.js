import { parseEmoji } from "discord.js";
import { execQuery } from "../database/queryRunner.js";

import mysql from "mysql2";

//Import emojis into database by checking what the server has, clearing out all un-incremented emoji entries
//and then inserting all
export const importEmojiList = async (emojiObjectList) => {
  let emojiArray = [];

  emojiObjectList.forEach((e) => {
    emojiArray.push([`${e.id}`, `${e.name}`, 0, e.animated, `${e.type}`]);
  });

  await execQuery(
    "DELETE FROM emoji_frequency WHERE frequency = 0 and type = 'emoji'"
  );

  if (emojiArray.length < 2) emojiArray = [emojiArray];

  const emoInsertQry = mysql.format(
    "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES ? ON DUPLICATE KEY UPDATE emoid=emoid",
    [emojiArray]
  );

  await execQuery(emoInsertQry);
  console.log("db: emoji import complete");
};

export const countEmoji = async (emoji, userid = null) => {
  const emoCleaned = parseEmoji(emoji);

  if (emoCleaned) {
    const emoIncrementQry = mysql.format(
      "UPDATE emoji_frequency SET frequency = frequency + 1 WHERE emoji = ? AND emoid = ?",
      [emoCleaned.name, emoCleaned.id]
    );

    execQuery(emoIncrementQry);
  }

  if (emoCleaned.id && userid) {
    const userEmoQuery = mysql.format(
      "INSERT INTO user_emoji_tracking (userid, emoid) VALUES (?, ?) ON DUPLICATE KEY UPDATE frequency = frequency + 1",
      [userid, emoCleaned.id]
    );

    const emoExistsQuery = mysql.format(
      "SELECT 1 FROM emoji_frequency WHERE emoji_frequency.emoid = ?",
      [emoCleaned.id]
    );

    const count = await execQuery(emoExistsQuery);

    if (count.length > 0) {
      console.log("counting");
      execQuery(userEmoQuery);
    }
  }
};

export const getTopEmoji = async (number) => {
  let res = [];

  var query = mysql.format(
    "SELECT emoji, frequency, emoid, animated FROM emoji_frequency ORDER BY frequency DESC LIMIT ?",
    [number]
  );

  try {
    const results = await execQuery(query);
    res = results;
  } catch (e) {
    console.err(e);
  }
  return res;
};
