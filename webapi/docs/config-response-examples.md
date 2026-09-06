# Config – Response Examples

## GET /api/config

**200 OK**

```json
{
  "ok": true,
  "config": {
    "pin_threshold": "3",
    "pin_channel_id": "915462110761349201",
    "twitter_fix_enabled": "true"
  },
  "entries": [
    { "config": "pin_threshold", "value": "3" },
    { "config": "pin_channel_id", "value": "915462110761349201" },
    { "config": "twitter_fix_enabled", "value": "true" }
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
