/**
 * Chat-platform guild snapshots: metadata, channels, and roles pushed periodically by a
 * platform client (discord-bot today), plus the existing emoji/sticker catalog folded in
 * for a single unified read. App-scoped (app + guildId) so multiple platform clients can
 * share these tables without collision.
 */

import db from "../config/db.js";
import { isChatMemberAppSupported } from "./chatMemberMapping.js";
import { utcIsoToSqlDatetime } from "./scheduledMessages.js";
import { seedDefaultConfigForGuild } from "./guildConfig.js";

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function toFiniteNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Discord reports #000000 for a role with no color set (the hex form of color int 0), not a
 * real color — normalize that (and any falsy value) to null so a non-null `color` always means
 * the role actually has one set.
 * @param {unknown} color
 * @returns {string|null}
 */
function normalizeRoleColor(color) {
  if (!color) return null;
  const hex = String(color).toLowerCase();
  return hex === "#000000" ? null : hex;
}

/**
 * Batch-resolve raw role id strings (as stored on guild_members.roles) into their full
 * guild_roles row. The single point every webapi response should go through before returning
 * a "role" — never emit a bare role id. A role id with no matching guild_roles row (deleted or
 * never synced) resolves to a placeholder ({ id, name: null, ... }) so the id stays visible
 * instead of silently disappearing.
 * @param {Array<Record<string, unknown> & { roles?: unknown[], app?: string }>} rows
 * @param {{ app?: string }} [options] Fallback app for rows that don't carry their own `app` column.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function attachRoleObjects(rows, { app: fallbackApp } = {}) {
  const idSet = new Set();
  for (const row of rows) {
    for (const id of row.roles ?? []) idSet.add(String(id));
  }

  let byAppId = new Map();
  if (idSet.size > 0) {
    const ids = [...idSet];
    const placeholders = ids.map(() => "?").join(",");
    const [roleRows] = await db.query(
      `SELECT app, id, name, color, position, mentionable, hoisted FROM guild_roles WHERE id IN (${placeholders})`,
      ids,
    );
    byAppId = new Map(
      (roleRows ?? []).map((r) => [`${r.app}:${r.id}`, { ...r, color: normalizeRoleColor(r.color) }]),
    );
  }

  return rows.map((row) => {
    const app = row.app ?? fallbackApp;
    const roles = (row.roles ?? []).map((id) => {
      const key = `${app}:${String(id)}`;
      return (
        byAppId.get(key) ?? {
          id: String(id),
          app,
          name: null,
          color: null,
          position: null,
          mentionable: null,
          hoisted: null,
        }
      );
    });
    return { ...row, roles };
  });
}

/**
 * Batch-resolve raw channel id strings into their full guild_channels row, mirroring
 * attachRoleObjects for roles. A channel id with no matching guild_channels row (deleted or
 * never synced) resolves to a placeholder ({ id, name: null, ... }) so the id stays visible
 * instead of silently disappearing.
 * @param {Array<Record<string, unknown> & { channelIds?: unknown[], app?: string }>} rows
 * @param {{ app?: string }} [options] Fallback app for rows that don't carry their own `app` column.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function attachChannelObjects(rows, { app: fallbackApp } = {}) {
  const idSet = new Set();
  for (const row of rows) {
    for (const id of row.channelIds ?? []) idSet.add(String(id));
  }

  let byAppId = new Map();
  if (idSet.size > 0) {
    const ids = [...idSet];
    const placeholders = ids.map(() => "?").join(",");
    const [channelRows] = await db.query(
      `SELECT app, id, name, type, position, parent_id AS parentId FROM guild_channels WHERE id IN (${placeholders})`,
      ids,
    );
    byAppId = new Map((channelRows ?? []).map((c) => [`${c.app}:${c.id}`, c]));
  }

  return rows.map((row) => {
    const app = row.app ?? fallbackApp;
    const channelIds = (row.channelIds ?? []).map((id) => {
      const key = `${app}:${String(id)}`;
      return (
        byAppId.get(key) ?? {
          id: String(id),
          app,
          name: null,
          type: null,
          position: null,
          parentId: null,
        }
      );
    });
    return { ...row, channelIds };
  });
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
    utcIsoToSqlDatetime(guild.createdAt),
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
    // Brand-new server: give it a full, independent config set immediately.
    await seedDefaultConfigForGuild(app, gid);
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
    "SELECT app, id, name, color, position, mentionable, hoisted FROM guild_roles WHERE app = ? AND guild_id = ? ORDER BY position DESC",
    [resolvedApp, resolvedGuildId],
  );
  // guild_emojis scoped to this guild's own custom emoji, plus every unicode entry (guild_id IS
  // NULL — no owning guild, shared across every admin panel). frequency is this guild's own usage
  // count (LEFT JOIN so a never-yet-used catalog entry still shows up, at 0).
  const [emojiRows] = await db.query(
    `SELECT ge.app AS app, ge.id AS emoid, ge.name AS emoji, ge.animated AS animated,
            COALESCE(ef.type, ge.type) AS type, COALESCE(ef.frequency, 0) AS frequency
     FROM guild_emojis ge
     LEFT JOIN emoji_frequency ef ON ef.emoid = ge.id AND ef.app = ? AND ef.guild_id = ?
     WHERE (ge.guild_id = ? OR ge.guild_id IS NULL)
       AND (ge.type = 'emoji' OR ge.type IS NULL)
     ORDER BY ge.name`,
    [resolvedApp, resolvedGuildId, resolvedGuildId],
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
    roles: (roleRows ?? []).map((r) => ({ ...r, color: normalizeRoleColor(r.color) })),
    emojis: emojiRows ?? [],
    stickers: stickerRows ?? [],
    syncedAt: info.synced_at,
  };
}

/**
 * List every guild that has ever synced, for a guild-picker UI (e.g. webadmin's tab switcher).
 * @returns {Promise<Array<{ app: string, guildId: string, name: string, iconUrl: string|null, syncedAt: string }>>}
 */
export async function listSyncedGuilds() {
  const [rows] = await db.query(
    "SELECT app, guild_id, name, icon_url, synced_at FROM guild_info ORDER BY name",
  );
  return (rows ?? []).map((r) => ({
    app: r.app,
    guildId: r.guild_id,
    name: r.name,
    iconUrl: r.icon_url,
    syncedAt: r.synced_at,
  }));
}
