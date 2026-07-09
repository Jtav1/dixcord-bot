import path from "path";
import {
  buildEmojiFileIndex,
  resolveEmojisDir,
} from "./emojiFilesMiddleware.js";
import {
  getWebapiAuthHeader,
  requireWebviewCredentials,
} from "./webapiAuth.js";

const EMOJI_PAGE_SIZE = 50;

/**
 * Whether a leaderboard row is a custom Discord emoji (numeric emoid).
 * @param {{ emoid?: string|number }} row Emoji leaderboard row.
 * @returns {boolean}
 */
function isCustomDiscordEmoji(row) {
  return !Number.isNaN(Number(row?.emoid));
}

/**
 * File extension for a custom emoji image from its animated flag.
 * @param {number|boolean} animated Animated flag from emoji_frequency.
 * @returns {"gif"|"png"}
 */
function emojiImageExtension(animated) {
  return animated ? "gif" : "png";
}

/**
 * Resolve the expected absolute path for a custom emoji image on disk.
 * @param {string} filesRoot Absolute path to the web-view files directory.
 * @param {{ emoji?: string, animated?: number|boolean }} row Emoji leaderboard row.
 * @returns {string} Expected absolute file path (canonical Emojis folder name).
 */
export function expectedEmojiImageAbsolutePath(filesRoot, row) {
  const name = String(row.emoji ?? "");
  const ext = emojiImageExtension(row.animated);
  const emojisDir = resolveEmojisDir(filesRoot);
  const dirName = emojisDir ? path.basename(emojisDir) : "Emojis";
  return path.resolve(filesRoot, dirName, `${name}.${ext}`);
}

/**
 * Check whether a custom emoji image exists on disk (case-insensitive filename match).
 * @param {string} filesRoot Absolute path to the web-view files directory.
 * @param {{ emoji?: string, animated?: number|boolean }} row Emoji leaderboard row.
 * @returns {{ found: boolean, expectedPath: string, resolvedPath: string|null }}
 */
export function resolveEmojiImageOnDisk(filesRoot, row) {
  const name = String(row.emoji ?? "");
  const ext = emojiImageExtension(row.animated);
  const expectedPath = expectedEmojiImageAbsolutePath(filesRoot, row);
  const { index } = buildEmojiFileIndex(filesRoot);
  const relativeKey = `emojis/${name}.${ext}`.toLowerCase();
  const resolvedRelative = index.get(relativeKey);

  if (!resolvedRelative) {
    return { found: false, expectedPath, resolvedPath: null };
  }

  const resolvedPath = path.resolve(
    filesRoot,
    ...resolvedRelative.split("/"),
  );
  return { found: true, expectedPath, resolvedPath };
}

/**
 * Fetch every emoji_frequency row used by the emoji leaderboards from webapi.
 * @returns {Promise<Array<{ emoji: string, frequency: number, emoid: string, animated: number }>>}
 */
async function fetchAllEmojiLeaderboardRows() {
  const { webapiUrl } = requireWebviewCredentials();
  const authHeader = await getWebapiAuthHeader();
  const rows = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const res = await fetch(`${webapiUrl}/api/leaderboards/emoji`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ limit: EMOJI_PAGE_SIZE, offset }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(
        data?.error || `Failed to load emoji leaderboard (${res.status})`,
      );
    }

    const page = Array.isArray(data.top) ? data.top : [];
    rows.push(...page);
    total = Number(data.total) || 0;
    offset += EMOJI_PAGE_SIZE;

    if (page.length === 0) break;
  }

  return rows;
}

/**
 * Log every custom emoji image expected by the emoji leaderboards and whether it exists.
 * @param {string} filesRoot Absolute path to the web-view files directory.
 * @returns {Promise<void>}
 */
export async function logEmojiFileInventory(filesRoot) {
  const resolvedFilesRoot = path.resolve(filesRoot);

  try {
    const rows = await fetchAllEmojiLeaderboardRows();
    const customRows = rows
      .filter(isCustomDiscordEmoji)
      .sort((a, b) =>
        String(a.emoji ?? "").localeCompare(String(b.emoji ?? ""), undefined, {
          sensitivity: "base",
        }),
      );

    const inventory = customRows.map((row) => {
      const check = resolveEmojiImageOnDisk(resolvedFilesRoot, row);
      return {
        emoji: String(row.emoji ?? ""),
        emoid: String(row.emoid ?? ""),
        animated: Boolean(row.animated),
        frequency: Number(row.frequency) || 0,
        ...check,
      };
    });

    const foundCount = inventory.filter((entry) => entry.found).length;

    console.log("=== Emoji leaderboard image inventory ===");
    console.log(`Files root: ${resolvedFilesRoot}`);
    console.log(
      `Custom emojis in database: ${customRows.length} (${rows.length - customRows.length} unicode emojis skipped)`,
    );
    console.log(`Image files found: ${foundCount} / ${customRows.length}`);
    console.log("");

    if (inventory.length === 0) {
      console.log("No custom emoji image files expected.");
      console.log("=========================================");
      return;
    }

    for (const entry of inventory) {
      const status = entry.found ? "FOUND" : "MISSING";
      const label = entry.animated ? "animated" : "static";
      console.log(
        `[emoji-inventory] ${status} ${entry.expectedPath} (:${entry.emoji}:, emoid=${entry.emoid}, ${label}, uses=${entry.frequency})`,
      );
      if (entry.found && entry.resolvedPath !== entry.expectedPath) {
        console.log(
          `[emoji-inventory]   on-disk path: ${entry.resolvedPath}`,
        );
      }
    }

    console.log("=========================================");
  } catch (err) {
    console.error(
      "[emoji-inventory] Failed to build emoji file inventory:",
      err instanceof Error ? err.message : err,
    );
  }
}
