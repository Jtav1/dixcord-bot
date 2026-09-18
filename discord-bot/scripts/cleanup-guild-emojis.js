import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

import { token, guildId } from "../configVars.js";
import {
  listEmojiCatalog,
  deleteEmojiCatalogRow,
  setEmojiCatalogRowType,
  migrateEmojiCatalogFrequency,
} from "../api/emojis.js";

/**
 * Admin maintenance script, three phases, in order:
 *
 * 1. Delete guild_emojis rows whose guild_id doesn't match this bot's own guild (e.g. legacy
 *    backfilled rows from before the (app, guild_id) split, or reactions to another guild's
 *    emoji misattributed here). This is the only deletion criterion — a row is NOT deleted just
 *    because its emoji/sticker was since removed from Discord; that's normal churn, not foreign
 *    data, and its guild_id is still correct.
 * 2. For every row kept after step 1, determine its real kind and correct `type` if wrong/NULL:
 *    live on Discord as an emoji or sticker settles it outright; for an id no longer live,
 *    fall back to `hasFrequencyHistory` (any emoji_frequency row for that emoid) as evidence it
 *    was an emoji — sticker usage is tracked in the separate sticker_frequency table, so it never
 *    produces an emoji_frequency row. A row we can't determine a kind for either way is left
 *    untouched (never guessed at).
 * 3. For every row of kind "emoji" still in guild_emojis after step 2, migrate its usage total
 *    from emoji_frequency into guild_emojis.frequency (matched by emoid).
 *
 * Run manually: `node scripts/cleanup-guild-emojis.js [--dry-run]`
 * --dry-run previews all three steps without deleting, retyping, or migrating anything — type
 * and frequency previews are computed against Discord's actual data, not the stale DB value.
 */

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`emoji-cleanup: starting${dryRun ? " (dry run)" : ""}...`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  await new Promise((resolve) => client.once("ready", resolve));

  let actualEmojiIds, actualStickerIds;
  try {
    const oauthGuild = await client.guilds.fetch(guildId);
    const guild = await oauthGuild.fetch();
    const emojis = await guild.emojis.fetch();
    const stickers = await guild.stickers.fetch();
    actualEmojiIds = new Set(emojis.map((e) => String(e.id)));
    actualStickerIds = new Set(stickers.map((s) => String(s.id)));
  } finally {
    await client.destroy();
  }
  console.log(
    `emoji-cleanup: guild ${guildId} has ${actualEmojiIds.size} real emoji(s) and ${actualStickerIds.size} real sticker(s).`,
  );

  const rows = await listEmojiCatalog();
  console.log(`emoji-cleanup: guild_emojis has ${rows.length} custom row(s) to check.`);

  // actualKind: 'emoji' | 'sticker' when we can determine it (live on Discord, or — for a no
  // longer live id — evidenced by emoji_frequency history); null when genuinely unknown.
  const withKind = rows.map((row) => ({
    ...row,
    actualKind: actualEmojiIds.has(String(row.id))
      ? "emoji"
      : actualStickerIds.has(String(row.id))
        ? "sticker"
        : row.hasFrequencyHistory
          ? "emoji"
          : null,
  }));

  const stale = withKind.filter((row) => row.guildId !== guildId);
  const kept = withKind.filter((row) => !stale.includes(row));

  const unverifiable = kept.filter((row) => row.actualKind === null);
  if (unverifiable.length > 0) {
    console.log(
      `emoji-cleanup: ${unverifiable.length} kept row(s) have no determinable kind (not currently ` +
        `live on Discord, no emoji_frequency history) — left untouched, neither deleted nor migrated.`,
    );
  }

  // --- Step 1: delete rows that don't belong to this guild ---
  if (stale.length === 0) {
    console.log("emoji-cleanup: no stale rows to delete.");
  } else {
    console.log(`emoji-cleanup: ${stale.length} row(s) do not belong to this guild:`);
    for (const row of stale) {
      console.log(`  - ${row.id} "${row.name}" (stored guild_id: ${row.guildId})`);
    }

    if (dryRun) {
      console.log("emoji-cleanup: dry run, no rows deleted.");
    } else {
      let deleted = 0;
      for (const row of stale) {
        try {
          await deleteEmojiCatalogRow(row.id);
          deleted++;
        } catch (err) {
          console.error(`emoji-cleanup: failed to delete ${row.id}:`, err?.message ?? err);
        }
      }
      console.log(`emoji-cleanup: deleted ${deleted}/${stale.length} row(s).`);
    }
  }

  // --- Step 2: fix the type field on kept rows (skip rows with no determinable kind) ---
  const typeMismatches = kept.filter(
    (row) => row.actualKind !== null && row.type !== row.actualKind,
  );
  if (typeMismatches.length === 0) {
    console.log("emoji-cleanup: no type mismatches to fix.");
  } else {
    console.log(`emoji-cleanup: ${typeMismatches.length} row(s) have the wrong type recorded:`);
    for (const row of typeMismatches) {
      console.log(`  - ${row.id} "${row.name}": ${row.type ?? "NULL"} -> ${row.actualKind}`);
    }

    if (dryRun) {
      console.log("emoji-cleanup: dry run, no types updated.");
    } else {
      let fixed = 0;
      for (const row of typeMismatches) {
        try {
          await setEmojiCatalogRowType(row.id, row.actualKind);
          fixed++;
        } catch (err) {
          console.error(`emoji-cleanup: failed to fix type for ${row.id}:`, err?.message ?? err);
        }
      }
      console.log(`emoji-cleanup: fixed type for ${fixed}/${typeMismatches.length} row(s).`);
    }
  }

  // --- Step 3: migrate emoji_frequency totals into guild_emojis.frequency, kept emoji rows only ---
  const pendingMigration = kept.filter(
    (row) => row.actualKind === "emoji" && row.sourceFrequency !== row.frequency,
  );

  if (pendingMigration.length === 0) {
    console.log("emoji-cleanup: no frequency to migrate.");
    return;
  }

  console.log(`emoji-cleanup: ${pendingMigration.length} row(s) have frequency to migrate:`);
  for (const row of pendingMigration) {
    console.log(`  - ${row.id} "${row.name}": ${row.frequency} -> ${row.sourceFrequency}`);
  }

  if (dryRun) {
    console.log("emoji-cleanup: dry run, no frequency migrated.");
    return;
  }

  let migrated = 0;
  for (const row of pendingMigration) {
    try {
      await migrateEmojiCatalogFrequency(row.id);
      migrated++;
    } catch (err) {
      console.error(`emoji-cleanup: failed to migrate frequency for ${row.id}:`, err?.message ?? err);
    }
  }
  console.log(`emoji-cleanup: migrated frequency for ${migrated}/${pendingMigration.length} row(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("emoji-cleanup: fatal error:", err);
    process.exit(1);
  });
