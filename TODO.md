# dixcord-bot TODO

## All bot features (dixcord-bot, excluding webapi)

### Message-triggered responses

- **Take a look at this** – Trigger phrases (e.g. "take a look at this") → random image from DB (common/rare), rate limiting, spam reply.
- **Twitter/social link fixer** – Twitter/x, Instagram, TikTok, Bluesky links + "dd"/"dixbot"/"fix" → reply with vxtwitter/ddinstagram/vxtiktok/bskx link.
- **Fortune teller (8-ball)** – @bot + question ending in `?` → random fortune from DB, with increment.

### Message processing / logging

- **Emoji detector** – Counts server emoji usage in messages (and in-reply plus/minus), writes to MySQL.
- **Plus/minus in messages** – Parses `word++` / `user++` / `--` in message text, applies filter list, records votes in DB.

### Reaction handling (in `bot.js`)

- **Pin by reaction** – Configurable pin emoji + threshold → pin message, log to pin_history, post embed to pin channel.
- **Timeout by reaction** – (Stub only – `timeoutUser` returns false; mod-weighted vote described in comment.)
- **PlusPlus by reaction** – Configurable +/- emoji on message → record vote for message author (excluding self-vote).
- **Emoji frequency by reaction** – Any other server emoji reaction → `countEmoji`.
- **Repost tracking** – Configurable repost emoji on message → count "repost" accusation per (author, message, accuser).

### Slash commands (read/aggregate from DB, format Discord reply)

- `/plusplus-leaderboard` – Top/bottom 5 ++ scores.
- `/plusplus-total` – ++ score for word or user.
- `/plusplus-voter-frequency` – How many ++ votes a user has cast.
- `/plusplus-top-voters` – Top 3 voters.
- `/top-emojis` – Top 5 emoji usage.
- `/top-reposters` – Top 5 repost counts.
- `/reposts-by-user` – Repost count for a user.
- `/dixbot` – Static command reference text.

### Other

- **Startup** – DB init, import configs, import server emoji list into DB, optional version announcement to a channel.

---

## Features that could move to a web API backend

These are ones where the **logic** (and optionally DB access) could live in the API; the bot would only do Discord I/O (receive event → call API → send reply/reaction/pin).

| API Status | Bot hooked up? | Feature                             | Why it fits the API                                                                                                           | What stays in bot                                                                                          |
| ---------- | -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [ x ]      | [--]           | Take a look at this                 | Link selection (common/rare), rate limit, spam logic, and `incrementTakeALookLink` are pure logic + DB.                       | Detect trigger phrase, send reply with returned URL (or "No spam").                                        |
| [ x ]      | [--]           | Fortune teller (8-ball)             | "Pick random fortune" + `incrementFortune` is logic + DB.                                                                     | Detect @bot + `?`, send returned fortune text.                                                             |
| [ x ]      | [--]           | Twitter/social link fixer           | URL parsing and domain swap rules are stateless logic; config (e.g. `twitter_fix_enabled`) can be read by API.                | Detect links + keywords, send returned "fixed link" string.                                                |
| [--]       | [--]           | PlusPlus (reactions and in-message) | Recording a vote (`doplus`/`dominus`) and all reads (scores, leaderboards, voter stats) are DB ops.                           | Parse reaction/message, send (target, type, voter); for commands, call API and format embeds.              |
| [--]       | [--]           | Leaderboards / stats commands       | All of: plusplus leaderboard/total/voter/top-voters, top emojis, top reposters, reposts-by-user are "query DB → return data". | Slash command handler calls API, maps response to Discord embed/text.                                      |
| [--]       | [--]           | Emoji frequency (counts)            | `countEmoji`, `countRepost`, `uncountRepost` (and related reads) are DB writes/reads.                                         | On reaction add/remove, send (emoji, user, message, type) to API; bot applies result (e.g. no reply).      |
| [--]       | [--]           | Pin decision + pin log              | "Should we pin?" (already pinned? threshold?) and `logPinnedMessage` / `isMessageAlreadyPinned` are logic + DB.               | On reaction add: send message id + reaction count; if API says "pin", perform pin + post embed to channel. |

### Not a good fit to move to API (Discord-bound)

- **Pin execution** – Actually pinning the message and sending the embed to the pin channel must stay in the bot (Discord API).
- **Timeout execution** – When you implement it, timing out a member is Discord API only; "should we timeout?" (vote count, mod weight) could be API.
- **/dixbot** – Static text; could be served by API but no real gain.
- **Startup emoji import** – Syncing guild emojis to DB could be an API endpoint the bot calls once on ready, but it's optional.

### Summary

The features that are **best candidates to move to a web API** are: **Take a look**, **Fortune teller**, **Twitter/social link fixer**, all **PlusPlus** logic and reads, **emoji/repost counting** and their leaderboards, **pin decision + pin logging**, and **chatlog sanitization/writing**. The bot would keep: receiving Discord events, calling the API, and performing Discord-only actions (pin, timeout, send message/embed).
