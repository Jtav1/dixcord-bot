import { execQuery } from "../database/queryRunner.js";

import mysql from "mysql2";

export const plusplus = async (string, typestr, voterid) => {
  if (typestr && string && voterid) {
    const plusplusQuery = mysql.format(
      "INSERT INTO plusplus_tracking (type, string, voter, value) VALUES (?, ?, ?, ?)",
      [typestr, string, voterid, 1]
    );
    execQuery(plusplusQuery);
  }
};

export const minusminus = async (string, typestr, voterid) => {
  if (typestr && string && voterid) {
    const plusplusQuery = mysql.format(
      "INSERT INTO plusplus_tracking (type, string, voter, value) VALUES (?, ?, ?, ?)",
      [typestr, string, voterid, -1]
    );
    execQuery(plusplusQuery);
  }
};

export const getTotalScoreByString = async (string, typestr) => {
  let res = [];

  var query = mysql.format(
    "SELECT SUM(value) as total FROM plusplus_tracking WHERE string = ? AND type = ?",
    [string, typestr]
  );

  try {
    const results = await execQuery(query);
    res = results;
  } catch (e) {
    console.err(e);
  }
  return res;
};

export const getTopScores = async (number) => {
  let res = [];

  var query = mysql.format(
    "SELECT string, type as typestr, SUM(value) as total FROM plusplus_tracking GROUP BY string ORDER BY total DESC LIMIT ?",
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

export const getBottomScores = async (number) => {
  let res = [];

  var query = mysql.format(
    "SELECT string, type as typestr, SUM(value) as total FROM plusplus_tracking GROUP BY string ORDER BY total ASC LIMIT ?",
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

export const getVotesById = async (voterid) => {
  let res = [];

  var query = mysql.format(
    "SELECT COUNT(*) as total FROM plusplus_tracking WHERE voter = ?",
    [voterid]
  );

  try {
    const results = await execQuery(query);
    res = results;
  } catch (e) {
    console.err(e);
  }
  return res;
};

export const getTopVoters = async (number) => {
  let res = [];

  var query = mysql.format(
    "SELECT voter, COUNT(*) as total FROM plusplus_tracking GROUP BY voter ORDER BY total DESC LIMIT ?",
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