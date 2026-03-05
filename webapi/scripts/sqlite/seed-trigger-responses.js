/**
 * One-time seed: populates triggers, responses, and trigger_response from
 * triggers.txt and responses.txt at repo root. All triggers get selection_mode
 * 'random'; each trigger is linked to every response with weight 10.
 *
 * Run from webapi: npm run db:seed:trigger-responses
 * Requires: DB_FILE in .env (or defaults to ./data/api_template.sqlite)
 * Run db:setup:sqlite first to create tables.
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let Database;
try {
  const betterSqlite3 = await import("better-sqlite3");
  Database = betterSqlite3.default;
} catch (e) {
  console.error(
    "better-sqlite3 is not installed. Run: npm install better-sqlite3",
  );
  process.exit(1);
}

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

const dbPath =
  process.env.DB_FILE ||
  path.join(__dirname, "..", "..", "data", "api_template.sqlite");
console.log("db: SQLite database path:", dbPath);

const db = new Database(dbPath);

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

const insertTrigger = db.prepare(
  "INSERT INTO triggers (trigger_string, selection_mode) VALUES (?, 'random')",
);
const insertResponse = db.prepare(
  "INSERT INTO responses (response_string) VALUES (?)",
);
const insertLink = db.prepare(
  "INSERT INTO trigger_response (trigger_id, response_id, response_order, weight) VALUES (?, ?, NULL, 10)",
);

const seed = db.transaction(() => {
  const triggerIds = [];
  for (const trigger of triggers) {
    const r = insertTrigger.run(trigger);
    triggerIds.push(r.lastInsertRowid);
  }

  const responseIds = [];
  for (const response of responses) {
    const r = insertResponse.run(response);
    responseIds.push(r.lastInsertRowid);
  }

  for (const triggerId of triggerIds) {
    for (const responseId of responseIds) {
      insertLink.run(triggerId, responseId);
    }
  }

  return { triggers: triggerIds.length, responses: responseIds.length, links: triggerIds.length * responseIds.length };
});

const result = seed();
console.log(
  `Seed complete: ${result.triggers} triggers, ${result.responses} responses, ${result.links} trigger_response links.`,
);
db.close();
process.exit(0);
