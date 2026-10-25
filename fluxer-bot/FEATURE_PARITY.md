# fluxer-bot feature parity checklist

Tracks porting `discord-bot/` features to `fluxer-bot/` (see root `CLAUDE.md` and
`discord-bot/README.md` for the canonical description of each). Check items off as they land;
leave a short note + PR/commit link when a port deviates from the Discord behavior (e.g. a
fluxer.js API gap forces a different implementation).

## Message handling (every non-bot message)

- [x] Link fixing — rewrite configured social hosts into embed-friendly links (`twitter_fix_enabled`)
- [x] Trigger responses — string match → `random`/`ordered`/`weighted` reply selection, optional `response_function` dispatch (`trigger_responses_enabled`). Note: the `TAL_timeout` response function is stubbed to a plain reply on fluxer-bot (no confirmed fluxer.js member-timeout equivalent yet — see the Timeout vote section).
- [x] 8-ball/fortune — `@bot ...?` → random fortune (`eight_ball_enabled`)
- [x] Emoji tracking (message content) — records emoji usage (`emoji_tracking_enabled`)
- [x] Sticker tracking — records sticker usage (`sticker_tracking_enabled`)
- [x] Plus/minus from text — `word++` / `user++` / `--` parsing, plus milestone announcements (`plusplus_enabled`)
- [x] Scheduled reminders (create) — `@bot remind me ...` natural-language parse → stored for later delivery (`reminders_enabled`). Note: the reply-with-no-explicit-time deep-link body guesses at a Discord-style `{instanceUrl}/channels/.../.../...` URL — unverified against a real Fluxer instance, since no message-permalink getter exists on fluxer.js's `Message`. Delivery also fans out cross-platform: if the requester has a linked Discord account too, discord-bot DMs them the same reminder — see `webapi/docs/README.md`'s scheduled-messages section (`deliveryKind`/`POST /:id/delivered`).

## Reaction handling

- [ ] Pinning — threshold reached → pin embed + log + optional pin quip (`pin_system_enabled`)
- [ ] Plus/minus votes — add/remove configured emoji (no self-vote), plus the "reply with one +/- emoji" shortcut (`plusplus_enabled`)
- [ ] Emoji stats (reactions) — other emoji reactions count toward leaderboards (`emoji_tracking_enabled`)
- [ ] Repost accusation — add/remove configured emoji records or withdraws (`repost_detection_enabled`)
- [ ] **Timeout vote** — role-weighted reaction voting that times out a message's author (`timeout_vote_enabled`, defaults `"false"`). See [Timeout vote detail](#timeout-vote-detail) below — this one needs a fluxer.js moderation-action equivalent confirmed before porting.

## Slash commands (12)

- [ ] `/dixbot` — short help/reference
- [ ] `/plusplus-total` — ++ score for a word or user
- [ ] `/plusplus-leaderboard` — top and bottom 5 plusplus scores
- [ ] `/plusplus-top-voters` — top 3 plusplus voters
- [ ] `/plusplus-voter-frequency` — how many times a user has +/-'d something
- [ ] `/top-emojis` — top 5 most used emojis
- [ ] `/reposts-by-user` — repost count for a user
- [ ] `/top-reposters` — top 5 reposters
- [ ] `/pin-message` — manually pin a message into the pin flow
- [ ] `/scheduled-list` — list your upcoming scheduled reminders (UTC)
- [ ] `/scheduled-update` — update a pending reminder's time and/or message
- [ ] `/scheduled-delete` — delete a pending reminder by id
- [x] `link-accounts` / `confirm-link` — user-initiated account linking (new in both bots). fluxer.js has no slash commands, so these are prefix commands (`FLUXER_COMMAND_PREFIX`, default `!`)

Needs `@fluxerjs/builders` (command builder) + `@fluxerjs/rest` (deploy) adopted first — not installed yet (see `fluxer-bot/README.md`).

## Background/runtime behavior

