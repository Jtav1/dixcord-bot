# Guild Emojis – Response Examples

CRUD over the `guild_emojis` catalog (one row per custom emoji/sticker, plus lazily-created unicode rows) by whichever key shape the caller has on hand: a numeric `internalId` surrogate key, the native `(app, id)` pair, or a guild-scoped `(app, guildId, name)`. Row creation is exclusive to the emoji-import/sticker-import sync (see `message-processing-response-examples.md`); these endpoints only Read/Update/Delete. `name`/`imagePath` are the only mutable fields — `id`/`app`/`guildId`/`frequency` stay sync/usage-owned.

## GET /api/guild-emojis/by-guild?app=discord&guildId=100000000000000001&type=emoji

**200 OK**

```json
{
  "ok": true,
  "guildEmojis": [
    {
      "internalId": 42,
      "id": "935029698566717440",
      "app": "discord",
      "guildId": "100000000000000001",
      "type": "emoji",
      "name": "perfect",
      "animated": false,
      "available": true,
      "managed": false,
      "requiresColons": true,
      "roles": [],
      "imagePath": "Emojis/perfect.png",
      "frequency": 12,
      "syncedAt": "2026-11-07T03:12:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

## GET /api/guild-emojis/by-name?app=discord&guildId=100000000000000001&name=perfect

**200 OK**

```json
{
  "ok": true,
  "guildEmoji": {
    "internalId": 42,
    "id": "935029698566717440",
    "app": "discord",
    "guildId": "100000000000000001",
    "type": "emoji",
    "name": "perfect",
    "animated": false,
    "available": true,
    "managed": false,
    "requiresColons": true,
    "roles": [],
    "imagePath": "Emojis/perfect.png",
    "frequency": 12,
    "syncedAt": "2026-11-07T03:12:00.000Z"
  }
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Guild emoji not found"
}
```

---

## PUT /api/guild-emojis/by-name

**Request**

```json
{
  "app": "discord",
  "guildId": "100000000000000001",
  "name": "perfect",
  "imagePath": "Emojis/perfect-renamed.png"
}
```

**200 OK**

```json
{ "ok": true }
```

---

## DELETE /api/guild-emojis/by-name

**Request**

```json
{
  "app": "discord",
  "guildId": "100000000000000001",
  "name": "perfect"
}
```

**200 OK**

```json
{ "ok": true }
```

Hard-deletes the row regardless of `frequency` (an admin/CRUD override — distinct from the sync's own frequency-gated prune). If the deleted row's `imagePath` isn't referenced by any other surviving row, the file is also removed from the shared emoji files volume (best-effort; failures are logged, never thrown).

---

## GET /api/guild-emojis?app=discord&id=935029698566717440

Same response shape as `by-name`, looked up by the native `(app, id)` pair instead. `PUT`/`DELETE` take `{ app, id, ... }` in the body.

---

## GET /api/guild-emojis/:internalId

Same response shape again, looked up by the surrogate `internalId`. `PUT`/`DELETE` take no body key for the id (it's in the path) — just `{ name?, imagePath? }` for `PUT`.

**400 Bad Request** (non-numeric path segment)

```json
{
  "ok": false,
  "error": "Invalid internalId"
}
```

---

## GET /api/guild-emojis/search?type=sticker&animated=false&limit=2

Cross-guild browse for webadmin's catalog page — `app`/`type`/`animated`/`name` filters are all optional and ANDed; `name` is a case-insensitive substring match. Admin-only (no bot ever calls this).

**200 OK**

```json
{
  "ok": true,
  "guildEmojis": [
    {
      "internalId": 162,
      "id": "1091194856996614164",
      "app": "discord",
      "guildId": "551622630516457492",
      "type": "sticker",
      "name": "1738",
      "animated": false,
      "available": null,
      "managed": null,
      "requiresColons": null,
      "roles": [],
      "imagePath": null,
      "frequency": 0,
      "syncedAt": "2026-10-26 06:37:10"
    }
  ],
  "total": 49,
  "limit": 2,
  "offset": 0
}
```

---

## GET /api/guild-emojis/42/image

Streams the row's current image file (`image/png` or `image/gif`, inferred from the extension). Admin-only.

**404 Not Found** (no `imagePath` set, or the file is missing on disk)

```json
{
  "ok": false,
  "error": "No image for this guild emoji"
}
```

---

## POST /api/guild-emojis/42/image

Multipart `image` field. The target filename is always the canonical one webview's name-based lookup expects — `Emojis/<name>.gif` for an animated emoji, `Emojis/<name>.png` for a static one, `Stickers/<name>.png` for any sticker (stickers are always `.png`: webview's own sticker URL builder only ever requests that extension, regardless of format). Unlike the sync downloader, this explicit admin action **overwrites** an existing file. Admin-only.

**200 OK**

```json
{
  "ok": true,
  "imagePath": "Emojis/perfect.png"
}
```

**400 Bad Request** (uploaded file's mimetype doesn't match what the row's name/type/animated combination expects)

```json
{
  "ok": false,
  "error": "This emoji (animated) expects image/gif, got image/png"
}
```

**413 Payload Too Large** (over the 5MB limit)

```json
{
  "ok": false,
  "error": "File too large"
}
```

---

## Guild scoping

`/by-guild` and `/by-name` take `guildId` directly, so a guild-restricted bot service account is checked by the normal `requireOwnGuildOrAdmin` middleware. The bare `(app, id)` and `:internalId` routes have no `guildId` up front — the row is loaded first, then the same restriction is enforced manually against the loaded row's `guildId`:

```json
{
  "ok": false,
  "error": "Forbidden: row does not belong to this service account's guild"
}
```
