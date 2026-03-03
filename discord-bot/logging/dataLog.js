import { dataDirectory, isDev } from "../configVars.js";
import { execQuery } from "../database/queryRunner.js";
import { getAllLogFilterKeywords } from "../database/filters.js";

import fs from "fs";
import mysql from "mysql2";

let filterWordArray = await getAllLogFilterKeywords();
filterWordArray = filterWordArray.map((w) => {
  return w.keyword;
});

export const logPinnedMessage = (msgid) => {
  if (msgid) {
    const boolPreviouslyPinned =
      isMessageAlreadyPinned(msgid) > 0 ? true : false; // shouldnt 0 be falsy idk how js works im dumb

    if (!boolPreviouslyPinned) {
      const pinLogQry = mysql.format(
        "INSERT INTO pin_history (msgid) VALUES (?)",
        [msgid],
      );
      execQuery(pinLogQry);
    } else {
    }
  }
};

export const isMessageAlreadyPinned = async (msgid) => {
  var query = mysql.format(
    "SELECT * FROM pin_history WHERE msgid LIKE CONCAT('%' ? '%')",
    msgid,
  );
  const results = await execQuery(query);

  return results.length > 0;
};
