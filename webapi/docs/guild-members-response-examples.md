# Guild Members – Response Examples

Per-`(app, guild_id, platform_user_id)` server membership (nickname, roles held, joined-at). The identity itself (`chat_member_mapping`) stays global/cross-server — this only tracks how that person shows up in one particular server. The `chat_member_mapping` link is optional: a member is always recorded even if it can't yet be resolved to an identity (see `GET /api/guild-members/unlinked`).

## POST /api/guild-members/sync

**Request**

```json
{
  "app": "discord",
  "guildId": "710671234471559228",
  "members": [
    {
      "platformUserId": "164208106291724298",
      "nickname": "JT",
      "roles": ["612842488302141441"],
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**200 OK**

```json
{
  "ok": true,
  "imported": 1,
  "unlinked": 0,
  "skipped": 0
}
```

`imported` counts every row written, linked or not. `unlinked` counts how many of those had no `chat_member_mapping` match yet (inserted with a null link rather than dropped — this endpoint never creates `chat_member_mapping` rows itself). `skipped` counts entries with no `platformUserId` at all (malformed input).

**403 Forbidden** (guild-scoped bot account's own `guild_id` doesn't match the request's `guildId`)

```json
{
  "ok": false,
  "error": "Forbidden: guildId does not match this service account's guild"
}
```

**400 Bad Request** (missing `guildId`, or unsupported `app`)

```json
{
  "ok": false,
  "error": "guildId is required"
}
```

---

## GET /api/guild-members?app=discord&guildId=710671234471559228

**200 OK**

```json
{
  "ok": true,
  "members": [
    {
      "id": 1,
      "name": "Justin flavored sauce",
      "handle": "normal_justin",
      "platformUserId": "164208106291724298",
      "nickname": "JT",
      "roles": ["612842488302141441"],
      "joinedAt": "2024-01-01 00:00:00",
      "syncedAt": "2026-09-12 07:20:48"
    },
    {
      "id": null,
      "name": null,
      "handle": null,
      "platformUserId": "999999999999999999",
      "nickname": "Ghost",
      "roles": [],
      "joinedAt": null,
      "syncedAt": "2026-09-12 07:20:48"
    }
  ]
}
```

The second entry has no `chat_member_mapping` match yet — `id`/`name`/`handle` are null. See `GET /api/guild-members/unlinked` to list only these.

---

## GET /api/guild-members/unlinked?app=discord&guildId=710671234471559228

Admin-only. Read-only list of `guild_members` rows with no resolved identity link; linking/merging them is a future capability.

**200 OK**

```json
{
  "ok": true,
  "members": [
    {
      "app": "discord",
      "guildId": "710671234471559228",
      "platformUserId": "999999999999999999",
      "nickname": "Ghost",
      "roles": [],
      "joinedAt": null,
      "syncedAt": "2026-09-12 07:20:48"
    }
  ]
}
```

**403 Forbidden** (non-admin caller)

```json
{
  "error": "Admin access required"
}
```

---

## GET /api/guild-members/user/1

Every server this internal `chat_member_mapping.id` belongs to — the primitive a future cross-server feature (e.g. delivering a reminder to every server a user is in) would call.

**200 OK**

```json
{
  "ok": true,
  "servers": [
    {
      "app": "discord",
      "guildId": "710671234471559228",
      "guildName": "Dixon Cox Butte Preservation Society",
      "nickname": "JT",
      "roles": ["612842488302141441"],
      "joinedAt": "2024-01-01 00:00:00"
    }
  ]
}
```

**400 Bad Request** (invalid `chatMemberMappingId`)

```json
{
  "ok": false,
  "error": "Invalid chatMemberMappingId"
}
```
