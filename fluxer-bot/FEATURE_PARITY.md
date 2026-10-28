# fluxer-bot feature parity checklist

Tracks porting `discord-bot/` features to `fluxer-bot/` (see root `CLAUDE.md` and
`discord-bot/README.md` for the canonical description of each). Check items off as they land;
leave a short note + PR/commit link when a port deviates from the Discord behavior (e.g. a
fluxer.js API gap forces a different implementation).

## Message handling (every non-bot message)

donne

## Reaction handling

done

## Slash commands (12)

All ported as `!`-prefix commands (`FLUXER_COMMAND_PREFIX`, default `!`) — fluxer.js has no
slash-command primitive (`@fluxerjs/builders`/`@fluxerjs/core` have no `ApplicationCommand`/
`Interaction` types), confirmed still true as of this port.

Every command also works via DM to the bot, except while the user is already mid a
prompt-response chain (today just `scheduled-update`'s wizard) — a DM then routes to that
instead until it ends or the user replies `exit`.

- [x] `dixbot` — command reference, generated live from the command registry (not hand-maintained)
- [x] `plusplus-total` — ++ score for a word or user. Deviation: a single arg only (`<word|@user>`), not both at once like the original two-option slash command — text parsing can't disambiguate two freeform values
- [x] `plusplus-leaderboard` — top and bottom 5 plusplus scores
- [x] `plusplus-top-voters` — top 3 plusplus voters
- [x] `plusplus-voter-frequency` — how many times a user has +/-'d something
- [x] `top-emojis` — top 5 most used emojis
- [x] `reposts-by-user` — repost count for a user
- [x] `top-reposters` — top 5 reposters
- [x] `pin-message` — manually pin a message into the pin flow. Reply visibility: DM (discord-bot's ephemeral reply); the pin embed/quip side effect stays public. Deviation: gated to guild Administrator permission rather than discord-bot's configurable `pin_message_role_ids` list; searches all of the guild's channels for the id (not just the invoking channel), so it also works when run from a DM
- [x] `scheduled-list` — list your upcoming scheduled reminders (UTC), sent via DM
- [x] `scheduled-update` — update a pending reminder's time and/or message. Deviation: collected as a multi-turn DM wizard (id → time → message, `skip`/`cancel` supported) instead of named slash options, since prefix text can't cleanly carry two optional freeform values in one line
- [x] `scheduled-delete` — delete a pending reminder by id, replies via DM
- [x] `link-accounts` / `confirm-link` — user-initiated account linking (new in both bots)

Ephemeral discord-bot replies → DM here; public discord-bot replies → chat reply here. A command's
`featureKey` (soft kill-switch) and missing/invalid-argument validation both DM the invoker instead
of posting publicly.

## Background/runtime behavior

done

## Maintenance scripts

done

## Feature toggles (webapi `guild_config`, hot-reloaded ≤30s)

done
