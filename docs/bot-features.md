# Bot features (`discord-bot/` and `fluxer-bot/`)

How each major feature is implemented across the two bot clients, side by side, so a feature can be ported from one to the other without re-deriving the mechanics from scratch. Scope is `discord-bot/` and `fluxer-bot/` only — `webapi/`, `webview/`, and `webadmin/` are covered elsewhere.

> **Note:** `fluxer-bot/README.md`, the prose in `fluxer-bot/FEATURE_PARITY.md`, and this repo's `CLAUDE.md`/`docs/code-standards.md` describe fluxer-bot as "base template only — login + ready logging, no feature commands/events yet." That's stale. fluxer-bot currently has 17 commands and 14 event files and near-full parity with discord-bot (plus one fluxer-only feature, `color-me`). Treat this document as current; the "template only" line elsewhere should be updated or removed when next touched.

## Shared shape

Both bots use the same dynamic-loader pattern in `bot.js`: `fs.readdirSync` over `events/<category>/*.js` and `commands/<category>/*.js`, `import()` each module, and register anything shaped like `{name, execute, once}` (events) or `{cmdName, data, execute}` (commands) — malformed modules log a warning and are skipped, not fatal. Every event handler is wrapped in a local `guardEventHandler(eventName, handler)` so a rejected async handler can't crash the process via an unhandled rejection.

`api/client.js` is identical in both bots: `login()` hits `POST /api/auth/login` with `{email, password}` from `WEBAPI_USERNAME`/`WEBAPI_PASSWORD`, caches the JWT in memory, and `request()` auto-logs-in if there's no token and retries once on a `401` after re-login. `get`/`post`/`put`/`patch`/`del` are thin wrappers; `postInChunks(path, base, key, items, {maxBytes=80000})` splits large arrays across multiple requests to stay under webapi's 100kb body limit (used by guild-info/guild-members sync) and sums numeric response fields across chunks.

`configStore.js` is an in-memory per-process cache (`configMap`) populated by `loadConfig()` → `GET /api/config`, exposing typed getters (`getPinThreshold()`, `getPinEmoji()` — returns a resolved `{app, emoid, emoji}` object, not a bare string — `isFeatureEnabled(key)`). Missing/unseeded flags default to **enabled**, except `isTimeoutVoteEnabled()`, `isReactForRoleEnabled()`, and `isFacebookMarketplaceEnabled()`, which default to **disabled** since they're moderation/high-impact rather than default-on content toggles. `api/cacheRefresh.js` polls `GET /api/system/cache-version` every 30s and calls `reloadAllCaches()` (`loadConfig()` + refreshes trigger/link-host/response-function caches) when it changes. Each bot's cache is its own process-local copy — there's no shared cache between discord-bot and fluxer-bot.

`configVars.js` reads env vars: both need `WEBAPI_URL`/`WEBAPI_USERNAME`/`WEBAPI_PASSWORD` and `DEV_FLAG` (→ `dataDirectory`/`isDev`); discord-bot additionally needs `DISCORD_TOKEN`/`CLIENT_ID`/`GUILD_ID`, fluxer-bot needs `FLUXER_TOKEN`/`GUILD_ID` plus `FLUXER_COMMAND_PREFIX` (default `!`) and `FLUXER_INSTANCE_URL` (self-hosted instance discovery).

## discord.js vs. fluxer.js — what actually differs for porting a feature

