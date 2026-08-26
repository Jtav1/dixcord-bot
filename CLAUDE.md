# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Discord-bot: a self-hostable discord bot. This bot is comprised of a web backend `webapi/` and multiple front-ends; `discord-bot/` is the discord bot client built using discordjs, `webview/` is a read-only website for reviewing bot info and stats, and `webadmin/` is an admin-only (and should be locally hosted and inaccessible from the internet really) bot control panel. 

## Git usage restriction

**Never run any git command that changes the state of the repository.** This means no `commit`, `push`, `pull`, `merge`, `rebase`, `reset`, `checkout` (to switch/discard), `branch` (create/delete), `add`, `restore`, `clean`, or anything else that mutates history, the working tree, staged changes, refs, or remotes.

The only permitted git operations are:
- Read-only inspection: `status`, `diff`, `log`, `show`, `blame`, etc.
- `stash` and `stash pop` (reversible, local-only working-tree shelving).

If a task seems to require a state-changing git command, stop and ask the user to run it themselves instead of running it.

## Other Rules

- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason and user approval.
- Lean on the dependencies already in the project before writing your own implementation and adding packages. Do not assume a library lacks a capability without checking its documentation.
- Suggest improvements when planning to facilitate implementation of these rules.

## Commands

### webapi/ (REST API, port 3000 default)

```bash
cd webapi
cp .env.example .env   # first time only
npm install
npm run dev              # node --watch index.js
npm start                # node index.js
npm run db:setup:sqlite  # create/upgrade the SQLite schema (also happens automatically on boot)
npm run db:setup:mysql   # same, for MySQL
npm run docs:generate    # regenerate openapi.generated.json from @openapi JSDoc in routes/*.js + index.js
npm run docs:preview     # docs:generate, then serve it live via Scalar
npm run docs:build       # docs:generate, then validate the spec via Scalar
```

No test suite exists in this service (no `test` script, no Jest/Mocha/Vitest dependency).

### discord-bot/ (Discord.js client, no HTTP port)

```bash
cd discord-bot
cp .env.example .env
npm install
npm run dev    # node --watch bot.js
npm run run    # node bot.js
npm start      # node scripts/start.js (waits for webapi /health, optional slash-command deploy, then bot.js)
node deploy-commands.js       # register/refresh guild slash commands
node delete-all-commands.js   # remove all guild slash commands
```

### webview/ (public read-only site, port 3002 default)

```bash
cd webview
cp .env.example .env
npm install
npm run dev      # vite dev server
npm run build    # vite build -> dist/
npm start        # node server.js (serves dist/ + proxies /api to webapi)
```

### webadmin/ (admin panel, port 3001 default — currently a minimal scaffold)

```bash
cd webadmin
cp .env.example .env
npm install
npm run dev
npm run build
npm start
```

### Whole stack

```bash
docker compose up --build   # webapi + discord-bot + webview + webadmin, webapi healthcheck gates the other three
```

## Architecture

### Four services, one shared backend

- Everything funnels through `webapi/`. `discord-bot`, `webview`, and `webadmin` are independent clients that each authenticate to it with their own service-account JWT (`bot`, `webview`, and `admin` roles respectively — see Auth model). None of the frontends talk to the database directly.
- `docker-compose.yml` at the repo root orchestrates all four services; `webapi` must report healthy (`GET /health`) before `discord-bot`, `webview`, or `webadmin` start.

### webapi request flow

- `index.js` wires, in order: `helmet()` → `cors()` with a custom origin-allowlist function (`CORS_ORIGINS` env, plus a hardcoded `172.21.x.x` CIDR carve-out) → `express.json({ limit: "100kb" })` → per-scope rate limiters (`authLimiter` on `/api/auth`, `apiLimiter` on the rest of `/api`) → one router mounted per resource directly via `app.use("/api/<resource>", ...)` → a 404 handler → a catch-all error-handling middleware.
- There is no `createApp()`/test-harness factory — `index.js` runs top-to-bottom on import and ends in `await ensureSchemaMigrations(); await ensureAdminUser(); ...; app.listen(...)`. This is also why there's no test suite today: the app isn't structured to be built and torn down in-process without side effects (schema migration, service-account upserts).
- On every boot, webapi upserts the three service-account rows (`ensureAdminUser`, `ensureBotUser`, `ensureWebViewUser`) from `ADMIN_*`/`BOT_*`/`WEBVIEW_*` env vars. Existing rows only get their password overwritten when `SYNC_SERVICE_PASSWORDS=true`; role is re-enforced unconditionally either way.

### Auth model

- JWT only (`jsonwebtoken`) — no sessions or cookies. `POST /api/auth/login` (separately rate-limited) exchanges service-account credentials for a token; `POST /api/auth/register` is permanently disabled and always returns `403`.
- Three roles: `admin` (full access; used by the `webadmin` service), `bot` (used by `discord-bot`), `webview` (used by the `webview` service, additionally restricted server-side to an explicit allowlist of read-mostly routes/prefixes). There is no per-end-user auth on webapi — every human interacts through Discord or one of the two web frontends, never webapi directly.
- `middleware/auth.js` exports `signToken`, `authenticate`, `requireAdmin`, `requireBotOrAdmin`, `optionalAuth`. Routes apply `authenticate` per-handler (see [`docs/code-standards.md`](docs/code-standards.md) for the one file that deviates from this).

