# Config – Response Examples

## GET /api/config

**200 OK**

```json
{
  "ok": true,
  "config": {
    "take_a_look_delay": "60000",
    "take_a_look_repost_limit": "3",
    "twitter_fix_enabled": "true",
    "rare_frequency": "0.1"
  },
  "entries": [
    { "config": "take_a_look_delay", "value": "60000" },
    { "config": "take_a_look_repost_limit", "value": "3" },
    { "config": "twitter_fix_enabled", "value": "true" },
    { "config": "rare_frequency", "value": "0.1" }
  ]
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

**404 Not Found** (config key does not exist)

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
