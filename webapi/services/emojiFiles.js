import fs from "node:fs/promises";
import path from "node:path";

import db from "../config/db.js";

/**
 * Absolute path to the shared emoji/sticker files root — the same directory webview serves
 * images from (`guild_emojis.image_path` is relative to this root).
 * @returns {string}
 */
export function getEmojiFilesRoot() {
  if (process.env.EMOJI_FILES_DIR) {
    return path.resolve(process.env.EMOJI_FILES_DIR);
  }
  return path.resolve(process.cwd(), "../webview/files");
}

/**
 * Best-effort delete each given `guild_emojis.image_path`, but only if no row still references
 * it — the same filename can be shared across rows (webview's lookup is name-keyed, so two
 * differently-guilded emoji with the same name point at one file). Never throws; logs failures.
 * @param {Array<string|null|undefined>} imagePaths - candidate paths whose owning row(s) were just deleted
 * @returns {Promise<void>}
 */
export async function deleteOrphanedImageFiles(imagePaths) {
  const distinct = [...new Set(imagePaths.filter((p) => p != null && p !== ""))];
  if (distinct.length === 0) return;

  const root = getEmojiFilesRoot();
  for (const imagePath of distinct) {
    const [rows] = await db.query(
      "SELECT 1 FROM guild_emojis WHERE image_path = ? LIMIT 1",
      [imagePath],
    );
    if (rows && rows.length > 0) continue;

    try {
      await fs.unlink(path.join(root, imagePath));
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error(`webapi: failed to delete orphaned emoji image ${imagePath}:`, err.message);
      }
    }
  }
}
