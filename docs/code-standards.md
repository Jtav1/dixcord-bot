# JavaScript code standards

Conventions observed across this repository's four Node.js/ESM services:

- **`discord-bot/`** — Discord.js v14 bot; depends on `webapi` for almost all behavior.
- **`webapi/`** — Express REST API (MySQL or SQLite), JWT auth; backend for all other services.
- **`webview/`** — Vue 3 + Vuetify public read-only stats site, with a small Express prod server.
- **`webadmin/`** — Admin panel frontend; currently an early-stage Vite scaffold (no framework chosen yet).

This document describes what the code **actually does**, not an aspirational style — match neighboring files in the service you're editing over anything written here if the two disagree. There is no ESLint/Prettier config anywhere in the repo; these conventions are enforced by review, not tooling.

---

## Shared conventions (all four services)

### Language and format

- ESM everywhere (`"type": "module"` in every `package.json`). Explicit `.js` extensions on relative imports (`.vue` too, in webview/webadmin components).
- Semicolons, double quotes, 2-space indent, no tabs. Trailing commas in multiline literals/params.
- One blank line between logical sections and between import groups.

### Imports

- Order: third-party packages first, blank line, then relative project imports. Ordering within a group is not strictly alphabetized in practice — don't rely on it being sorted.
- Named imports preferred. `import * as name` is used when a module is consumed as a whole API surface (`import * as api from "../../api/client.js"`).

### Naming

- Files: kebab-case for route/command files whose name mirrors a URL segment or slash command (`trigger-responses.js`, `plusplus-leaderboard.js`); camelCase for single-purpose utility/service/library modules (`messagePinner.js`, `configStore.js`, `webapiAuth.js`); PascalCase for Vue SFCs (`AppShell.vue`, `EmojiLeaderboardTable.vue`), with page-level components suffixed `View.vue`.
- Variables/functions: camelCase. Constants that are genuinely fixed literals (poll intervals, page sizes, storage keys) use `SCREAMING_SNAKE_CASE` (`POLL_INTERVAL_MS`, `EMOJI_PAGE_SIZE`, `THEME_STORAGE_KEY`); other module-level "constants" (cached config, loaded data) stay camelCase.
- DB columns are snake_case (see `webapi/sql/schema.sql`). JS/JSON fields are camelCase except where a value is passed through directly from a DB row shape — don't force a remapping just for its own sake.

### Functions

- Named `function` declarations are the default for exported/private helpers (this is what `webapi/services/*.js` and `discord-bot/configStore.js` mostly do). Arrow functions are expected and fine for callbacks — Express route handlers, Discord command `execute`, event handler `execute`, array-method callbacks — and for small exported helpers in files that already use that shape throughout (`discord-bot/api/*.js`, `discord-bot/events/messages/utilities/messagePinner.js`). When a file already commits to one style, keep matching it rather than mixing.
- `async`/`await` throughout; no `.then()` chains except the one-off bootstrap `client.login(token).then(...)` in `discord-bot/bot.js`.
- Early returns for guard clauses (`if (!msgid) return false;`).

### Comments and JSDoc

- `/** ... */` block above exported (and most non-trivial private) functions: a short description, then `@param {type} name - description` per parameter, then `@returns {type}`.
- For HTTP handlers / functions that call a specific endpoint, state method + path (and body/query shape) in the description, e.g. `POST /api/message-processing/pin-check with { messageId }`.
- `@private` on helpers not part of a module's public surface. File-level JSDoc on service modules describing their responsibility is common (`webapi/services/*.js`) and worth doing for new ones.
- Inline `//` comments only for non-obvious "why" (a Discord/API quirk, a workaround), on their own line above the code they describe.
- JSDoc coverage is inconsistent in older `discord-bot/commands/` and `discord-bot/events/` files — match the newer, documented style going forward rather than the sparser older one.

### Testing

- **No automated test suite currently exists in any of the four services** — no Jest/Mocha/Vitest dependency, no meaningful `test` script. Don't assume test conventions or a test directory exist; if you add the first tests for a service, that's a structural decision to flag to the user, not something to infer from existing patterns.

---

## discord-bot/

