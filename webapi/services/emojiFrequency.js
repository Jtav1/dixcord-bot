/**
 * emoji_frequency resolution: the shared point every webapi response goes through before
 * returning an emoji, mirroring attachRoleObjects/attachChannelObjects in guildInfo.js.
 * Catalog identity (name, animated, owning app/guild) lives in guild_emojis; emoji_frequency is
 * now purely a per-guild usage counter (see services/messageProcessing.js). The resolved emoji
 * object shape returned here is unchanged from before the split, so existing consumers (webview's
 * emojiLeaderboard.js, etc.) need no changes.
 */

import db from "../config/db.js";

/**
 * Batch-resolve raw emoid strings into their full display object, replacing each row's bare
 * `emoid` field with a nested `emoji` object — never emit a bare emoid. `frequency` is summed
 * across every guild this emoji has been used in (a global-feeling count, matching this
 * function's existing global-leaderboard callers); an emoid with no matching guild_emojis catalog
 * row (deleted, or never synced) still shows its usage count with null identity fields, so the id
 * stays visible instead of silently disappearing.
 * @param {Array<Record<string, unknown> & { emoid?: unknown }>} rows
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function attachEmojiObjects(rows) {
  const idSet = new Set();
  for (const row of rows) {
    if (row.emoid != null) idSet.add(String(row.emoid));
  }

  let frequencyById = new Map();
  let catalogById = new Map();
  if (idSet.size > 0) {
    const ids = [...idSet];
    const placeholders = ids.map(() => "?").join(",");
    const [freqRows] = await db.query(
      `SELECT emoid, SUM(frequency) AS total, MAX(type) AS type FROM emoji_frequency WHERE emoid IN (${placeholders}) GROUP BY emoid`,
      ids,
    );
    frequencyById = new Map((freqRows ?? []).map((r) => [String(r.emoid), r]));

    const [catalogRows] = await db.query(
      `SELECT id, app, name, animated, type FROM guild_emojis WHERE id IN (${placeholders})`,
      ids,
    );
    catalogById = new Map((catalogRows ?? []).map((r) => [String(r.id), r]));
  }

  return rows.map((row) => {
    const { emoid, ...rest } = row;
    if (emoid == null) return { ...rest, emoji: null };
    const key = String(emoid);
    const freq = frequencyById.get(key);
    const catalog = catalogById.get(key);
    const emoji = {
      emoid: key,
      app: catalog?.app ?? null,
      emoji: catalog?.name ?? null,
      frequency: freq ? Number(freq.total) : null,
      animated: catalog?.animated ?? null,
      type: freq?.type ?? catalog?.type ?? null,
    };
    return { ...rest, emoji };
  });
}

/**
 * Resolve a single-value emoji config setting (pin_emoji, plusplus_emoji, minusminus_emoji,
 * repost_emoji) into an emoji object for API responses, scoped to this guild's own usage count
 * (unlike attachEmojiObjects' global sum — a config value is inherently per-guild). Unlike
 * attachEmojiObjects (which assumes the id refers to something that was once a real catalog
 * entry), a config value may be text an admin typed by hand that was never synced — in that case
 * there's no id to fall back to, so the raw text itself becomes the object's `emoji` (name)
 * property and `app` is null, marking it as unresolved/freeform. See emojisMatch for the
 * comparison rule this enables.
 * @param {string} app
 * @param {string} guildId
 * @param {unknown} rawValue - The raw guild_config.value (emoid, or freeform text); empty/null means unset.
 * @returns {Promise<{ emoid: string|null, app: string|null, emoji: string|null, frequency: number|null, animated: number|null, type: string|null } | null>} null if unset.
 */
export async function resolveConfigEmojiValue(app, guildId, rawValue) {
  const value = rawValue == null ? "" : String(rawValue).trim();
  if (!value) return null;

  const [catalogRows] = await db.query(
    "SELECT id, app, name, animated, type FROM guild_emojis WHERE id = ?",
    [value],
  );
  if (!catalogRows || catalogRows.length === 0) {
    return {
      emoid: null,
      app: null,
      emoji: value,
      frequency: null,
      animated: null,
      type: null,
    };
  }
  const catalog = catalogRows[0];

  const [freqRows] = await db.query(
    "SELECT frequency, type FROM emoji_frequency WHERE app = ? AND guild_id = ? AND emoid = ?",
    [app, guildId, value],
  );
  const freq = freqRows?.[0];

  return {
    emoid: value,
    app: catalog.app,
    emoji: catalog.name,
    frequency: freq ? Number(freq.frequency) : null,
    animated: catalog.animated,
    type: freq?.type ?? catalog.type ?? null,
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
