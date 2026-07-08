# Deployment Checklist

Use this checklist before deploying a new release of dixcord-bot. The stack has four services (`webapi`, `web-panel`, `web-view`, `discord-bot`) orchestrated by `docker-compose.yml` at the repo root, with optional MySQL.

---

## 1. Version numbers

Bump and verify versions are consistent across the release:

| Location                   | Current field | Notes                                             |
| -------------------------- | ------------- | ------------------------------------------------- |
| `webapi/package.json`      | `"version"`   | e.g. `"v2.2"`                                     |
| `webapi/index.js`          | `API_VERSION` | Semver string returned by `GET /` (e.g. `"v2.2"`) |
| `web-panel/package.json`   | `"version"`   | Match webapi release                              |
| `web-view/package.json`    | `"version"`   | Match webapi release                              |
| `discord-bot/package.json` | `"version"`   | Match webapi release                              |

- [ ] All `package.json` versions updated for the release
- [ ] `API_VERSION` in `webapi/index.js` updated (patch level is fine if others use major.minor)
- [ ] `npm install` run in each service directory so `package-lock.json` lockfile versions match `package.json`
- [ ] Git tag created if publishing images via CI (`vX.Y.Z` or `vX.Y.ZrcN` — see [section 7](#7-github-actions--container-images))

---

## 2. Code review & dependencies

- [ ] All intended changes merged and tested locally
- [ ] No secrets committed (`.env`, `.env.prod`, tokens, passwords)
- [ ] `npm ci` succeeds in `webapi/`, `web-panel/`, `web-view/`, and `discord-bot/`
- [ ] New or changed API routes have corresponding route handlers and auth checks in place

---

## 3. Dockerfiles & compose

Four Dockerfiles: `webapi/Dockerfile`, `web-panel/Dockerfile`, `web-view/Dockerfile`, `discord-bot/Dockerfile`.

- [ ] Base image is current (`node:24-alpine` on all services as of this writing)
- [ ] Multi-stage builds for `web-panel` and `web-view` still run `npm run build` in the builder stage
- [ ] `discord-bot/Dockerfile` still runs `node ./scripts/start.js` (waits for webapi health, optional slash deploy, then `bot.js`)
- [ ] `.dockerignore` in each service excludes `.env` / `.env.*` but does not exclude required runtime files
- [ ] `docker-compose.yml` volume mounts are correct:
  - `discord-bot/files` ↔ `webapi` pin-files volume (`PIN_FILES_DIR=/data/pin-files`)
  - `web-view/files` mounted read-only into web-view (if serving static pin assets)
- [ ] MySQL service blocks uncommented in `docker-compose.yml` if using MySQL (and matching `depends_on` / env on `webapi` and `discord-bot`)
- [ ] Local smoke test: `docker compose up --build` from repo root

---

## 4. Environment files (`.env.prod`)

Each service has a gitignored `.env.prod` (and `.env`). `docker-compose.yml` loads `./<service>/.env` — on the production host, copy or symlink `.env.prod` → `.env` for each service, or point compose at the prod files.

### `webapi/.env.prod`

- [ ] `NODE_ENV=production`
- [ ] `DB_TYPE` set (`sqlite` or `mysql`)
- [ ] Database connection vars set (`DB_FILE` for SQLite, or `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` for MySQL)
- [ ] `JWT_SECRET` is a long random string (rotate if ever exposed)
- [ ] `ADMIN_USERNAME` / `ADMIN_PASSWORD` set for admin panel login
- [ ] `BOT_USERNAME` / `BOT_PASSWORD` set (must match `discord-bot` env)
- [ ] `WEBVIEW_USERNAME` / `WEBVIEW_PASSWORD` set (must match `web-view` env)
- [ ] `CORS_ORIGINS` lists production hostnames/IPs for web-panel (and any other browser clients)
- [ ] `PIN_FILES_DIR=/data/pin-files` when running under compose (or leave unset to use default)
- [ ] `SYNC_SERVICE_PASSWORDS` understood: only set `true` if you intentionally want env passwords to overwrite existing service accounts on every boot

### `web-panel/.env.prod`

- [ ] `PORT=3001`
- [ ] `WEBAPI_URL=http://webapi:3000` (Docker network hostname, not `localhost`)

### `web-view/.env.prod`

- [ ] `PORT=3002`
- [ ] `WEBAPI_URL=http://webapi:3000`
- [ ] `WEBVIEW_USERNAME` / `WEBVIEW_PASSWORD` match `webapi` service account
- [ ] `WEBVIEW_API_RATE_LIMIT_MAX` set appropriately for production traffic

### `discord-bot/.env.prod`

- [ ] `DEV_FLAG=0` (or `false`) for production — non-false values enable dev data paths and announce-channel behavior
- [ ] `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` set
- [ ] `WEBAPI_URL=http://webapi:3000`
- [ ] `WEBAPI_USERNAME` / `WEBAPI_PASSWORD` match `webapi` `BOT_*` credentials
- [ ] `DEPLOY_SLASH_COMMANDS` set intentionally:
  - `true` / `1` — clears and re-registers all guild slash commands on **every** container start (use when command definitions changed)
  - unset / `false` — skip deploy; bot starts after API health check only
- [ ] `PIN_FILES_DIR=/data/pin-files` when using compose volume
- [ ] Optional: `DISCORD_USER_MAPPING_IMPORT_CHANNEL_ID` if using user-mapping import channel

### Cross-service consistency

- [ ] Bot credentials: `webapi` `BOT_*` ↔ `discord-bot` `WEBAPI_*`
- [ ] Web-view credentials: `webapi` `WEBVIEW_*` ↔ `web-view` `WEBVIEW_*`
- [ ] Admin credentials: `webapi` `ADMIN_*` used by web-panel login flow

---

## 5. Database & data

- [ ] **SQLite (default):** `DB_FILE` path is on a persistent volume; existing `.sqlite` file backed up before upgrade
- [ ] **MySQL:** schema initialized (`npm run db:setup:mysql` in `webapi/` or equivalent); `mysql_data` volume persisted
- [ ] Schema migrations: `webapi` runs `ensureSchemaMigrations()` on startup (idempotent) — no manual step unless importing legacy data
- [ ] Pin attachment files in `discord-bot/files/` backed up and present on the host before deploy
- [ ] If migrating DB engines or importing a dump, follow `webapi/scripts/` setup docs for the target engine

---

## 6. API documentation

Docs live in `webapi/docs/`. Update when routes, auth requirements, or response shapes change.

- [ ] `webapi/docs/README.md` — route index table matches all exposed routes
- [ ] `webapi/docs/admin-backend-api.md` — admin-panel and role-gated routes documented
- [ ] Category response-example docs updated for any changed endpoints (e.g. `auth-response-examples.md`, `trigger-responses-response-examples.md`, etc.)
- [ ] `webapi/README.md` — setup instructions still accurate if env or DB options changed
- [ ] `webapi/docs/trigger-responses-examples.md` — sample cURL requests current (if trigger API changed)

---

## 7. GitHub Actions & container images

CI workflows build and push signed images to `ghcr.io` on push to `master` and on semver tags:

| Workflow                                    | Image                                |
| ------------------------------------------- | ------------------------------------ |
| `.github/workflows/docker-image-webapi.yml` | `ghcr.io/<owner>/dixbot-webapi`      |
| `.github/workflows/docker-image.yml`        | `ghcr.io/<owner>/dixbot-discord-bot` |

- [ ] Changes pushed to `master` (or tag pushed) so CI builds new images
- [ ] `web-panel` and `web-view` have **no** dedicated GH Actions workflows — build via `docker compose build` on the host or add workflows if needed
- [ ] Production host pulls the intended image tags (or builds locally from the release commit)

---

## 8. Discord slash commands

Only needed when command definitions in `discord-bot/commands/` changed.

- [ ] Set `DEPLOY_SLASH_COMMANDS=true` for **one** bot container start, **or** run manually from `discord-bot/`:
  - `node delete-all-commands.js`
  - `node deploy-commands.js`
- [ ] After deploy, set `DEPLOY_SLASH_COMMANDS=false` again to avoid re-registering on every restart
- [ ] Verify `/dixbot` and other slash commands appear in the guild

---

## 9. Deploy

- [ ] Pull release code / images on production host
- [ ] Place or refresh `.env` files from `.env.prod` for all four services
- [ ] Back up database and `discord-bot/files/` before taking down old containers
- [ ] `docker compose pull` (if using registry images) then `docker compose up -d --build`
- [ ] Watch startup order: `webapi` healthy → `web-panel` / `web-view` / `discord-bot` start

---

## 10. Post-deploy verification

### Health checks

- [ ] `GET http://<host>:3000/health` → `{ "status": "ok" }`
- [ ] `GET http://<host>:3001/health` → OK (web-panel)
- [ ] `GET http://<host>:3002/health` → OK (web-view)
- [ ] `GET http://<host>:3000/` → version matches `API_VERSION`

### Functional smoke tests

- [ ] Admin panel login at `:3001` with `ADMIN_*` credentials
- [ ] Web-view loads at `:3002` (leaderboards, pin archive, etc.)
- [ ] Bot online in Discord; logs show `running in PRODUCTION mode` when `DEV_FLAG=0`
- [ ] `GET /api/system/status` (admin token) shows webapi up, DB connected, bot heartbeat recent
- [ ] Trigger a known bot behavior (link fix, trigger response, or slash command) end-to-end
- [ ] If config/content changed without restart, `POST /api/system/invalidate-cache` (admin) or confirm bot picks up new cache version

### Logs & monitoring

- [ ] `docker compose logs -f webapi discord-bot` — no repeated auth or DB errors
- [ ] Rate limits (`API_RATE_LIMIT_MAX`, `WEBVIEW_API_RATE_LIMIT_MAX`) appropriate under real traffic

---

## 11. Rollback plan

- [ ] Previous image tags or git commit SHA noted before deploy
- [ ] Database and pin-files backup verified restorable
- [ ] Rollback procedure documented for your host (e.g. `docker compose down`, restore backup, `docker compose up` with previous images)

---

## Quick reference: service ports

| Service     | Port | Depends on           |
| ----------- | ---- | -------------------- |
| webapi      | 3000 | — (mysql if enabled) |
| web-panel   | 3001 | webapi healthy       |
| web-view    | 3002 | webapi healthy       |
| discord-bot | —    | webapi healthy       |
