# webapi internals

Service-layer and business-logic patterns in `webapi/` that aren't already covered by [`webapi/docs/README.md`](../webapi/docs/README.md) (route index), [`code-standards.md`](code-standards.md) (style conventions), or `CLAUDE.md`'s Architecture section (request flow, auth model, schema reconciliation, file storage). Read this when you're adding a feature that spans more than one route handler, or touching config/caching/linking logic.

## `services/` at a glance

31 modules under `webapi/services/`, one per resource/concern. Most are plain CRUD that mirror their route file 1:1 — `pinQuips.js`, `eightBallResponses.js`, `linkReplacements.js`, `triggerResponseFunctions.js`, `timeoutVotes.js`, `pinHistory.js`, `scheduledMessages.js`, `reactRole.js`, `events.js`, `leaderboards.js`, `guildEmojis.js`. A few own more than CRUD and are worth knowing before you touch them:

- **`messageProcessing.js`** — the increment-and-check pattern used by nearly every tracked action. `countEmoji`/`countSticker`/`recordPlusMinusMessage`/`recordPlusMinusReaction`/`countRepost` each upsert a counter row, then call `milestones.js`'s `checkAndMarkMilestones` and return any newly-crossed milestone in the response. `pruneIdsNotIn` is the shared "delete rows not present in this fresh sync payload" helper behind the guild-info/guild-members/guild-emojis full-replace syncs. `importGuildAssetFrequencyList` is the emoji/sticker import entry point — downloads each item's image via `emojiFiles.js` and records `guild_emojis.image_path`. `isMessageAlreadyPinned`/`logPinnedMessage` back the pin idempotency/milestone flow.
- **`milestones.js`** — `checkAndMarkMilestones({type, item, value})` is the single chokepoint every tracked increment calls through: it looks up any not-yet-achieved `milestone` row matching `(type, item?, quantity <= value)`, marks it achieved, and returns it. The `compute*` functions recompute a live total on demand — used by the admin milestones UI to validate a new milestone's `quantity` against current reality before saving. `findDuplicate` blocks creating two milestones with the same `(type, item, quantity)`.
- **`configMetadata.js`** and **`userMappings.js`/`guildMembers.js`** — see their own sections below, they're the two most load-bearing modules for cross-feature work.
- **`pinFiles.js`/`emojiFiles.js`** — see File storage below.
- **`systemStatus.js`** — see Cache-version below.

## Adding a new config key

`CONFIG_METADATA` (`services/configMetadata.js`) is a frozen object keyed by config name: `{description, type, requiresBotRestart, defaultValue, deprecated?}`. `type` (`"boolean"`/`"integer"`/`"string"`/`"emoji"`/`"json"`) is a UI/metrics hint only — webapi doesn't enforce it at write time. `metrics.js` filters on `type === "boolean"` to decide which keys get a `webapi_feature_enabled` gauge (see [`metrics.md`](metrics.md)). `defaultValue` resolves through `envDefault()`, which reads a `CONFIG_DEFAULT_<KEY>` env override before falling back to the hardcoded value in the table.

**To add a new config key: add one entry to `CONFIG_METADATA`. That's it.** On every boot, `scripts/ensureSchema.js` runs an unconditional loop that calls `seedDefaultConfigForGuild(app, guildId)` for every known guild — an insert-only upsert (`guildConfig.js`) explicitly documented as safe to call repeatedly, used to backfill keys added after a guild was first registered. So a brand-new key reaches every existing guild automatically on the next webapi restart, with no manual migration or backfill script needed. (This is distinct from the one-time, first-launch-only `guild_config` seed gated by `DISCORD_GUILD_ID`/`SEED_CONFIG_<KEY>` described in `webapi/docs/README.md` — that only runs when `guild_config` has zero rows anywhere; the backfill loop runs every boot regardless.)

## Guild-scoping enforcement

`middleware/auth.js`'s `requireOwnGuildOrAdmin(req, res, next)` is what stops a guild-bound bot service account from touching another server's data: `admin` role and accounts with `guild_id === null` (unrestricted) bypass it; everyone else must have `req.body.guildId ?? req.query.guildId` match their own service account's stored `guild_id`, or they get a `403`. It's applied per-route, stacked after `authenticate`, in `routes/{guild-emojis,message-processing,guild,guild-members,react-role,system,config,service-accounts}.js`. There's no row-level security in the DB — this middleware is the only thing enforcing the boundary, so any new guild-scoped route needs it added explicitly (match a neighboring route in that list, don't assume it's inherited from somewhere).

`config.js` additionally has its own `resolveGuildScope(req)` that checks `app`+`guildId` are both *present* before the scope-ownership middleware even runs — that's a separate "well-formed request" concern from "does this account own that guild," and both checks exist together on that route.

## `scripts/ensureSchema.js` migration pattern

Every check is read-current-state-then-conditionally-act, not a replayed migration history: `columnExists(db, table, column, isSqlite)` before `ALTER TABLE ... ADD COLUMN`; `tableExists(db, table, isSqlite)` before `CREATE TABLE`.

SQLite can't `ALTER TABLE ... ADD CONSTRAINT` or drop/add foreign keys in place, so any migration that changes a constraint on SQLite does a table rebuild instead: `CREATE TABLE <name>_new` with the final shape → `INSERT INTO <name>_new SELECT ... FROM <name>` → `DROP TABLE <name>` → `ALTER TABLE <name>_new RENAME TO <name>` (see the `guild_members.id` surrogate-PK migration and the `guild_members.platform_user_id` migration for worked examples). The MySQL branch of the same `if (isSqlite) {...} else {...}` block uses real `ALTER TABLE ... ADD/DROP CONSTRAINT` instead, since MySQL supports it directly.

