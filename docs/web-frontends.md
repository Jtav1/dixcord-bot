# webview and webadmin

Developer reference for the two Vue frontends — `webview/` (public, read-only) and `webadmin/` (internal-only, full control panel). Neither has had much written documentation before this; both are Vue 3 + Vuetify + Vite with an Express production server, and share enough plumbing that it's worth reading both sections even if you only touch one.

> **Stale-doc note:** `webadmin/README.md` and `CLAUDE.md` both still describe webadmin as a "scaffold" (port 3001, "currently a minimal scaffold"). That's out of date — it's a 15+ feature admin app today (pagination, forms, dialogs, a nav-driven route table). Treat this document as current; those lines should be fixed when next touched, same as the fluxer-bot "base template only" staleness fixed earlier.

## Shared plumbing (true of both apps)

- **No Vuex/Pinia.** State is composables + `ref`/`reactive`, fetched fresh per view mount — there's no global store.
- **Composition API only** — every component uses `<script setup>`; no Options API anywhere.
- **No ESLint/Prettier**, consistent with the rest of the repo — conventions are enforced by matching neighboring files.
- **`src/lib/api.js`** is just `export const API_BASE = "/api"`. **`src/lib/http.js`** (`apiFetch`/`apiFetchJson`, plus `apiFetchForm` in webadmin for multipart uploads) wraps `fetch`, enforces webapi's `{ok, error}` envelope, and throws `Error(data.error || ...)` on any non-OK response or `ok: false` body. Every feature module under `src/lib/*.js` (one per resource) is a thin wrapper around this.
- **`lib/webapiAuth.js`** (same shape in both): on server boot, logs into webapi as a service account (`webview` creds in webview, `ADMIN_USERNAME`/`ADMIN_PASSWORD` in webadmin), caches the JWT in a module-level variable, and refreshes it ~5 minutes before expiry.
- **`server.js`** (same skeleton in both): `helmet()` with a CSP permitting self + Google Fonts, `express-rate-limit` on `/api` (`<APP>_API_RATE_LIMIT_MAX` env, default 120/min/IP), `/health`, a proxy (`createProxyMiddleware`) whose `proxyReq` hook stamps the cached service-account JWT onto every `/api/*` request, `express.static(distDir)`, and a catch-all SPA fallback to `index.html` for non-`/api` paths (502 JSON for an unreachable `/api` path).
- **Critical consequence of the above: there is no per-visitor auth in either app.** The browser never sees a webapi token at all — every request rides on the one shared service-account identity, server-side. webview's requests are effectively anonymous-but-scoped (webapi additionally restricts the `webview` role to an explicit read-mostly route allowlist, per `CLAUDE.md`'s Auth model). webadmin has **no login screen, no per-admin identity, no logout button** — every visitor who can reach the app has full admin access. Don't build a feature that assumes "the logged-in admin's identity" exists anywhere in webadmin's frontend; it doesn't.
- **`useThemePreference()` composable** — identical in both, wraps Vuetify's `useTheme()` and persists the choice to `localStorage`.
- A shared `.glass-card` CSS class convention shows up in both apps' components (e.g. `UserIdentityChip.vue` in webview, `ConfirmDialog.vue` in webadmin) — reuse it for any new card/dialog rather than inventing a new look.

## webview (`webview/`, public read-only, port 3002 default)

Routing is flat and public — no guards, no per-guild picker. `router/index.js`: `/` redirects to `/system-status`, plus `/pin-archive`, `/emoji-count`, `/sticker-count`, `/plusplus-rankings`, `/statistics`, `/trigger-history` (+ `/trigger-history/:id` detail), `/system-status`, `/timeout-votes`. Unlike webadmin, there's no multi-guild/app URL param anywhere — every page shows whatever its backing query returns, single-deployment-assumed.

Structure: `src/views/*.vue` (8 pages) + `src/components/*.vue` (10, mostly per-feature leaderboard/table panels, one paired with each `src/lib/*.js` module) + `src/composables/useThemePreference.js` + `src/plugins/vuetify.js`.