- [x] webapi JWT auth with auto-relogin on 401 — `api/client.js` plumbing already exists in the base template; now actually used by the message-handling port's API modules
- [x] Cache-version polling → refresh in-memory triggers/link-hosts/config (ported as a prerequisite for message handling: `api/cacheRefresh.js`, `configStore.js`)
- [x] Heartbeat to webapi; `wait-for-webapi` health gate on container start — `api/system.js` `startHeartbeat`
- [x] Guild snapshot sync (metadata/channels/roles) on startup + every 5 min — `api/guildInfo.js`; no description/preferredLocale/boost-tier concept on fluxer.js, sent as `null`
- [x] Guild member sync (nickname/roles/joined-at) on startup + every 5 min — unlinked members synced, not skipped (already done pre-this-pass)
- [x] `guildMemberAdd`-equivalent → immediate single-member sync (already done pre-this-pass)
- [x] Emoji/sticker catalog import from guild on ready — `api/emojis.js`/`api/stickers.js` `importEmojiList`/`importStickerList`
- [x] Pin-history hydration on startup — `events/connection/utilities/pinHistoryHydration.js`; simplified vs. discord-bot's: no thread paging, no embed-hint scraping, attachments passed through as remote URLs (no local download/archival)
- [x] In-process scheduler delivering reminders at their scheduled time (`scheduler/messageScheduler.js`, `setInterval`-based — see commit for why this skips `toad-scheduler`)
- [ ] Optional slash-command clear+redeploy on container start (`DEPLOY_SLASH_COMMANDS`)
- [x] Online-announce message on ready (prod posts to announce channel; dev just logs) — tied to `ready.js`'s own handler rather than discord-bot's racy post-login block, a deliberate improvement
- [x] Metrics counters (messages/commands/errors/joins/leaves/shard-errors/etc.) — `utilities/metrics.js`; no fluxer.js rate-limit client event exists, so `discordRateLimitHitsTotal`'s equivalent is omitted entirely

## Maintenance scripts

Nothing: Fluxer doesn't have discord-style commands, so no need for `deploy-commands.js` / `delete-all-commands.js` equivalents

## Feature toggles (webapi `guild_config`, hot-reloaded ≤30s)

All of these are webapi-side config, not bot code — the bot side of the work is just honoring the
same keys. Listed here so nothing gets ported without checking its toggle still gates it in
fluxer-bot.

- [x] `twitter_fix_enabled`
- [x] `trigger_responses_enabled`
- [x] `reminders_enabled`
- [x] `eight_ball_enabled`
- [x] `emoji_tracking_enabled`
- [x] `sticker_tracking_enabled`
- [x] `plusplus_enabled`
- [ ] `repost_detection_enabled`
- [ ] `pin_system_enabled`
- [ ] `timeout_vote_enabled` (defaults `"false"`, unlike the rest)

---

## Timeout vote detail

Undocumented in `discord-bot/README.md` until this pass — now also written up there. Full
mechanics, for porting:

- **Trigger**: react to a message with the configured `timeout_vote_emoji`. No self-votes.
- **Vote weight**: 1x by default; 2x if the voter holds `timeout_vote_double_role_id`; 3x if they
  hold `timeout_vote_triple_role_id` (triple checked first, so triple wins if a user holds both).
  Resolved client-side in `discord-bot/events/messages/utilities/reactionHandler.js`
  (`resolveTimeoutVoteWeight`) from the reacting member's roles — Fluxer's role/member cache
  equivalent needs the same lookup.
- **Server-side tally**: `POST /api/message-processing/timeout-vote` (webapi,
  `services/timeoutVotes.js`) inserts into `timeout_vote_tracking` (unique per message+voter,
  mirrors `plusplus_tracking`) and sums `weight` for the message. No change needed on webapi for
  fluxer-bot — same endpoint, same `app` discriminator pattern. **webapi's chat-app enum now
  includes `"fluxer"`** (`CHAT_MEMBER_APP_CONFIG` in `services/chatMemberMapping.js`) — just pass
  `app: "fluxer"` instead of `"discord"` when wiring this up from fluxer-bot.
- **Threshold + action**: once the running weighted total ≥ `timeout_vote_threshold` (guild_config,
  integer), webapi inserts a `timeout_history` row (unique per `message_id` — the idempotency
  guard; further votes or un-votes on that message become no-ops) and returns
  `{ triggered: true, durationSeconds, responseMessage, voteWeightTotal }`.
  - `durationSeconds` = `timeout_vote_duration_seconds` (guild_config), clamped `[1, 86400]`
    (platform max timeout is capped at 24h for Discord — confirm Fluxer's own member-timeout max
    duration, if it has an equivalent action at all, before reusing this clamp).
  - `responseMessage` = `timeout_vote_response_message` (guild_config), with `{user}` replaced by
    a mention of the timed-out user; defaults to `"{user} has been timed out by community vote."`.
- **Un-vote**: reaction-remove → `POST /api/message-processing/timeout-vote/remove`, deletes the
  voter's row from `timeout_vote_tracking` (no-op if the message already triggered).
- **Apply the timeout**: `discord-bot/utilities/timeoutMember.js` calls discord.js's
  `GuildMember#timeout()` (communication-disabled, max 24h, requires Moderate Members permission +
  role hierarchy above the target). **This is the piece that needs a confirmed fluxer.js
  equivalent before porting** — check whether Fluxer has a member-mute/timeout moderation action at
  all, and if so its permission model and max duration, before assuming this maps 1:1.
