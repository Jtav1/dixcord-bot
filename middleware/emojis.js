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
