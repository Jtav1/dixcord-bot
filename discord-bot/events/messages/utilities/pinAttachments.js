import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultFilesRoot = path.resolve(moduleDir, "../../../files");

/**
 * Absolute path to the shared pin attachment files root (`discord-bot/files` by default).
 * @returns {string}
 */
export function getPinFilesRoot() {
  return process.env.PIN_FILES_DIR
    ? path.resolve(process.env.PIN_FILES_DIR)
    : defaultFilesRoot;
}

/**
 * Choose images, videos, or other subdirectory from a MIME type.
 * @param {string|null|undefined} contentType
 * @returns {"images"|"videos"|"other"}
 */
export function getAttachmentSubdir(contentType) {
  const ct = String(contentType ?? "").toLowerCase();
  if (ct.startsWith("image/")) return "images";
  if (ct.startsWith("video/")) return "videos";
  return "other";
}

/**
 * Sanitize a file extension from an attachment filename.
 * @param {string|null|undefined} name
 * @returns {string}
 */
function extensionFromName(name) {
  const ext = path.extname(String(name ?? "")).slice(0, 32);
  return ext.replace(/[^a-zA-Z0-9.]/g, "") || "";
}

/**
 * Download Discord message attachments into `files/{images|videos|other}/`.
 * @param {import("discord.js").Collection<string, import("discord.js").Attachment>} attachments
 * @param {string} messageId
 * @returns {Promise<string[]>} Relative paths under `files/` (e.g. `["images/123-0.png"]`)
 */
export async function savePinAttachments(attachments, messageId) {
  if (!attachments || attachments.size === 0) return [];

  const root = getPinFilesRoot();
  const relativePaths = [];
  let index = 0;

  for (const attachment of attachments.values()) {
    const subdir = getAttachmentSubdir(attachment.contentType);
    const filename = `${messageId}-${index}${extensionFromName(attachment.name)}`;
    const relativePath = `${subdir}/${filename}`;
    const fullPath = path.join(root, relativePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const response = await fetch(attachment.url);
    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to download attachment ${attachment.id}: HTTP ${response.status}`,
      );
    }

    await pipeline(response.body, createWriteStream(fullPath));
    relativePaths.push(relativePath);
    index += 1;
  }

  return relativePaths;
}

/**
 * Serialize relative attachment paths for `pin_history.attachments`.
 * @param {string[]} relativePaths
 * @returns {string|null}
 */
export function serializeAttachmentPaths(relativePaths) {
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) return null;
  return relativePaths.join(",");
}
