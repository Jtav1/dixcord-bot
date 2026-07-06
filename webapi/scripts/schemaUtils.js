/**
 * Schema introspection helpers for idempotent migrations.
 * Use before CREATE TABLE, ALTER TABLE, ADD CONSTRAINT, and CREATE INDEX.
 */

/**
 * @param {string} [dbType]
 * @returns {boolean}
 */
export function isSqliteDb(dbType = process.env.DB_TYPE) {
  return (dbType || "mysql").toLowerCase() === "sqlite";
}

/**
 * @param {import('mysql2/promise').Pool | { query: Function }} db
 * @param {string} table
 * @param {boolean} isSqlite
 * @returns {Promise<boolean>}
 */
export async function tableExists(db, table, isSqlite) {
  if (isSqlite) {
    const [rows] = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table],
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  const [rows] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [table],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * @param {import('mysql2/promise').Pool | { query: Function }} db
 * @param {string} table
 * @param {string} column
 * @param {boolean} isSqlite
 * @returns {Promise<boolean>}
 */
export async function columnExists(db, table, column, isSqlite) {
  if (isSqlite) {
    try {
      await db.query(`SELECT "${column}" FROM ${table} LIMIT 0`);
      return true;
    } catch {
      return false;
    }
  }
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

/**
 * @param {import('mysql2/promise').Pool | { query: Function }} db
 * @param {string} table
 * @param {string} constraintName
 * @param {boolean} isSqlite
 * @returns {Promise<boolean>}
 */
export async function constraintExists(db, table, constraintName, isSqlite) {
  if (isSqlite) return false;
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [table, constraintName],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

/**
 * @param {import('mysql2/promise').Pool | { query: Function }} db
 * @param {string} table
 * @param {string} column
 * @param {string} referencedTable
 * @param {boolean} isSqlite
 * @returns {Promise<boolean>}
 */
export async function foreignKeyExists(
  db,
  table,
  column,
  referencedTable,
  isSqlite,
) {
  if (isSqlite) {
    const [rows] = await db.query(`PRAGMA foreign_key_list(${table})`);
    return (
      Array.isArray(rows) &&
      rows.some((row) => row.from === column && row.table === referencedTable)
    );
  }
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME = ?`,
    [table, column, referencedTable],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

/**
 * @param {import('mysql2/promise').Pool | { query: Function }} db
 * @param {string} table
 * @param {string} indexName
 * @param {boolean} isSqlite
 * @returns {Promise<boolean>}
 */
export async function indexExists(db, table, indexName, isSqlite) {
  if (isSqlite) {
    const [rows] = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name = ?",
      [table, indexName],
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [table, indexName],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

/**
 * @param {import('better-sqlite3').Database} sqliteDb
 * @param {string} table
 * @param {string} column
 * @returns {boolean}
 */
export function columnExistsSync(sqliteDb, table, column) {
  const info = sqliteDb.prepare(`PRAGMA table_info(${table})`).all();
  return Array.isArray(info) && info.some((c) => c.name === column);
}

/**
 * @param {import('better-sqlite3').Database} sqliteDb
 * @param {string} table
 * @returns {boolean}
 */
export function tableExistsSync(sqliteDb, table) {
  const row = sqliteDb
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(table);
  return row != null;
}

/**
 * @param {import('better-sqlite3').Database} sqliteDb
 * @param {string} table
 * @param {string} indexName
 * @returns {boolean}
 */
export function indexExistsSync(sqliteDb, table, indexName) {
  const row = sqliteDb
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name = ?",
    )
    .get(table, indexName);
  return row != null;
}
