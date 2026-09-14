/**
 * Emoji object comparison, mirroring webapi's services/emojiFrequency.js. Config getters
 * (getPinEmoji, getPlusEmoji, getMinusEmoji, getRepostEmojiId) return resolved emoji objects
 * ({ app, emoid, emoji }) rather than bare strings — an object with app: null means the admin
 * typed freeform text that was never synced to emoji_frequency.
 */

/**
 * Build the emoji-object representation of a Discord.js emoji-like value (a MessageReaction's
 * `.emoji`, or discord.js's `parseEmoji()` result) for comparison against a config value.
 * @param {{ id?: string|null, name?: string|null }} discordEmoji
 * @returns {{ app: "discord", emoid: string, emoji: string }}
 */
export function toEmojiObject(discordEmoji) {
  const name = String(discordEmoji?.name ?? "");
  return {
    app: "discord",
    emoid: discordEmoji?.id != null ? String(discordEmoji.id) : name,
    emoji: name,
  };
}

/**
 * Compare two resolved emoji objects for equality. If both come from the same known app,
 * compare by emoid — the stable identity within that app. Otherwise (including when either
 * side is unresolved freeform text, app: null), fall back to comparing the `emoji` string.
 * @param {{app:string|null,emoid:string|null,emoji:string|null}|null|undefined} a
 * @param {{app:string|null,emoid:string|null,emoji:string|null}|null|undefined} b
 * @returns {boolean}
 */
export function emojisMatch(a, b) {
  if (!a || !b) return false;
  if (a.app != null && a.app === b.app) return a.emoid === b.emoid;
  return a.emoji != null && a.emoji === b.emoji;
}