- **No slash commands in fluxer.js** (`@fluxerjs/builders`/`core` have no `ApplicationCommand`/`Interaction` types) — everything is prefix-text (`FLUXER_COMMAND_PREFIX`, default `!`). A slash command with two options becomes either a single positional arg or a multi-turn DM wizard on the fluxer-bot side.
- **Event handlers don't receive the client as an argument** in fluxer.js (discord.js passes it, e.g. `readyClient`). fluxer-bot works around this with a standalone `fluxerClient.js` singleton that every event file imports directly.
- **No gateway intents concept** in `@fluxerjs/core`.
- **No `GuildMember.manageable`** — fluxer-bot hand-rolls the equivalent in `utilities/roleChecks.js` (`ManageRoles` permission + role-hierarchy position check).
- **`guild.members.me`/`moderatable` need an explicit `fetchMe()`** in fluxer.js before use; this resolves transparently in discord.js.
- **Batched reaction-add gateway event** (`MessageReactionAddMany`) exists only in fluxer.js — fluxer-bot has a dedicated event file for it that loops the shared single-reaction handler sequentially (avoids a webapi insert race).
- **No message permalink getter** (`.url`) on a fluxer.js `Message` — fluxer-bot's embeds guess a Discord-style URL against `FLUXER_INSTANCE_URL`, explicitly flagged as unverified against a real instance in both `messagePinner.js` and `reminderRequest.js`.
- **Self-hosted instance discovery** (`Client.fromDiscovery(instanceUrl)`) is fluxer.js-only; discord-bot just logs in with a token.
- `EmbedBuilder` comes from `@fluxerjs/builders` in fluxer-bot vs. `discord.js` in discord-bot, but the API is close enough that embed-building code reads almost identically.

## Commands

| discord-bot | fluxer-bot | Notes |
| --- | --- | --- |
| `dixbot` | `dixbot` | discord-bot's is a static string pointing at the GitHub README; fluxer-bot's is generated live from `commandRegistry` via `buildCommandListEmbed()`, also reused by the `@bot help` exact-match path and the `help` command. |
| `scheduled-list` / `scheduled-delete` / `scheduled-update` | same (ported) | fluxer-bot's `scheduled-update` is a multi-turn DM wizard (id → time → message, `skip`/`cancel`) instead of named slash options — `utilities/scheduledUpdateWizard.js`. |
| `plusplus-leaderboard` / `plusplus-top-voters` / `plusplus-total` / `plusplus-voter-frequency` | same (ported) | fluxer-bot's `plusplus-total` takes a single positional arg (word or user) instead of two slash options — prefix text can't disambiguate two freeform values. |
| `repost-by-user` | `reposts-by-user` | ported, file renamed. |
| `emoji-leaderboards` (covers `/top-emojis`) | `top-emojis` | ported. |
| `repost-leaderboards` (covers `/top-reposters`) | `top-reposters` | ported. |
| `pin-message` | `pin-message` | discord-bot gates on a configurable `pin_message_role_ids`; fluxer-bot gates on guild Administrator and searches all guild channels (works from DM too). |
| `confirm-link` / `link-accounts` | same (ported) | — |
| — | `remind-me` | fluxer-only; prefix equivalent of the `@bot remind me ...` mention trigger, shares `utilities/reminderRequest.js::handleReminderRequest` with the mention path. |
| — | `help` | fluxer-only; reuses `buildCommandListEmbed()`. |
| — | `color-me` | fluxer-only new feature — see below. |

General reply-channel convention difference: discord-bot's ephemeral slash-command replies become DMs in fluxer-bot (no ephemeral concept in prefix commands); public replies stay as public replies. `utilities/commandHelpers.js` (fluxer-bot only) provides `isExitCommand`, `parseUserMention` (`<@id>`/`<@!id>`), and `sendUsageError(message, command)` which DMs `Usage: <usage>\n<description>`.

## Events

