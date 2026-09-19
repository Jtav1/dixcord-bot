import "dotenv/config";

import { syncEmojiFrequency } from "../api/emojis.js";

/**
 * Admin maintenance script: syncs this bot's guild_emojis catalog against emoji_frequency via
 * webapi's POST /api/message-processing/emoji-frequency-sync —
 * 1. Deletes guild_emojis rows misattributed to another guild.
 * 2. Copies frequency from every emoji_frequency row for this guild into the matching
 *    guild_emojis row (matched by id/emoid), inserting one if it doesn't exist yet. Covers both
 *    emoji and sticker rows (emoji_frequency.type: NULL = emoji, "sticker" = sticker).
 *
 * Run manually: `node scripts/sync-emoji-frequency.js [--dry-run]` (or
 * `npm run sync-emoji-frequency -- --dry-run`). --dry-run previews the counts below without
 * deleting or writing anything.
 */
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`emoji-frequency-sync: starting${dryRun ? " (dry run)" : ""}...`);
  const { deleted, inserted, updated, synced } = await syncEmojiFrequency(dryRun);
  const verb = dryRun ? "would delete" : "deleted";
  const syncVerb = dryRun ? "would sync" : "synced";
  console.log(
    `emoji-frequency-sync: ${verb} ${deleted} misattributed row(s); ${syncVerb} ${synced} row(s) ` +
      `from emoji_frequency (${inserted} new, ${updated} updated).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("emoji-frequency-sync: fatal error:", err);
    process.exit(1);
  });
