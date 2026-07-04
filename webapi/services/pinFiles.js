import path from "node:path";

/**
 * Absolute path to the shared pin attachment files root.
 * @returns {string}
 */
export function getPinFilesRoot() {
  if (process.env.PIN_FILES_DIR) {
    return path.resolve(process.env.PIN_FILES_DIR);
  }
  return path.resolve(process.cwd(), "../discord-bot/files");
}

/**
 * Parse comma-separated relative paths stored in `pin_history.attachments`.
 * @param {string|null|undefined} stored
 * @returns {string[]}
 */
export function parseAttachmentPaths(stored) {
  if (stored == null || String(stored).trim() === "") return [];
  return String(stored)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Resolve a relative attachment path to an absolute filesystem path.
 * @param {string} relativePath - Path relative to `files/` (e.g. `images/123-0.png`)
 * @returns {string}
 */
export function resolvePinAttachmentPath(relativePath) {
  const rel = String(relativePath ?? "").trim().replace(/^\/+/, "");
  if (!rel || rel.includes("..")) {
    throw new Error("Invalid attachment path");
  }
  return path.join(getPinFilesRoot(), rel);
}

/**
 * Normalize attachment paths from API input for database storage.
 * @param {unknown} value - Comma-separated string or string array
 * @returns {string|null}
 */
export function normalizeAttachmentPathsForStorage(value) {
  if (value == null || value === "") return null;

  const parts = Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : String(value)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

  if (parts.length === 0) return null;

  for (const part of parts) {
    if (part.includes("..") || path.isAbsolute(part)) {
      throw new Error("Invalid attachment path");
    }
  }

  return parts.join(",");
}
