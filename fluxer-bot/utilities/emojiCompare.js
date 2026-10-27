/**
 * Emoji object comparison, mirroring webapi's services/emojiFrequency.js.
 * Config getters return resolved emoji objects ({ app, emoid, emoji }), not bare strings.
 */

/**
 * Convert a fluxer.js emoji-like value (parsed custom-emoji token or a bare unicode string)
 * into a comparable emoji object.
 * @param {{ id?: string|null, name?: string|null }} fluxerEmoji
 * @returns {{ app: "fluxer", emoid: string, emoji: string }}
 */
export function toEmojiObject(fluxerEmoji) {
  const name = String(fluxerEmoji?.name ?? "");
  return {
    app: "fluxer",
    emoid: fluxerEmoji?.id != null ? String(fluxerEmoji.id) : name,
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
  if (!a || !b) return false;
  if (a == b) return true;
  if (a.emoid == b.emoid) return true;
  if (a.emoji == b.emoji) return true;
  return false;
}