- **Commands** (`commands/<category>/*.js`): default shape `{ cmdName, data: SlashCommandBuilder, execute: async (interaction) => {} }`. Loaded dynamically at boot via `fs.readdirSync` + `import()`; `bot.js` validates the shape and warns on a malformed command rather than crashing.
- **Events** (`events/<category>/*.js`): shape `{ name, execute, once }`, loaded the same dynamic way.
- **`api/client.js`** is the single low-level HTTP client: login, `get/post/put/patch/del`, Bearer JWT, and auto re-login-plus-retry-once on a 401. Resource-specific modules (`api/plusplus.js`, `api/cacheRefresh.js`, etc.) sit on top of it — add a resource module rather than calling `api/client.js` directly from a command or event handler.
- **`configStore.js`** is an in-memory cache of webapi-backed config exposed as getter functions (`getPinChannelId()`, `getPinEmoji()`, ...), populated at boot and refreshed when `api/cacheRefresh.js` detects a cache-version bump. **`configVars.js`** is plain `process.env` reads/validation for local/deploy-time settings. Keep these two separate — don't read `process.env` for values that live in webapi config, or vice versa.
- **Prize/plugin-style handlers**: `utilities/lottoPrizes.js` keys handler functions by `prize_string`, looked up by the trigger-response flow — follow this pattern for similar "string key → handler function" extension points rather than a growing `switch`.
- **Logging**: no library; raw `console.log`/`console.error`/`console.warn`, prefixed with a lowercase module tag (`"bot: ..."`, `"scheduler: ..."`, `"config: ..."`). Use `console.error` for actual failures — several older files log real errors with `console.log`, which is a known inconsistency, not something to copy.
- Deliberate no-op catches (`.catch(() => null)`) are acceptable for genuinely non-critical Discord actions (e.g. reacting with an emoji) but should stay the exception, not the default for error handling.

## webapi/

- **Routes**: `router.<method>("path", authenticate, [requireAdmin|requireBotOrAdmin,] async (req, res) => { try { ... } catch (err) { console.error("<context> error:", err); res.status(NNN).json({ ok: false, error: "..." }); } })`. Apply `authenticate` per route, matching the majority of route files — `routes/users.js` hoists it to a single `router.use(authenticate)`, which is an outlier, not the pattern to copy for new routes.
- **Auth**: JWT via `middleware/auth.js` (`signToken`, `authenticate`, `requireAdmin`, `requireBotOrAdmin`, `optionalAuth`). Three roles: `admin`, `bot`, `webview`; `webview`-role tokens are further restricted to an explicit allowlist of routes/prefixes. The process exits at startup if `JWT_SECRET` is unset.
- **Response shape**: success is `{ ok: true, ...fields }` — lists use a named plural key (`{ ok: true, triggers: [...] }`), sometimes with `total`/pagination metadata; creates return `201`; deletes return `{ ok: true }` with no other body. Errors are `{ ok: false, error: "..." }`. Don't introduce a `message` field or a bare `{ error }` shape — `middleware/auth.js` currently omits `ok: false` in a couple of spots, which is a known inconsistency, not the target shape.
- **DB access**: raw parameterized SQL only, via `db.query(sql, params)` with `?` placeholders — no ORM or query builder. `config/db.js` abstracts MySQL (`mysql2/promise`) vs SQLite (`better-sqlite3`) behind one `.query()` shape; dialect differences (`RAND()`/`RANDOM()`, `ON DUPLICATE KEY UPDATE`/`ON CONFLICT ... DO UPDATE`) are handled inline in services/routes behind an `isSqlite` check, not hidden inside the adapter.
- **Schema**: hand-written `sql/schema.sql` (MySQL) and `sql/schema.sqlite.sql` (SQLite), reconciled at startup by `scripts/ensureSchema.js` using idempotent `tableExists`/`columnExists`/`constraintExists` checks. There is no versioned migration framework — when adding a column or table, update **both** schema files and `ensureSchema.js`.
- **Validation**: hand-rolled inline in handlers (`typeof`/`trim()`/`Array.isArray` + early `400`) — no Joi/Zod/express-validator. Match the neighboring route rather than introducing a validation library.
- **OpenAPI docs**: every route handler carries an `@openapi` JSDoc tag with an inline YAML fragment (method, `operationId`, `tags`, `parameters`/`requestBody`, `responses`), appended to the end of the existing plain-English JSDoc block — see `routes/pin-quips.js` for the canonical shape. `lib/openapi.js` exports `buildOpenApiSpec()` (via `swagger-jsdoc`), which scans `routes/*.js` + `index.js` and merges them with the shared base defined there — security scheme, tag list, and reusable `ErrorResponse`/`AuthErrorResponse` schemas and `Unauthorized`/`ForbiddenRole`/`ForbiddenBotOrAdmin`/`NotFound`/`BadRequest`/`ServerError` responses. That base lives in `lib/openapi.js` only, not duplicated per-route or in `scripts/write-openapi.js`. `index.js` calls the builder once at boot and self-serves the result at `GET /openapi.json` plus a Scalar UI at `GET /docs` (both public) — the reference is always live, no generate step needed to view it. `scripts/write-openapi.js` is a thin CLI wrapper around the same builder for `npm run docs:generate`/`docs:preview`/`docs:build` (writes/validates `openapi.generated.json`, gitignored). New routes need a new `@openapi` block — there's no fallback that infers one.

