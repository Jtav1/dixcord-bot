import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

import { token, guildId } from "../configVars.js";
import {
  listEmojiCatalog,
  deleteEmojiCatalogRow,
  migrateEmojiCatalogFrequency,
} from "../api/emojis.js";

/**
 * Admin maintenance script, two phases, in order:
 *
 * 1. Delete guild_emojis rows that don't actually belong to the guild_id they're stored under
 *    (e.g. legacy backfilled rows from before the (app, guild_id) split). Every custom emoji row
 *    is checked against this bot's own guild's live Discord emoji list — the only guild this
 *    deployment can verify — so a row is kept only when its guild_id matches DISCORD_GUILD_ID
 *    *and* its id is still one of that guild's current emojis.
 * 2. For every row still in guild_emojis after step 1, migrate its usage total from
 *    emoji_frequency into guild_emojis.frequency (matched by emoid). Rows deleted in step 1 are
 *    never migrated.
 *
 * Run manually: `node scripts/cleanup-guild-emojis.js [--dry-run]`
 * --dry-run previews both steps (what would be deleted, what frequency would move) without
 * deleting or migrating anything.
 */

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`emoji-cleanup: starting${dryRun ? " (dry run)" : ""}...`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  await new Promise((resolve) => client.once("ready", resolve));

  let actualEmojiIds;
  try {
    const oauthGuild = await client.guilds.fetch(guildId);
    const guild = await oauthGuild.fetch();
    const emojis = await guild.emojis.fetch();
    actualEmojiIds = new Set(emojis.map((e) => String(e.id)));
  } finally {
    await client.destroy();
  }
  console.log(`emoji-cleanup: guild ${guildId} has ${actualEmojiIds.size} real emoji(s).`);

  const rows = await listEmojiCatalog();
  console.log(`emoji-cleanup: guild_emojis has ${rows.length} custom emoji row(s) to check.`);

  const stale = rows.filter(
    (row) => row.guildId !== guildId || !actualEmojiIds.has(String(row.id)),
  );
  const kept = rows.filter((row) => !stale.includes(row));

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

  // --- Step 2: migrate emoji_frequency totals into guild_emojis.frequency, kept rows only ---
  const pendingMigration = kept.filter((row) => row.sourceFrequency !== row.frequency);

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
