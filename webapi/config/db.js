import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_TYPE = (process.env.DB_TYPE || "mysql").toLowerCase();
let db;

if (DB_TYPE === "sqlite") {
  const betterSqlite3 = await import("better-sqlite3");
  const Database = betterSqlite3.default;

  const dbPath =
    process.env.DB_FILE ||
    path.join(__dirname, "..", "data", "api_template.sqlite");

  const dataDir = path.dirname(dbPath);

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const sqliteDb = new Database(dbPath);

  // Auto-initialize schema if tables don't exist
  const tableExists = sqliteDb
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    )
    .get();
  if (!tableExists) {
    const schemaPath = path.join(__dirname, "..", "sql", "schema.sqlite.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    sqliteDb.exec(schema);
  }

  // Expose a mysql2-compatible query() that returns [rows] or [result]
  db = {
    query(sql, params = []) {
      const args = Array.isArray(params) ? params : [params];
      const trimmed = sql.trim().toUpperCase();
      const isSelect = trimmed.startsWith("SELECT");

      return new Promise((resolve, reject) => {
        try {
          const stmt = sqliteDb.prepare(sql);
          if (isSelect) {
            const rows = stmt.all(...args);
            resolve([rows]);
          } else {
            const result = stmt.run(...args);
            resolve([
              {
                insertId: result.lastInsertRowid,
                affectedRows: result.changes,
              },
            ]);
          }
        } catch (err) {
          reject(err);
        }
      });
    },
  };
} else {
  const mysql = await import("mysql2/promise");
  const pool = mysql.default.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "api_template",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  db = pool;
}

export default db;
