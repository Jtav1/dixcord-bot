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

**200 OK** (link was fixed)

```json
{
  "ok": true,
  "response": "fixed link: https://vxtwitter.com/user/status/123"
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