## webview/

- Vue 3 **`<script setup>`** only (no Options API found anywhere). `src/views/*View.vue` for route-level pages, `src/components/*.vue` for reusable pieces (PascalCase filenames), `src/composables/use*.js` for composition hooks, `src/lib/*.js` for per-feature API wrappers (camelCase).
- `defineProps({...})` / `defineEmits([...])` with typed option objects; `ref` for local state, `computed` for derived values, `watch` to reset state on prop change, `onMounted` kicking off an async load via fire-and-forget `void loadX()`.
- `src/lib/*.js` wrap plain `fetch` (no axios) against same-origin `/api`: check `res.ok`, parse JSON, check an `ok`/`data.ok` field, throw a descriptive `Error` on failure, return a normalized shape. Components catch into paired `loading`/`error` refs. Note: the JSON-parsing helper (`parseJsonResponse`) is currently copy-pasted across multiple `src/lib/*.js` files — when touching one, prefer factoring it into `src/lib/api.js` rather than adding another copy.
- Server side (`server.js` + `lib/webapiAuth.js`): logs into webapi as a service account, caches the JWT with a 5-minute refresh buffer, dedupes concurrent refreshes, and injects `Authorization` onto the `/api` proxy (`http-proxy-middleware`) via a `proxyReq` hook. `lib/webapiAuth.js` is shared with `vite.config.js` for dev/prod parity — reuse it rather than re-implementing token caching.
- `<style scoped>` per component; Vuetify theme configuration is centralized in `src/plugins/vuetify.js`, not scattered per component.
- JSDoc is used consistently here, including in server-side `lib/*.js` — hold this directory to the same JSDoc bar described above, not a lighter frontend-only standard.
- No `@/` path alias is configured in `vite.config.js`; imports are relative throughout. Keep it that way unless the depth of relative imports becomes a real problem worth raising explicitly, rather than adding an alias file-by-file.

## webadmin/

- Currently a minimal scaffold (`src/main.js`, `src/lib/api.js`, `style.css`) with no frontend framework chosen yet — don't infer component conventions from it.
- `server.js` mirrors webview's Express-static-plus-`/api`-proxy shape (health check, `http-proxy-middleware`, static `dist/`, SPA fallback) but **does not yet** attach a service-account JWT to the proxied requests the way webview's does. If/when webadmin starts calling authenticated webapi routes, follow webview's `lib/webapiAuth.js` pattern rather than inventing a second approach.
- Otherwise follows the shared ESM/naming/JSDoc conventions above.

---

## Avoid

- Mixed quote styles (`webapi/routes/users.js` is a known single-quote outlier — don't copy it) or missing semicolons.
- `{ error, message }` or bare `{ error }` (without `ok: false`) error envelopes in webapi — use `{ ok: false, error }`.
- Introducing an ORM, query builder, or request-validation library into webapi without discussion — raw parameterized SQL and hand-rolled validation are the deliberate existing pattern, not a gap to fill unilaterally.
- Silent `catch {}` blocks, except for genuinely non-critical Discord actions where the surrounding code already does this intentionally.
- Copy-pasting a helper (like webview's `parseJsonResponse`) into a new file instead of factoring it into the shared module it already almost lives in.
- JSDoc that only restates the function name.
- Unrelated refactors or drive-by renames bundled with a feature change.

## Reference files

- Discord bot shape + JSDoc style: [`discord-bot/events/messages/utilities/messagePinner.js`](../discord-bot/events/messages/utilities/messagePinner.js)
- Web API route + error/response envelope: [`webapi/routes/trigger-responses.js`](../webapi/routes/trigger-responses.js)
- Web API service module layout: [`webapi/services/messageProcessing.js`](../webapi/services/messageProcessing.js)
- Web API auth middleware: [`webapi/middleware/auth.js`](../webapi/middleware/auth.js)
- Web API OpenAPI base spec + shared components: [`webapi/lib/openapi.js`](../webapi/lib/openapi.js)
- Webview component + composition style: [`webview/src/views/SystemStatusView.vue`](../webview/src/views/SystemStatusView.vue)
- Webview server-side JWT caching: [`webview/lib/webapiAuth.js`](../webview/lib/webapiAuth.js)
