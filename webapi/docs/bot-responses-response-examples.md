# Bot Responses – Response Examples

## POST /api/bot-responses/fortune

**200 OK**

```json
{
  "ok": true,
  "response": "Yes, definitely."
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get fortune"
}
```

---

## POST /api/bot-responses/link-fixer

Body: `{ message, app, guildId }`. `twitter_fix_enabled` is read from that server's `guild_config`. `response` is the submitted link with `source_host` replaced by `target_host` (scheme/path/query untouched) — not prefixed with any extra text.

**200 OK** (link was fixed)

```json
{
  "ok": true,
  "response": "https://fixvx.com/user/status/123"
}
```

**200 OK** (no fix needed; empty response)

```json
{
  "ok": true,
  "response": ""
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to fix link"
}
```
