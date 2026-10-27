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

done

## Maintenance scripts

done

## Feature toggles (webapi `guild_config`, hot-reloaded ≤30s)

done
