/**
 * One-time seed: populates triggers, responses, and trigger_response from
 * triggers.txt and responses.txt at repo root. All triggers get selection_mode
 * 'random'; each trigger is linked to every response with weight 10.
 *
 * Run from webapi: npm run db:seed:trigger-responses:mysql
 * Requires: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env
 * Run db:setup:mysql first to create tables.
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const repoRoot = path.join(__dirname, "..", "..", "..");
const triggersPath = path.join(repoRoot, "triggers.txt");
const responsesPath = path.join(repoRoot, "responses.txt");

if (!fs.existsSync(triggersPath)) {
  console.error("Missing file:", triggersPath);
  process.exit(1);
}
if (!fs.existsSync(responsesPath)) {
  console.error("Missing file:", responsesPath);
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "api_template",
  waitForConnections: true,
  connectionLimit: 5,
});

function parseTriggers(content) {
  return content
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseResponses(content) {
  return content
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/^\*+/, ""))
    .filter(Boolean);
}

const triggersRaw = fs.readFileSync(triggersPath, "utf8");
const responsesRaw = fs.readFileSync(responsesPath, "utf8");
const triggers = parseTriggers(triggersRaw);
const responses = parseResponses(responsesRaw);

if (triggers.length === 0) {
  console.error("No triggers found in", triggersPath);
  process.exit(1);
}
if (responses.length === 0) {
  console.error("No responses found in", responsesPath);
  process.exit(1);
}

async function seed() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const triggerIds = [];
    for (const trigger of triggers) {
      const [result] = await connection.query(
        "INSERT INTO triggers (trigger_string, selection_mode) VALUES (?, 'random')",
        [trigger],
      );
      triggerIds.push(result.insertId);
    }

    const responseIds = [];
    for (const response of responses) {
      const [result] = await connection.query(
        "INSERT INTO responses (response_string) VALUES (?)",
        [response],
      );
      responseIds.push(result.insertId);
    }

    for (const triggerId of triggerIds) {
      for (const responseId of responseIds) {
        await connection.query(
          "INSERT INTO trigger_response (trigger_id, response_id, response_order, weight) VALUES (?, ?, \"random\", 10)",
          [triggerId, responseId],
        );
      }
    }

    await connection.commit();
    return {
      triggers: triggerIds.length,
      responses: responseIds.length,
      links: triggerIds.length * responseIds.length,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

seed()
  .then((result) => {
    console.log(
      `Seed complete: ${result.triggers} triggers, ${result.responses} responses, ${result.links} trigger_response links.`,
    );
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
