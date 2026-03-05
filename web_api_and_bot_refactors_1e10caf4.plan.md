---
name: Web API and Bot Refactors
overview: Refactor the webapi routes and services to remove repeated boilerplate (ID parsing, error handling, response helpers), centralize SQL dialect handling, and fix a crash bug in the discord-bot config. Optionally slim the trigger-responses route file and service.
todos: []
isProject: false
---

# Refactoring Plan: Web API and Discord Bot

## 1. Fix bug: Discord bot config crash (do first)

**File:** [discord-bot/configVars.js](discord-bot/configVars.js)

- **Issue:** Line 26 uses `process.env.DEV_FLAG.length < 1`. When `DEV_FLAG` is unset, `process.env.DEV_FLAG` is `undefined`, so `undefined.length` throws and the bot crashes on startup.
- **Fix:** Guard before using `.length`, e.g. `if (!process.env.DEV_FLAG || process.env.DEV_FLAG.length < 1)` or treat missing as dev. Clarify intent: is production only when `DEV_FLAG` is the string `"false"`? If so, document it and make the length check safe.

---

## 2. Web API: Shared route helpers (high impact)

**Problem:** Every resource route repeats the same patterns: parse `req.params.id` and send 400 if invalid; fetch resource and send 404 if missing; try/catch with console.error and 500. No shared helpers exist today.

**Add in** `webapi/` (new or existing middleware/helpers):

- **Parse numeric ID:** e.g. `parseIdParam(req, res, paramName = 'id')` — returns the parsed number or sends `res.status(400).json({ ok: false, error: 'Invalid id' })` and returns `null`. Caller can `if (id === null) return;`.
- **Optional: async wrapper:** e.g. `asyncHandler(fn)` that wraps `(req, res) => Promise.resolve(fn(req, res)).catch(err => { console.error(err); res.status(500).json({ ok: false, error: '...' }); })` so route handlers don’t repeat try/catch. If you prefer explicit try/catch everywhere, skip this and only add the ID helper.
- **Optional: response helpers:** e.g. `sendNotFound(res, message)` and `sendBadRequest(res, message)` that send the usual `{ ok: false, error }` so you don’t repeat the same JSON in every route.

**Use these in:** [webapi/routes/trigger-responses.js](webapi/routes/trigger-responses.js), [webapi/routes/link-replacements.js](webapi/routes/link-replacements.js), [webapi/routes/pin-quips.js](webapi/routes/pin-quips.js). Refactor each “get/put/delete by id” handler to use the ID helper (and optionally the response helpers and asyncHandler). This will remove a large amount of duplicated code.

---

## 3. Web API: Centralize SQL dialect (MySQL vs SQLite)

**Problem:** Dialect checks and SQL fragments are repeated in multiple places:

- [webapi/services/triggerResponses.js](webapi/services/triggerResponses.js): `isSqlite`, `orderByResponseOrderClause`, `RANDOM()` vs `RAND()`, ON CONFLICT vs ON DUPLICATE KEY, `insertId` vs `lastInsertRowid`.
- [webapi/services/pinQuips.js](webapi/services/pinQuips.js): same `(process.env.DB_TYPE ...) === "sqlite"` and `RANDOM()` vs `RAND()`.
- Migration scripts: same `isSqlite` logic.

**Approach:** Add a small dialect module used by config or next to it, e.g. `webapi/config/dbDialect.js` (or export from [webapi/config/db.js](webapi/config/db.js)):

- Export `isSqlite` (single place reading `process.env.DB_TYPE`).
- Export helpers such as: `orderByNullsFirst(column)` (SQL fragment for “NULLs first”), `randomOrderExpr()` (returns `"RANDOM()"` or `"RAND()"`), `insertIdKey` (returns `'lastInsertRowid'` or `'insertId'`). Optionally a small upsert helper for the trigger_response_state pattern.

**Then:** Replace all inline `isSqlite` and dialect-specific SQL in `triggerResponses.js` and `pinQuips.js` with these helpers. Update migration scripts to import from the same place so dialect behavior stays consistent.

---

## 4. Web API: Trigger-responses route file (416 lines)

**Problem:** [webapi/routes/trigger-responses.js](webapi/routes/trigger-responses.js) has many similar handlers (get/put/delete by id for triggers, responses, and junction). Order of route definitions matters (e.g. `/triggers/list` before `/triggers/:id`); keep that in mind.

**Refactor:**

- Use the new route helpers (parseIdParam, optional sendNotFound/sendBadRequest/asyncHandler) so each handler is shorter.
- Optionally extract a small “resource by id” helper, e.g. `withIdParam(req, res, async (id) => { const row = await service.getById(id); if (!row) return sendNotFound(res, '...'); res.json({ ok: true, ...row }); })`, and use it for the repetitive get-by-id and delete-by-id handlers. Same idea for “validate body then call service then return 201/200” for POST/PUT.

No need to split the file into multiple routers unless you add many more endpoints; reducing duplication with helpers is enough.

---

## 5. Web API: Trigger-responses service (479 lines)

**File:** [webapi/services/triggerResponses.js](webapi/services/triggerResponses.js)

**Refactor (in order of impact):**

- **Use dialect module:** Remove local `isSqlite` and all dialect branches; use the new `dbDialect` (or db-exported) helpers. Use `insertIdKey` for `insertId ?? lastInsertRowid` so you don’t repeat that in every insert.
- **Normalize selection_mode:** You already have `VALID_MODES` and repeated `selection_mode && VALID_MODES.includes(selection_mode.toLowerCase()) ? ... : 'random'`. Extract a single `normalizeSelectionMode(mode)` and use it in `getOrCreateTriggerId`, `createTriggerWithResponses`, `updateTrigger`, and inside `getRandomResponse` if applicable.
- **Parse order once:** The pattern “order === undefined || null || '' → null, else Number(order)” appears in multiple places. Extract e.g. `parseOrder(value)` and use it in create/update paths and anywhere you set `response_order`.
- **Optional:** Split the file into 2–3 modules (e.g. junction CRUD, trigger-centric + response CRUD, and selection/state) if you want smaller files. If you prefer one file, keep clear section comments and the above extractions; that already improves readability.

---

## 6. Smaller cleanups (optional)

- **Duplicate 409 handling:** In [webapi/routes/link-replacements.js](webapi/routes/link-replacements.js), POST and PUT both repeat the same duplicate-key check. Extract e.g. `isDuplicateKeyError(err)` and/or `sendConflict(res, message)` and use in both handlers.
- **ensureAdminUser:** Move the logic from [webapi/index.js](webapi/index.js) into a service (e.g. `services/users.js` or `services/admin.js`) and call it from `index.js` so bootstrap stays thin and DB access is consistent.
- **Root endpoint:** The big inline list of routes in `app.get("/", ...)` could be moved to a `routesManifest.js` (or similar) and imported, or generated from the router if you add a small registry. Low priority unless you add many more routes.

---

## Implementation order

1. **Fix configVars.js** (quick, prevents crash).
2. **Add route helpers** and refactor trigger-responses, link-replacements, and pin-quips routes (biggest reduction in duplication).
3. **Add dbDialect** and refactor triggerResponses.js and pinQuips.js (and migrations) to use it.
4. **TriggerResponses service:** normalizeSelectionMode, parseOrder, then optional split.
5. **Optional:** 409 helper, ensureAdminUser, route list.

No new dependencies are required for the route helpers or dialect module; use plain JS. If you later add validation (e.g. Zod/Joi), you can introduce a `validateBody(schema)` middleware in a follow-up.

also put the embed thumbnail url into config
