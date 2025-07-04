import { parseEmoji } from "discord.js";
import { execQuery } from "./queryRunner.js";

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

export const countEmoji = async (emojiName, emojiId, userid = null) => {
  const emoIncrementQry = mysql.format(
    "UPDATE emoji_frequency SET frequency = frequency + 1 WHERE emoji = ? AND emoid = ?",
    [emojiName, emojiId]
  );

  await execQuery(emoIncrementQry);

  if (emojiId && userid) {
    const userEmoQuery = mysql.format(
      "INSERT INTO user_emoji_tracking (userid, emoid) VALUES (?, ?) ON DUPLICATE KEY UPDATE frequency = frequency + 1",
      [userid, emojiId]
    );

    const emoExistsQuery = mysql.format(
      "SELECT 1 FROM emoji_frequency WHERE emoji_frequency.emoid = ?",
      [emojiId]
    );

    const count = await execQuery(emoExistsQuery);

    if (count.length > 0) {
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

export const countRepost = async (userid, msgid, accuserid) => {
  if (msgid && userid && accuserid) {
    const userRepostQuery = mysql.format(
      "INSERT INTO user_repost_tracking (userid, msgid, accuser) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM user_repost_tracking WHERE userid = ? and msgid = ? and accuser = ?)",
      [userid, msgid, accuserid, userid, msgid, accuserid]
    );
    execQuery(userRepostQuery);
  }
};

export const uncountRepost = async (msgid, accuserid) => {
  if (msgid && accuserid) {
    const deleteRepostQuery = mysql.format(
      "DELETE FROM user_repost_tracking WHERE msgid = ? and accuser = ?",
      [msgid, accuserid]
    );
    execQuery(deleteRepostQuery);
  }
};

export const getTopReposters = async (number) => {
  let res = [];

  var query = mysql.format(
    "SELECT count(userid) as 'count', userid FROM user_repost_tracking GROUP BY userid ORDER BY count(userid) DESC LIMIT ?",
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

export const getRepostsForUser = async (userid) => {
  let res = [];

  var query = mysql.format(
    "SELECT count(userid) as 'count', userid FROM user_repost_tracking WHERE userid = ?",
    [userid]
  );

  try {
    const results = await execQuery(query);
    res = results[0].count;
  } catch (e) {
    console.err(e);
  }
  return res;
};
