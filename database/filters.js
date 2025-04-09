import { execQuery } from "./queryRunner.js";

import mysql from "mysql2";

export const getAllLogFilterKeywords = async () => {
  var query = mysql.format("SELECT * FROM log_filter_keywords");
  return await execQuery(query);
};

export const insertLogFilterKeyword = async (keyword) => {
  const query = mysql.format(
    "INSERT IGNORE INTO log_filter_keywords (keyword) VALUES ",
    [keyword]
  );

  return await execQuery(query);
};

export const removeLogFilterKeyword = async (keyword) => {
  const query = mysql.format(
    "DELETE FROM log_filter_keywords WHERE keyword = ?",
    [keyword]
  );

  return await execQuery(query);
};