Two constraint-helper functions in `schemaUtils.js` look similar but aren't interchangeable:

- `foreignKeyExists()` is actually **broken for SQLite**: `PRAGMA foreign_key_list(...)` doesn't start with `SELECT`, so `config/db.js`'s query wrapper routes it through `.run()` instead of `.all()`, silently returning `{insertId, affectedRows}` instead of the real FK rows. It's also **unused** — `ensureSchema.js` doesn't import it at all, which is presumably why this hasn't caused a visible bug. A comment at `ensureSchema.js:1733` documents detecting FKs on SQLite via the table's stored `sqlite_master.sql` DDL text instead, for exactly this reason — follow that pattern (same technique `getColumnDeclaredType` uses), don't resurrect `foreignKeyExists()`.
- `constraintExists()` unconditionally returns `false` on SQLite by design (no `information_schema.TABLE_CONSTRAINTS` equivalent exists there). It *is* called, but every call site is already inside a MySQL-only branch (gated by needing `ALTER TABLE ... DROP FOREIGN KEY`, which is MySQL-only syntax) — SQLite always takes the table-rebuild path above instead and never reaches a `constraintExists` check. So the always-false stub is harmless at every current call site, unlike `foreignKeyExists()` above. When adding a new constraint migration, follow the existing pattern (branch on `isSqlite`, rebuild-table for SQLite) rather than assuming either helper will tell you anything useful on SQLite.

## User-mapping / alias data model

Three tables back cross-platform identity linking:

- **`chat_member_mapping`** — a bare canonical identity: just an `id`. No stored handle, nickname, or app — display info is never stored here.
- **`guild_members`** — one row per `(app, guildId, platformUserId)`, carrying `handle`/`nickname`/`roles`/`joinedAt`. Populated purely by sync (`guildMembers.js`'s sync functions only ever upsert this table — never create/remove a mapping or alias).
- **`member_aliases`** — the join table: `guild_member_id` ↔ `chat_member_mapping_id`, plus a `default_alias` boolean. Exactly one alias per mapping is default at any time; a mapping's effective display handle/app is always resolved live through its default alias, never stored on the mapping itself.

`createUserMapping({guildMemberId})` (`userMappings.js`) creates a bare mapping, then immediately calls `linkGuildMemberAlias` so the new mapping's first alias becomes its default. `linkGuildMemberAlias(guildMemberId, chatMemberMappingId)` (`guildMembers.js`) upserts by `guild_member_id` — re-pointing an existing alias row rather than erroring if that guild member was already linked elsewhere — clears `default_alias` on every other alias of the *new* mapping, and if the guild member was pulled away from a different mapping, calls `promoteNewestAliasToDefault(previousMappingId)` so that abandoned mapping doesn't end up with zero default aliases. `unlinkGuildMemberAlias` mirrors this. `setPrimaryAlias` is the admin override for which alias is default (the default behavior otherwise is "newest link wins").

`requestAccountLink`/`confirmAccountLink` back the bot's self-service `link-accounts`/`confirm-link` commands: a `pending_account_links` row (keyed by a random token) snapshots the requester's identity; confirming either aliases the confirmer into the requester's existing mapping, or creates a new bare mapping on the spot if the requester had none. Guarded against linking an account to itself and against re-linking an already-linked guild member.

## File storage internals

- **`services/pinFiles.js`** — `getPinFilesRoot()` resolves `PIN_FILES_DIR` or falls back to `../discord-bot/files` relative to `process.cwd()`. `resolvePinAttachmentPath()`/`normalizeAttachmentPathsForStorage()` both reject any path containing `..` or (for storage) an absolute path — the path-traversal guard. **No cleanup logic exists** — orphaned pin attachment files are never pruned, by design or omission; don't assume disk usage is self-limiting here.
- **`services/emojiFiles.js`** — `getEmojiFilesRoot()` same env/fallback pattern, falls back to `../webview/files`. `canonicalImagePath({type, name, animated})` is the single naming authority (`Emojis/<name>.gif|png`, `Stickers/<name>.png` — stickers are always written as `.png` regardless of source format; this matches webview's sticker URL builder, so don't change one without the other). `deleteOrphanedImageFiles(paths)` *does* clean up: before unlinking, it re-checks no other `guild_emojis` row still references that exact path (filenames are name-keyed and can be shared across guilds), then unlinks, swallowing `ENOENT`.

## Cache-version mechanism

`services/systemStatus.js` keeps a `system_state` row keyed `cache_version`; `getCacheVersion()`/`incrementCacheVersion()` read/bump it. Two call conventions do the same thing — not a bug, just unnormalized: `utils/bumpCacheVersion.js`'s `bumpCacheVersion()` (try/catch wrapper, used by `routes/trigger-responses.js` and `routes/link-replacements.js`) vs. calling `incrementCacheVersion()` directly (used by `routes/config.js`). Either is fine to follow for a new call site; consider normalizing to one if you're already touching this area.

`GET /api/system/cache-version` is polled by both bots every 30s; `POST /api/system/invalidate-cache` (admin-only) lets an admin force it. On the bot side, `api/cacheRefresh.js`'s poller only calls `reloadAllCaches()` (`loadConfig()` + trigger/link-host/response-function cache refresh) when the version actually changed since last check. **Practical consequence: any config/trigger/link-replacement edit made through webadmin takes up to 30 seconds to reach a running bot — it is not instant**, and that's true for both discord-bot and fluxer-bot independently.
