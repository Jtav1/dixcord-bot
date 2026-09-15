/**
 * emoji_frequency resolution: the shared point every webapi response goes through before
 * returning an emoji, mirroring attachRoleObjects/attachChannelObjects in guildInfo.js.
 */

import db from "../config/db.js";

/**
 * Batch-resolve raw emoid strings into their full emoji_frequency row, replacing each row's
 * bare `emoid` field with a nested `emoji` object — never emit a bare emoid. An emoid with no
 * matching emoji_frequency row (deleted) resolves to a placeholder ({ emoid, app: null,
 * emoji: null, ... }) so the id stays visible instead of silently disappearing.
 * @param {Array<Record<string, unknown> & { emoid?: unknown }>} rows
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function attachEmojiObjects(rows) {
  const idSet = new Set();
  for (const row of rows) {
    if (row.emoid != null) idSet.add(String(row.emoid));
  }

  let byId = new Map();
  if (idSet.size > 0) {
    const ids = [...idSet];
    const placeholders = ids.map(() => "?").join(",");
    const [emojiRows] = await db.query(
      `SELECT app, emoid, emoji, frequency, animated, type FROM emoji_frequency WHERE emoid IN (${placeholders})`,
      ids,
    );
    byId = new Map((emojiRows ?? []).map((e) => [String(e.emoid), e]));
  }

  return rows.map((row) => {
    const { emoid, ...rest } = row;
    if (emoid == null) return { ...rest, emoji: null };
    const key = String(emoid);
    const emoji =
      byId.get(key) ?? {
        emoid: key,
        app: null,
        emoji: null,
        frequency: null,
        animated: null,
        type: null,
      };
    return { ...rest, emoji };
  });
}

/**
 * Resolve a single-value emoji config setting (pin_emoji, plusplus_emoji, minusminus_emoji,
 * repost_emoji) into an emoji object for API responses. Unlike attachEmojiObjects (which
 * assumes the id refers to something that was once a real catalog entry), a config value may be
 * text an admin typed by hand that was never synced — in that case there's no id to fall back
 * to, so the raw text itself becomes the object's `emoji` (name) property and `app` is null,
 * marking it as unresolved/freeform. See emojisMatch for the comparison rule this enables.
 * @param {string} app
 * @param {unknown} rawValue - The raw guild_config.value (emoid, or freeform text); empty/null means unset.
 * @returns {Promise<{ emoid: string|null, app: string|null, emoji: string|null, frequency: number|null, animated: number|null, type: string|null } | null>} null if unset.
 */
export async function resolveConfigEmojiValue(app, rawValue) {
  const value = rawValue == null ? "" : String(rawValue).trim();
  if (!value) return null;

  const [rows] = await db.query(
    "SELECT app, emoid, emoji, frequency, animated, type FROM emoji_frequency WHERE app = ? AND emoid = ?",
    [app, value],
  );
  if (rows && rows.length > 0) return rows[0];

  return {
    emoid: null,
    app: null,
    emoji: value,
    frequency: null,
    animated: null,
    type: null,
  };
}

/**
 * Compare two resolved emoji objects (see attachEmojiObjects / resolveConfigEmojiValue) for
 * equality. If both come from the same known app, compare by emoid — the stable identity within
 * that app. Otherwise (including when either side is unresolved freeform text, app: null), fall
 * back to comparing the `emoji` display/name string.
 * @param {{app:string|null,emoid:string|null,emoji:string|null}|null|undefined} a
 * @param {{app:string|null,emoid:string|null,emoji:string|null}|null|undefined} b
 * @returns {boolean}
 */
export function emojisMatch(a, b) {
  if (!a || !b) return false;
  if (a.app != null && a.app === b.app) return a.emoid === b.emoid;
  return a.emoji != null && a.emoji === b.emoji;
}