`UserIdentityChip.vue` is the one reusable identity-display component: a `v-chip` that opens a `v-menu` on click, lazily loading per-guild handle/nickname via `fetchAliasesForMapping(mappingId)` only once per distinct `mappingId`. Its collapsed label precedence is `props.name || props.nickname || props.handle || props.platformUserId || "Unknown"` — note `name` is just whatever the caller passes in (typically a mapping's resolved default-alias handle); there's no stored display-name column on `chat_member_mapping` to read from (see [`webapi-internals.md`](webapi-internals.md)'s user-mapping data model — `chat_member_mapping` stores only an id).

`lib/emojiFilesMiddleware.js::createCaseInsensitiveEmojiFilesMiddleware` builds a lowercase filename index for `Emojis/` only (also resolves the directory name case-insensitively), rewrites `req.url` to the real on-disk casing, then delegates to `express.static`. It's mounted at `/files` and falls through untouched for any other path under it — **`Stickers/` and friends get no case-insensitive handling**, so their on-disk filenames must already match the DB's casing exactly. The index is built once at middleware creation and lazily rebuilt only if it was empty (handles the directory not existing yet at boot).

## webadmin (`webadmin/`, internal-only control panel, port 3001 default)

**Routing/tab model** (`src/nav/clients.js` + `src/router/index.js`): not a literal tab row — a single top-level mode selector between "Global" and a specific bot+guild. Two arrays drive it:

- `GLOBAL_FEATURES` (13 entries, routed `/global/:feature`): dashboard, triggers, pin-quips, eight-ball, link-replacements, user-mappings, unmapped-users, activity, milestones, pin-archive, audit-log, guild-emojis, reminders.
- `BOT_FEATURES` (2 entries, routed `/bot/:app/:guildId/:feature`, with `app`/`guildId` read directly from route params): **`config` and `react-for-role`** — both are guild-scoped today.

The route table itself is generated programmatically from those two arrays plus a `FEATURE_COMPONENTS` lookup map, falling back to a generic `ComingSoonView` for any nav entry that doesn't have a real component yet. **Practical pattern: to start a new guild-scoped or global feature, add it to the relevant array in `nav/clients.js` first — it renders as a placeholder page immediately — then wire up the real component in `FEATURE_COMPONENTS` when ready.** This is the intended incremental-build flow, not a gap to work around.

Structure: `src/views/*.vue` (16 pages) + `src/components/*.vue` (14) + `src/composables/{usePaginatedResource,useSnackbar,useThemePreference}.js` + `src/lib/*.js` (22 resource modules).

`usePaginatedResource(fetchPage, {pageSize=25})` is the standard list-table state machine: takes a `fetchPage({limit, offset}) => {items, total}` function, returns `{items, total, page, loading, error, pageSize, totalPages, load}`. Reach for this instead of hand-rolling pagination state in a new view — it's already used across every paginated table in the app. `useSnackbar.js` backs `GlobalSnackbar.vue` for app-wide toast notifications.

**Views** (one line each): `DashboardView` (overview/links), `ConfigView` (guild-scoped config+flags editor, via `ConfigSettingsForm.vue`), `TriggerResponsesView` (via `TriggerResponseEditor.vue`), `PinQuipsView`, `EightBallView`, `LinkReplacementsView`, `UserMappingsView` (via `MappingAliasesPanel.vue`/`MemberAliasesDialog.vue`), `UnmappedUsersView` (the "link this guild member to an identity" admin UI, pairs with `UserIdentityDisclosure.vue`), `RemindersView`, `ActivityView` (composes `EmojiLeaderboardPanel`/`PlusplusLeaderboardPanel`/`RepostLeaderboardPanel`/`StickerLeaderboardPanel`/`RawEventsPanel`), `MilestonesView`, `PinArchiveAdminView`, `AuditLogView`, `ReactForRoleView` (guild-scoped, via `ReactRoleMessageEditor.vue`), `GuildEmojisView` (catalog browser + image replace — reads/writes images as data URIs through webapi, since webadmin doesn't mount a `/files` static directory of its own the way webview does), `ComingSoonView`.

**`ConfirmDialog.vue`** is the standard destructive-action confirmation pattern: a reusable `v-dialog` with `modelValue`/`title`/`message`/`confirmLabel`/`loading` props and `confirm`/`cancel` emits. Grep for existing usages before writing a new confirm flow.

## Known inaccuracies in older session notes (corrected here)

If you're consulting prior memory/notes on these apps, two things have changed or were imprecise:

1. "Top tab row... only Config is guild-scoped" is now "a Global/bot-picker mode selector... Config **and** react-for-role are guild-scoped."
2. "`UserIdentityChip.vue` shows `chat_member_mapping.name`" is imprecise — there's no `name` column on `chat_member_mapping` at all (see the data model note above); the chip's `name` prop is just caller-supplied display text.