### Database / schema

- MySQL (`mysql2`) or SQLite (`better-sqlite3`) behind one `config/db.js` adapter, selected via `DB_TYPE`. No ORM or query builder — raw parameterized SQL (`db.query(sql, params)`) throughout.
- Schema is hand-written (`sql/schema.sql` for MySQL, `sql/schema.sqlite.sql` for SQLite) and reconciled idempotently on every boot by `ensureSchemaMigrations()` (`scripts/ensureSchema.js`), which checks current state (`tableExists`/`columnExists`/`constraintExists`) rather than replaying a migration history. When adding a column or table, update **both** schema files and the corresponding check in `ensureSchema.js`.

### File storage (pin attachments, emoji/sticker assets)

- `discord-bot/files/` (`images/`, `videos/`, `other/`) holds Discord pin attachments the bot saves locally. Under compose it's bind-mounted into both `webapi` and `discord-bot` at the same path (`PIN_FILES_DIR=/data/pin-files`).
- `webview/files/` (`Emojis/`, `Stickers/`, `images/`, `videos/`, `other/`) is a separate directory, mounted **read-only** into `webview` and served through a case-insensitive lookup (`webview/lib/emojiFilesMiddleware.js`) at `/files/Emojis/*` etc. It is **not** wired into the same compose volume as `discord-bot/files/` — keep it populated/in sync by whatever process currently does so; don't assume the two are the same underlying directory.

## Code conventions

Full detail in [`docs/code-standards.md`](docs/code-standards.md); highlights that are easy to violate by matching the wrong neighboring file:

- ESM everywhere, explicit `.js`/`.vue` extensions on relative imports, double quotes, semicolons, 2-space indent. No ESLint/Prettier config exists anywhere in the repo — this is enforced by review, not tooling.
- Files: kebab-case for route/command files whose name mirrors a URL segment or slash command; camelCase for single-purpose utility/service/library modules; PascalCase for Vue SFCs.
- Exported/private functions are named `function` declarations by default (arrow functions are fine for callbacks — route handlers, command `execute`, event `execute` — and in files that already commit to that shape throughout). Document with a `/** */` JSDoc block (`@param`, `@returns`); route handlers additionally note HTTP method + path and body/query shape in that JSDoc.
- Every webapi route handler carries an `@openapi` JSDoc tag (inline YAML: `operationId`, `tags`, `parameters`/`requestBody`, `responses`), appended after the existing plain-English JSDoc — `webapi/routes/pin-quips.js` is the canonical example. `webapi/scripts/write-openapi.js` (via `swagger-jsdoc`) merges these into `webapi/openapi.generated.json`; run `npm run docs:generate` after touching a route, `npm run docs:preview` to view it live in Scalar, `npm run docs:build` to also validate the spec. The webapi surface is still documented by hand too, in [`webapi/docs/README.md`](webapi/docs/README.md) (route index) plus per-category response-example files under `webapi/docs/` — update those as well when a route changes; they haven't been superseded by the generated spec.
- Error envelope is always `{ ok: false, error: "human-readable message" }` — never `{ error, message }`. `error` is a free-text sentence (`"Trigger not found"`, `"Failed to list triggers"`), not a fixed snake_case code.
- Success envelope is `{ ok: true, ...fields }`; lists use a named plural key (e.g. `{ ok: true, triggers: [...] }`), not a generic `items`, optionally with `total`/pagination metadata. Creates return `201` + the created resource; deletes return `{ ok: true }`.
- Request validation is hand-rolled (`typeof`/`trim()`/`Array.isArray` checks + early `400`) — match neighboring routes rather than introducing a validation library.
- `catch` blocks: `console.error("<METHOD path> error:", err)` then the appropriate status with `{ ok: false, error: "..." }`.

## Reference checklist for a new webapi route

1. Implement the router in `webapi/routes/<resource>.js`; mount it directly with `app.use("/api/<resource>", ...)` in `webapi/index.js` (there is no stub/factory-mounting indirection to route around).
2. Apply `authenticate` (and `requireAdmin`/`requireBotOrAdmin` if the route is role-gated) per handler, matching neighboring routes; hand-roll body/query validation with early `400`s.
3. If the route needs new columns/tables, add them to **both** `webapi/sql/schema.sql` and `webapi/sql/schema.sqlite.sql`, and add the matching idempotent check to `webapi/scripts/ensureSchema.js`.
4. Add the route to the `GET /` endpoint listing in `webapi/index.js` and to the route table in `webapi/docs/README.md`; add a response-example doc under `webapi/docs/` if the resource category already has one.
5. Add an `@openapi` JSDoc block above the handler (see `webapi/routes/pin-quips.js`); run `npm run docs:generate` to confirm it merges cleanly into `webapi/openapi.generated.json`.
6. There is currently no test suite for webapi — if the user wants coverage for the new route, that's a decision to raise explicitly, not something to skip silently or invent conventions for.
