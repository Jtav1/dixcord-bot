/**
 * Link replacements (source host -> target host) for the twitter/social fixer.
 * CRUD and lookup using config/db.js.
 */

import db from "../config/db.js";

/** Hostname pattern for link replacement hosts (no scheme, path, or port). */
const LINK_HOST_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Validate a link replacement hostname.
 * @param {string} host Hostname string.
 * @param {"source"|"target"} kind Which field is being validated.
 * @returns {string|null} Error message, or null when valid.
 */
export function validateLinkReplacementHost(host, kind) {
  const value = String(host ?? "").trim().toLowerCase();
  if (!value) return `${kind}_host is required`;
  if (value.includes("://") || value.includes("/") || value.includes(":")) {
    return `${kind}_host must be a hostname without scheme, path, or port`;
  }
  if (!LINK_HOST_RE.test(value)) {
    return `${kind}_host is not a valid hostname`;
  }
  if (kind === "target" && (value === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(value))) {
    return "target_host cannot be localhost or an IP address";
  }
  return null;
}

/**
 * @returns {Promise<Array<{ id: number, source_host: string, target_host: string }>>}
 */
export async function getAll() {
  const [rows] = await db.query(
    "SELECT id, source_host, target_host FROM link_replacements ORDER BY source_host"
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} id
 * @returns {Promise<{ id: number, source_host: string, target_host: string }|null>}
 */
export async function getById(id) {
  const [rows] = await db.query(
    "SELECT id, source_host, target_host FROM link_replacements WHERE id = ?",
    [id]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * @param {string} source_host
 * @param {string} target_host
 * @returns {Promise<number|null>} Insert id
 */
export async function create(source_host, target_host) {
  const [result] = await db.query(
    "INSERT INTO link_replacements (source_host, target_host) VALUES (?, ?)",
    [source_host, target_host]
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {number} id
 * @param {{ source_host?: string, target_host?: string }} updates
 * @returns {Promise<boolean>}
 */
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

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function remove(id) {
  const [result] = await db.query(
    "DELETE FROM link_replacements WHERE id = ?",
    [id]
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
