/**
 * Chat-platform guild snapshots: metadata, channels, and roles pushed periodically by a
 * platform client (discord-bot today), plus the existing emoji/sticker catalog folded in
 * for a single unified read. App-scoped (app + guildId) so multiple platform clients can
 * share these tables without collision.
 */

import db from "../config/db.js";
import { isChatMemberAppSupported } from "./chatMemberMapping.js";

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function toFiniteNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Upsert a full guild snapshot: guild_info row, and a full replace of that guild's
 * guild_channels/guild_roles rows.
 * @param {{ app: string, guildId: string, guild: Record<string, unknown>, channels: Array<Record<string, unknown>>, roles: Array<Record<string, unknown>> }} payload
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function upsertGuildSnapshot({ app, guildId, guild, channels, roles }) {
  if (!isChatMemberAppSupported(app)) {
    return {
      ok: false,
      error: 'Unsupported app; currently only "discord" is accepted.',
    };
  }
  const gid = String(guildId ?? "").trim();
  if (!gid) return { ok: false, error: "guildId is required" };
  if (!guild || typeof guild !== "object") {
    return { ok: false, error: "guild is required" };
  }
  if (!Array.isArray(channels)) {
    return { ok: false, error: "channels must be an array" };
  }
  if (!Array.isArray(roles)) {
    return { ok: false, error: "roles must be an array" };
  }

  const fields = [
    String(guild.name ?? ""),
    guild.iconUrl ?? null,
    guild.description ?? null,
    guild.ownerId ?? null,
    toFiniteNumberOrNull(guild.boostTier),
    toFiniteNumberOrNull(guild.boostCount),
    guild.verificationLevel ?? null,
    guild.preferredLocale ?? null,
    guild.createdAt ?? null,
  ];

  const [existing] = await db.query(
    "SELECT app FROM guild_info WHERE app = ? AND guild_id = ?",
    [app, gid],
  );

  if (existing && existing.length > 0) {
    await db.query(
      `UPDATE guild_info
       SET name = ?, icon_url = ?, description = ?, owner_id = ?, boost_tier = ?, boost_count = ?,
           verification_level = ?, preferred_locale = ?, guild_created_at = ?, synced_at = CURRENT_TIMESTAMP
       WHERE app = ? AND guild_id = ?`,
      [...fields, app, gid],
    );
  } else {
    await db.query(
      `INSERT INTO guild_info
        (app, guild_id, name, icon_url, description, owner_id, boost_tier, boost_count, verification_level, preferred_locale, guild_created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [app, gid, ...fields],
    );
  }

  await db.query("DELETE FROM guild_channels WHERE app = ? AND guild_id = ?", [app, gid]);
  for (const channel of channels) {
    const id = String(channel?.id ?? "").trim();
    if (!id) continue;
    await db.query(
      "INSERT INTO guild_channels (app, id, guild_id, name, type, position, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        app,
        id,
        gid,
        String(channel.name ?? ""),
        channel.type != null ? String(channel.type) : null,
        toFiniteNumberOrNull(channel.position),
        channel.parentId ?? null,
      ],
    );
  }

  await db.query("DELETE FROM guild_roles WHERE app = ? AND guild_id = ?", [app, gid]);
  for (const role of roles) {
    const id = String(role?.id ?? "").trim();
    if (!id) continue;
    await db.query(
      "INSERT INTO guild_roles (app, id, guild_id, name, color, position, mentionable, hoisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        app,
        id,
        gid,
        String(role.name ?? ""),
        role.color ?? null,
        toFiniteNumberOrNull(role.position),
        role.mentionable ? 1 : 0,
        role.hoisted ? 1 : 0,
      ],
    );
  }

  return { ok: true };
}

/**
 * Read a guild snapshot: metadata, channels, roles, and the existing emoji/sticker catalog.
 * Falls back to the most-recently-synced (app, guildId) pair when neither is given.
 * @param {{ app?: string, guildId?: string }} [filter]
 * @returns {Promise<{ ok: true, guild: object, channels: Array, roles: Array, emojis: Array, stickers: Array, syncedAt: string } | { ok: false, error: string }>}
 */
export async function getGuildSnapshot({ app, guildId } = {}) {
  let resolvedApp = app;
  let resolvedGuildId = guildId;

  if (!resolvedApp || !resolvedGuildId) {
    const [rows] = await db.query(
      "SELECT app, guild_id FROM guild_info ORDER BY synced_at DESC LIMIT 1",
    );
    if (!rows || rows.length === 0) {
      return { ok: false, error: "No guild info has been synced yet" };
    }
    resolvedApp = resolvedApp || rows[0].app;
    resolvedGuildId = resolvedGuildId || rows[0].guild_id;
  }

  const [infoRows] = await db.query(
    "SELECT * FROM guild_info WHERE app = ? AND guild_id = ?",
    [resolvedApp, resolvedGuildId],
  );
  if (!infoRows || infoRows.length === 0) {
    return { ok: false, error: "Guild not found" };
  }
  const info = infoRows[0];

  const [channelRows] = await db.query(
    "SELECT id, name, type, position, parent_id FROM guild_channels WHERE app = ? AND guild_id = ? ORDER BY position",
    [resolvedApp, resolvedGuildId],
  );
  const [roleRows] = await db.query(
    "SELECT id, name, color, position, mentionable, hoisted FROM guild_roles WHERE app = ? AND guild_id = ? ORDER BY position DESC",
    [resolvedApp, resolvedGuildId],
  );
  const [emojiRows] = await db.query(
    "SELECT emoid, emoji, frequency, animated, type FROM emoji_frequency",
  );
  const [stickerRows] = await db.query(
    "SELECT stickerid, name, frequency FROM sticker_frequency",
  );

  return {
    ok: true,
    guild: {
      app: info.app,
      guildId: info.guild_id,
      name: info.name,
      iconUrl: info.icon_url,
      description: info.description,
      ownerId: info.owner_id,
      boostTier: info.boost_tier,
      boostCount: info.boost_count,
      verificationLevel: info.verification_level,
      preferredLocale: info.preferred_locale,
      createdAt: info.guild_created_at,
    },
    channels: channelRows ?? [],
    roles: roleRows ?? [],
    emojis: emojiRows ?? [],
    stickers: stickerRows ?? [],
    syncedAt: info.synced_at,
  };
}