| discord-bot | fluxer-bot | Notes |
| --- | --- | --- |
| wired in `bot.js` (`InteractionCreate` dispatch, `ClientReady` startup) | `connection/ready.js` | fluxer-bot's command dispatch lives inside `messages/messageCreate.js`'s `dispatchCommand()` instead of a dedicated interaction event, since there are no slash commands. |
| `guildMemberAdd.js` | `guild/guildMemberAdd.js` | both sync the new non-bot member immediately. |
| — | `guild/guildMemberRemove.js` | fluxer-only; cleans up a departing member's `color-me` role. Not feature-flag gated — cleanup always runs. |
| `messages/messageCreate.js` | `messages/messageCreate.js` | pipeline is near line-for-line identical; fluxer-bot's additionally handles DM-wizard routing and command dispatch first. |
| reaction add/remove wired directly in `bot.js` (`client.on("messageReactionAdd"/"Remove", ...)`, options bag built inline) | `messages/messageReactionAdd.js` / `messageReactionRemove.js` / `messageReactionAddMany.js` | fluxer-bot factors the options-bag construction into `reactionHandler.js`'s `buildReactionOptions()`/`ReactionCtx` and calls it from three separate top-level files; `AddMany` handles fluxer.js's batched-reaction gateway event with no discord.js equivalent. Same underlying `handleReactionAdd`/`Remove` logic either way. |
| utilities: `pinAttachments.js`, `pinHistoryHydration.js`, `plusplus.js`, `stickerDetector.js`, `emojiDetector.js`, `messagePinner.js`, `reactionHandler.js`, `facebookMarketplaceEmbed.js` | utilities: `pinHistoryHydration.js`, `plusplus.js`, `stickerDetector.js`, `emojiDetector.js`, `messagePinner.js`, `reactionHandler.js`, `facebookMarketplaceEmbed.js` | fluxer-bot has no `pinAttachments.js` equivalent — see Pin system below. |

## Message pipeline (`events/messages/messageCreate.js`, both bots)

Runs in this order on every non-bot message:

1. **Emoji detection** (`emojiDetector.js`) — always runs; no-ops internally if neither plusplus nor emoji tracking is enabled. Regex `/((<|<a):?:\w+:?\d+>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu` extracts emoji tokens, resolved via the client's emoji-parsing helper. If the message is a reply and contains **exactly one** configured plus/minus emoji, it's treated as a vote on the replied-to user (`events/.../plusplus.js`'s `doplus`/`dominus`); otherwise each non-plus/minus emoji is tallied via `countEmoji(name, id, authorId)` (`api/emojis.js`). Custom emoji from an external guild (id not in the bot's own cache) is skipped and logged, not counted.
2. **Sticker detection** (`stickerDetector.js`, if `isStickerTrackingEnabled`) — sequential loop (not `Promise.all`, deliberately, to avoid a webapi insert-if-missing race) calling `countSticker(name, id, authorId)`.
3. **Plusplus text votes** (`plusMinusMsg`, if `isPlusPlusEnabled`) — a cheap regex pre-check for `++`/`--` before calling webapi at all. `recordPlusMinusFromMessage` (`api/plusplus.js`) does all parsing server-side (mentions, word votes, self-vote skip, bare `++`/`--` as a reply); the bot only supplies reply context (`isReply`, `repliedUserId`).
4. **Link fixer** (if `isLinkFixerEnabled`) — checks message words against `getCachedLinkHosts()` (lazily refreshed if null), then `getLinkFixerResponse(content)`.
5. **Facebook Marketplace preview** (if `isFacebookMarketplaceEnabled`, default off) — regex pre-filter for `facebook.com/marketplace/item/<id>` or `/share/...` URLs, `getFacebookMarketplacePreview(url)` per URL, embed via `buildFacebookMarketplaceEmbed`.
6. **Trigger responses** (if `isTriggerResponsesEnabled`) — strips the message to alphanumeric + `!`, substring-matches against `getCachedTriggers()`; `getRandomResponseForTrigger` picks by `selection_mode` (`random`/`ordered`/`weighted`). A response carrying a `response_function` dispatches through `utilities/triggerResponseFunctions.js` (keyed registry by `function_name`; only real entries today are `TAL_timeout` — a 1/N roll that calls `timeoutMember` or falls back to `responseText` — and the no-op `placeholder_message`). This step deliberately clobbers a pending link-fixer reply; that's documented as intentional, not a bug.
7. **Reminders / 8-ball** — only inside an `@bot ...` mention. "remind me ..." calls `parseReminderText` (webapi parses the time) → `createScheduledMessage`, then reacts ✅/❌. A trailing `?` with no other response pending triggers 8-ball. fluxer-bot shares this logic between the mention path and the `remind-me` command via `utilities/reminderRequest.js::handleReminderRequest`.

