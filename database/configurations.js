import { execQuery } from "./queryRunner.js";

import mysql from "mysql2";

export const getAllConfigurations = async () => {
  var query = mysql.format("SELECT * FROM configurations");
  return await execQuery(query);
};

export const addConfiguration = async (config, value) => {
  const query = mysql.format(
    "INSERT IGNORE INTO configurations (config, value) VALUES ?",
    [[[config, value]]]
  );

  console.log(query);

  return await execQuery(query);
};

export const updateConfigurationByName = async (config, value) => {
  const query = mysql.format(
    "UPDATE configurations SET VALUE = ? WHERE config = ?",
    [value, config]
  );

  return await execQuery(query);
};
