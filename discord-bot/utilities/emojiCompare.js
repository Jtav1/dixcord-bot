/**
 * Emoji object comparison, mirroring webapi's services/emojiFrequency.js.
 * Config getters return resolved emoji objects ({ app, emoid, emoji }), not bare strings.
 */

/**
 * Convert a Discord.js emoji-like value (MessageReaction's `.emoji`, or `parseEmoji()` result)
 * into a comparable emoji object.
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
 * Compare two resolved emoji objects for equality. Same app: compare by emoid; else by emoji string.
 * @param {{app:string|null,emoid:string|null,emoji:string|null}|null|undefined} a
 * @param {{app:string|null,emoid:string|null,emoji:string|null}|null|undefined} b
 * @returns {boolean}
 */
export function emojisMatch(a, b) {
  console.log("in emoji match with");
  console.log(a);
  console.log(b);
  if (!a || !b) return false;
  if (a.app != null && a.app === b.app) return a.emoid === b.emoid;
  return a.emoji != null && a.emoji === b.emoji;
}