## Reactions (`events/.../reactionHandler.js`, both bots)

Both resolve a possibly-partial message/reaction first, then classify in a fixed, mutually exclusive priority order: react-for-role message check (bypasses everything else if the reacted message is a bound react-role message) → pin-threshold re-scan (independent of which emoji fired — re-scans *all* reactions on the message for the pin emoji every time) → `classifyReactionEmoji` → pin > plus > minus > timeout-vote > repost > generic. Reaction-remove reverses plus/minus (`dominus`↔`doplus`) and un-counts reposts/timeout votes. Generic emoji reactions check guild-emoji-cache ownership before counting; external emoji are skipped.

discord-bot wires `messageReactionAdd`/`Remove` directly in `bot.js`, building the options bag inline at the call site. fluxer-bot normalizes everything into a shared `ReactionCtx = {message, emoji, userId, member, guildId, client}` via `buildReactionOptions()`, used identically by its add/remove/add-many event files — a cleaner factoring, not a functional difference.

## Pin system

`messagePinner.js` checks idempotency via `POST /api/message-processing/pin-check {app, messageId}`. When the reaction count on the pin emoji crosses the threshold (`pinReact.count === pinThreshold`, exact match, not `>=`), it logs via `POST /api/message-processing/pin-log` (which returns any milestones crossed), builds a red (`0xbc0302`) "📌 Major Pin Alert" embed, and sends it to `getPinChannelId()`. A random quip is pulled from `GET /api/pin-quips/random`, falling back to `"PINNED"` on any failure.

**Key divergence:** discord-bot's `pinAttachments.js` downloads pin attachments to local disk under `files/{images,videos,other}/`, a volume shared with webapi via `PIN_FILES_DIR`. fluxer-bot has no attachment-download step at all — it passes the remote attachment URL straight through, a documented simplification (see the file-level comment in fluxer-bot's `messagePinner.js`). fluxer-bot also has no confirmed message-permalink format; its embed guesses a Discord-style URL against `FLUXER_INSTANCE_URL`, flagged unverified against a real instance.

**Pin-history hydration** (`pinHistoryHydration.js`, runs once at startup via `hydratePinHistory(client)`) backfills incomplete `pin_history` rows (paginated via `listIncompletePinHistory`) by relocating the original message and re-recording author/content/pinners/attachments via `updatePinHistoryRow`. discord-bot's version does full thread paging (active + archived, 5 pages × 100), scrapes the pin channel's own embed URLs for channel hints, and re-downloads attachments. fluxer-bot's is an explicitly "simplified port": no thread paging, no embed-hint scraping, no attachment re-download.

## Timeout-vote moderation (`isTimeoutVoteEnabled`, default off)

Reaction-based voting with role-weighted votes: `resolveTimeoutVoteWeight` checks triple-role (3x) before double-role (2x) before the 1x default, in that order, so a triple-role member's vote wins on priority rather than magnitude alone. Votes are recorded via `recordTimeoutVote(messageId, authorId, voterId, weight)` (`api/timeoutVotes.js`), with server-side idempotency via `timeout_history`. When the API response reports `triggered`, the bot calls shared `utilities/timeoutMember.js` (`member.timeout(ms, reason)`, capped at Discord's 24h max, gated on `member.moderatable`/the fluxer.js equivalent fetched via `guild.members.fetchMe()`), then posts the configured response message with `{user}` substituted. Un-voting on reaction-remove calls `removeTimeoutVote`; this path has **no self-vote guard** in either bot — a known, not-fixed gap called out explicitly in `fluxer-bot/FEATURE_PARITY.md` and an inline comment, not something fluxer-bot introduced.

## React-for-role (`isReactForRoleEnabled`, default off)

discord-bot's `api/reactRoleSync.js` polls webapi every 3s (`listReactRoleMessages`) for admin-configured role-message definitions, reconciles the live message (post/edit/delete) against `contentVersion` vs. `syncedVersion`, pre-reacts with every bound emoji, removes stale bot reactions for removed bindings, and reports failures back via `reportReactRoleSyncFailed`. The reaction handler reads from a module-level cache (`getCachedReactRoleMessage`) populated on each sync tick, rather than hitting webapi per-reaction.

