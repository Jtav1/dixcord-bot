import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultFilesRoot = path.resolve(moduleDir, "../../../webview/files");

/**
 * Absolute path to the shared emoji/sticker files root (`webview/files` by default) — the same
 * directory webview serves images from.
 * @returns {string}
 */
export function getEmojiFilesRoot() {
  return process.env.EMOJI_FILES_DIR
    ? path.resolve(process.env.EMOJI_FILES_DIR)
    : defaultFilesRoot;
}

/**
 * Run async mapper over items with at most `concurrency` in flight at once.
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<R>} mapper
 * @returns {Promise<R[]>}
 */
export async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await mapper(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/**
 * Download a URL to a relative path under the emoji files root, skipping if a file is already
 * there (never overwrite — a different guild's same-named emoji may have put it there first).
 * @param {string} url
 * @param {string} relativePath
 * @returns {Promise<string|null>} the relative path on success (download or already-present), null on failure
 */
async function downloadIfAbsent(url, relativePath) {
  const root = getEmojiFilesRoot();
  const fullPath = path.join(root, relativePath);

  try {
    await fs.access(fullPath);
    return relativePath;
  } catch {
    // doesn't exist yet, fall through to download
  }

  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }
    await pipeline(response.body, createWriteStream(fullPath));
    return relativePath;
  } catch (err) {
    console.error(`bot: failed to download emoji/sticker image ${url}:`, err.message);
    return null;
  }
}

/**
 * Download a custom emoji's image into `Emojis/`.
 * @param {{ name: string, animated: boolean, url: string }} emoji
 * @returns {Promise<string|null>} relative path (e.g. `"Emojis/partyparrot.gif"`), or null on failure
 */
export async function downloadEmojiImage({ name, animated, url }) {
  const ext = animated ? "gif" : "png";
  return downloadIfAbsent(url, `Emojis/${name}.${ext}`);
}

/**
 * Discord sticker format values whose image is a raster we can download (PNG/APNG/GIF). Lottie
 * stickers are a JSON animation, not an image — skip them.
 */
const RASTER_STICKER_EXTENSIONS = { 1: "png", 2: "png", 4: "gif" }; // PNG, APNG, GIF (discord-api-types StickerFormatType)

/**
 * Download a sticker's image into `Stickers/`, skipping Lottie stickers (no raster image exists).
 * @param {{ name: string, format: number, url: string }} sticker
 * @returns {Promise<string|null>} relative path (e.g. `"Stickers/wave.png"`), or null if skipped/failed
 */
export async function downloadStickerImage({ name, format, url }) {
  const ext = RASTER_STICKER_EXTENSIONS[format];
  if (!ext) return null;
  return downloadIfAbsent(url, `Stickers/${name}.${ext}`);
}
