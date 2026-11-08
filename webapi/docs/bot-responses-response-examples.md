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

---

## POST /api/bot-responses/facebook-marketplace

Body: `{ url, app, guildId }`. `facebook_marketplace_enabled` is read from that server's `guild_config` (re-checked server-side, not just a bot-side skip). Results are cached by listing id for `FACEBOOK_MARKETPLACE_CACHE_TTL_DAYS` (default 7) — a repeat request for the same listing returns instantly without re-fetching Facebook.

**200 OK** (a Marketplace listing)

```json
{
  "ok": true,
  "isMarketplaceListing": true,
  "listing": {
    "id": "1157528266644960",
    "url": "https://www.facebook.com/marketplace/item/1157528266644960/",
    "title": "2017 Chevrolet Corvette · Stingray",
    "price": "$37,000",
    "location": "Burke, VA",
    "description": "7speed, Corvette Stingray 1LT\n\n6.2 liter V8...",
    "imageUrl": "https://scontent-iad6-1.xx.fbcdn.net/v/t39.30808-6/..."
  }
}
```

**200 OK** (a facebook.com URL, but not a Marketplace listing — not an error)

```json
{
  "ok": true,
  "isMarketplaceListing": false
}
```

**400 Bad Request** (url isn't a recognized Facebook host — this endpoint fetches the URL
server-side, so this is an SSRF guard, not a soft case)

```json
{
  "ok": false,
  "error": "url must be a facebook.com URL"
}
```