fluxer-bot's `reactionHandler.js` has matching `handleRoleReactAdd`/`Remove` logic, backed by its own `utilities/roleChecks.js` (`manageRolesBlockReason`, `roleBlockReason`) since fluxer.js has no `GuildMember.manageable` to check against — it hand-rolls the equivalent from the `ManageRoles` permission plus role-hierarchy position.

## color-me (fluxer-bot only, new feature, `color_me_enabled`, default on)

`!color-me #RRGGBB|none`. `utilities/colorRole.js` creates or reuses a personal `dixbot-#####` role (5 random lowercase-alphanumeric suffix), persists `{name, hex}` server-side via `setColorRole`/`getColorRole`/`clearColorRole` (`api/guildMembers.js`), and positions the role just below the bot's top role (best-effort — swallows a known `TypeError` quirk where fluxer.js's PATCH response mapping throws even though the underlying 204 reorder succeeded). Exactly one color role is enforced per member; the role is cleaned up on `guildMemberRemove`. A per-user in-flight lock (`withUserLock`) prevents rapid repeat invocations from racing into duplicate roles.

## Scheduler (`scheduler/messageScheduler.js`, both)

discord-bot uses the `toad-scheduler` package (`SimpleIntervalJob`, every 15s); fluxer-bot uses a plain `setInterval` at the same 15s cadence — same effective behavior, different dependency, not a feature difference. Both poll `getDueScheduledMessagesForBot()` (webapi does the due-time comparison) and handle two row kinds:

- `"home"` — this app owns the channel: post the message, then `markScheduledMessageSent`.
- `"foreign"` — another linked app owns the channel: DM the user via `targetPlatformUserId`, then `markScheduledMessageDelivered` (a separate endpoint that never touches the row's own `status`).

## Milestones

`utilities/milestoneNotifier.js` is identical in both bots: `announceMilestones(target, milestones)` is a best-effort fire-and-forget of each milestone's `.message` via `target.reply`/`.send`, called after nearly every increment-style API call (plusplus, emoji, sticker, repost, pin-log) across the codebase.

## Metrics, heartbeat, and guild sync

`utilities/metrics.js` is identical in both bots and matches the counter set documented in [`metrics.md`](metrics.md): an in-memory `counters` object (scalar counters plus three breakdown buckets — `commandsTotal`, `commandErrorsTotal`, `apiCallErrorsTotal`, each keyed by command/module), `incrementCounter(name, key?)`, and `getMetricsSnapshot()` sent verbatim in each heartbeat's `metrics` field. Counters reset on restart — expected, since webapi treats them as Prometheus counters.

`api/system.js` sends `POST /api/system/heartbeat` every 60s with live gateway/guild fields plus the metrics snapshot. `api/guildInfo.js`/`api/guildMembers.js` sync every 5 minutes (plus once at startup) via `POST /api/guild/sync` and `POST /api/guild-members/sync`, both chunked through `postInChunks`. Guild-members sync excludes bot accounts from the roster, but each bot separately registers its own account once via `POST /api/guild-members/register-self` (idempotent) so it still gets a `guild_members` row aliased to a shared bot identity. `requestAccountLink`/`confirmAccountLink` back the `link-accounts`/`confirm-link` commands (`POST /api/guild-members/link-request` / `/link-confirm`).

## Startup scripts

`scripts/start.js` (plus fluxer-bot's `scripts/wait-for-webapi.js`) polls `GET {WEBAPI_URL}/health` every 2s up to 30 attempts, then spawns `bot.js` as a child process. discord-bot additionally handles `DEPLOY_SLASH_COMMANDS` (clears and re-runs `deploy-commands.js`) before spawning; fluxer-bot has no deploy step since there are no slash commands to register. (fluxer-bot's `start.js` still carries a comment claiming "commands/ is empty until the first feature is ported" — stale, same as the README/FEATURE_PARITY prose noted at the top of this document.)
