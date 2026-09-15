# Config – Response Examples

Every route requires `app` and `guildId` (query for GET/DELETE, body for POST/PUT) — each server gets its own fully independent config, auto-seeded with defaults when first registered via `POST /api/guild/sync`.

## GET /api/config?app=discord&guildId=710671234471559228

**200 OK**

```json
{
  "ok": true,
  "config": {
    "pin_threshold": "3",
    "pin_channel_id": "915462110761349201",
    "twitter_fix_enabled": "true",
    "plusplus_enabled": "true"
  },
  "entries": [
    { "config": "pin_threshold", "value": "3" },
    { "config": "pin_channel_id", "value": "915462110761349201" },
    { "config": "twitter_fix_enabled", "value": "true" },
    { "config": "plusplus_enabled", "value": "true" }
  ]
}
```

**400 Bad Request** (missing `app` or `guildId`)

```json
{
  "ok": false,
  "error": "Parameter \"guildId\" is required"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to load configuration"
}
```

---

## PUT /api/config

**Request**

```json
{
  "app": "discord",
  "guildId": "710671234471559228",
  "config": "twitter_fix_enabled",
  "value": "true"
}
```

**200 OK**

```json
{
  "ok": true,
  "config": "twitter_fix_enabled",
  "value": "true"
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "Body must include 'config' (configuration name)"
}
```

**404 Not Found** (config key does not exist for this server)

```json
{
  "ok": false,
  "error": "Configuration item not found"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to update configuration"
}
```
