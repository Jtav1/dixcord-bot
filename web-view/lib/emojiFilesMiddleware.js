import fs from "fs";
import path from "path";

/**
 * Locate the emoji assets directory under a files root, matching folder name case-insensitively.
 * @param {string} filesRoot Absolute path to the files directory.
 * @returns {string|null} Absolute path to the emoji directory, or null when missing.
 */
function resolveEmojisDir(filesRoot) {
  try {
    const entries = fs.readdirSync(filesRoot, { withFileTypes: true });
    const match = entries.find(
      (entry) => entry.isDirectory() && entry.name.toLowerCase() === "emojis",
    );
    if (!match) return null;
    return path.join(filesRoot, match.name);
  } catch {
    return null;
  }
}

/**
 * Build a lowercase lookup map for emoji image filenames.
 * @param {string} filesRoot Absolute path to the files directory.
 * @returns {{ dirName: string, index: Map<string, string> }}
 */
function buildEmojiFileIndex(filesRoot) {
  const emojisDir = resolveEmojisDir(filesRoot);
  if (!emojisDir) {
    return { dirName: "Emojis", index: new Map() };
  }

  const dirName = path.basename(emojisDir);
  const index = new Map();

  for (const entry of fs.readdirSync(emojisDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const relativePath = `${dirName}/${entry.name}`;
    index.set(relativePath.toLowerCase(), relativePath);
  }

  return { dirName, index };
}

/**
 * Create middleware that serves /files/Emojis/* with case-insensitive filename matching.
 * Falls through to the provided static handler for all other /files requests.
 * @param {string} filesRoot Absolute path to the files directory.
 * @param {import("express").RequestHandler} staticHandler express.static middleware for filesRoot.
 * @returns {import("express").RequestHandler}
 */
export function createCaseInsensitiveEmojiFilesMiddleware(filesRoot, staticHandler) {
  let { index } = buildEmojiFileIndex(filesRoot);

  return (req, res, next) => {
    const requestPath = decodeURIComponent((req.path || req.url || "").split("?")[0]);
    const match = requestPath.match(/^\/Emojis\/(.+)$/i);

    if (!match) {
      staticHandler(req, res, next);
      return;
    }

    const requestedFile = match[1];
    const resolved = index.get(`emojis/${requestedFile}`.toLowerCase());

    if (resolved) {
      req.url = `/${resolved}`;
      staticHandler(req, res, next);
      return;
    }

    if (index.size === 0) {
      ({ index } = buildEmojiFileIndex(filesRoot));
      const retryResolved = index.get(`emojis/${requestedFile}`.toLowerCase());
      if (retryResolved) {
        req.url = `/${retryResolved}`;
        staticHandler(req, res, next);
        return;
      }
    }

    staticHandler(req, res, next);
  };
}
