import { execQuery } from "../database/queryRunner.js";
import mysql from "mysql2";

export const updateKeywordUsage = async (
  keyword,
  userid = null,
  msgid = null
) => {
  if (keyword) {
    const keywordQuery = mysql.format(
      "UPDATE user_keyword_tracking SET userid = ?, msgid = ?, timestamp = current_timestamp WHERE keyword = ?",
      [userid, msgid, keyword]
    );

    await execQuery(keywordQuery);
  }
};

export const trackNewKeyword = async (keyword) => {
  if (keyword) {
    const keywordInsertQuery = mysql.format(
      "INSERT INTO user_keyword_tracking (keyword) SELECT ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM user_keyword_tracking WHERE keyword = ?)",
      [keyword, keyword]
    );

    await execQuery(keywordInsertQuery);
  }
};

export const getKeywordUsage = async (keyword) => {
  let res = null;

  const query = mysql.format(
    "SELECT timestamp, userid, msgid FROM user_keyword_tracking WHERE keyword = ?",
    [keyword]
  );

  try {
    const results = await execQuery(query);
    if (results.length > 0) {
      res = {
        timestamp: results[0].timestamp,
        userid: results[0].userid,
        msgid: results[0].msgid,
      };
    }
  } catch (e) {
    console.error(e);
  }
  return res;
};

export const getAllKeywords = async () => {
  const query = mysql.format("SELECT keyword FROM user_keyword_tracking");
  try {
    const results = await execQuery(query);
    return results;
  } catch (e) {
    console.error(e);
    return [];
  }
};
