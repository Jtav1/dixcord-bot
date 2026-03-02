/**
 * Link replacements (source host -> target host) for the twitter/social fixer.
 * CRUD and lookup using config/db.js.
 */

import db from "../config/db.js";

export async function getAll() {
  const [rows] = await db.query(
    "SELECT id, source_host, target_host FROM link_replacements ORDER BY source_host"
  );
  return Array.isArray(rows) ? rows : [];
}

export async function getById(id) {
  const [rows] = await db.query(
    "SELECT id, source_host, target_host FROM link_replacements WHERE id = ?",
    [id]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function create(source_host, target_host) {
  const [result] = await db.query(
    "INSERT INTO link_replacements (source_host, target_host) VALUES (?, ?)",
    [source_host, target_host]
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

export async function update(id, { source_host, target_host }) {
  const updates = [];
  const values = [];
  if (source_host !== undefined) {
    updates.push("source_host = ?");
    values.push(source_host);
  }
  if (target_host !== undefined) {
    updates.push("target_host = ?");
    values.push(target_host);
  }
  if (updates.length === 0) return false;
  values.push(id);
  const [result] = await db.query(
    `UPDATE link_replacements SET ${updates.join(", ")} WHERE id = ?`,
    values
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

export async function remove(id) {
  const [result] = await db.query(
    "DELETE FROM link_replacements WHERE id = ?",
    [id]
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
