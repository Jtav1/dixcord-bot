import {
  mysqlHost,
  mysqlPort,
  mysqlUser,
  mysqlPw,
  mysqlDb,
  isDev,
} from "../configVars.js";

import mysql from "mysql2";

var con = mysql.createPool({
  host: mysqlHost,
  port: mysqlPort,
  user: mysqlUser,
  password: mysqlPw,
  database: mysqlDb,
});

con.on("connection", function (connection) {
  connection.on("error", function (err) {
    console.error(new Date(), "db: Import MySQL error", err.code);
  });
  connection.on("close", function (err) {
    console.error(new Date(), "db: Import MySQL close", err);
  });
});

con.addListener("error", (err) => {
  console.error(new Date(), "db: Import MySQL listener error", err);
});

export const execQuery = async (query) => {
  try {
    const [rows] = await con.promise().query(query);
    if (isDev) {
      //console.log("db: query successful: " + query.substring(0, 50) + "...");
    }
    return rows;
  } catch (err) {
    console.log("db: table create query error", err);
    console.log(query);
    return [];
  }
};
