# Guild Members – Response Examples

Per-`(app, guild_id, platform_user_id)` server membership (Discord handle, nickname, roles held, joined-at). The identity itself (`chat_member_mapping`) stays global/cross-server — the link to it lives in `member_aliases` (one identity, many guild_member aliases), not on this row, and is never set by sync — linking a member to an identity is a manual admin action (see `GET /api/guild-members/unlinked`).

`roles` is stored as bare role id strings (see `POST /api/guild-members/sync` below) but every read endpoint resolves them to full `guild_roles` rows (`attachRoleObjects` in `services/guildInfo.js`) before responding — a role id with no matching `guild_roles` row (deleted or never synced) comes back as `{ id, app, name: null, color: null, position: null, mentionable: null, hoisted: null }` so the id isn't silently dropped.

## POST /api/guild-members/sync

**Request**

```json
{
  "app": "discord",
  "guildId": "710671234471559228",
  "members": [
    {
      "platformUserId": "164208106291724298",
      "handle": "normal_justin",
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
  "skipped": 0
}
```

`imported` counts every row upserted — this endpoint never deletes, so a member who has since left the guild keeps their row as a historical record, and never creates/links `chat_member_mapping`/`member_aliases` rows (identity linking is a separate, manual admin action). `skipped` counts entries with no `platformUserId` at all (malformed input). Safe to call with either a full roster or a single incremental member (e.g. a join event).

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
      "roles": [
        {
          "id": "612842488302141441",
          "app": "discord",
          "name": "Moderator",
          "color": "#5865F2",
          "position": 3,
          "mentionable": true,
          "hoisted": true
        }
      ],
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

The second entry has no `member_aliases` row yet — `id`/`name` are null. See `GET /api/guild-members/unlinked` to list only these. `GET /api/guild-members?app=discord` (omitting `guildId`) returns every member across all guilds, deduplicated by `platformUserId`.

---

## GET /api/guild-members/unlinked?app=discord&guildId=710671234471559228&search=ghost

Admin-only. Read-only list of `guild_members` rows with no `member_aliases` row linking them to an identity. `search` (optional) is a case-insensitive substring match against `handle` or `nickname`. `id` is `guild_members.id` — pass it to `POST /api/guild-members/{guildMemberId}/link` to create the alias link.

**200 OK**

```json
{
  "ok": true,
  "members": [
    {
      "id": 42,
      "app": "discord",
      "guildId": "710671234471559228",
      "platformUserId": "999999999999999999",
      "handle": "ghost_user",
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

## GET /api/guild-members/all?app=discord&search=jt

Admin-only. Every `guild_members` row, linked or not — the manual-link picker's data source. Unlike `GET /api/guild-members/unlinked`, already-linked rows are included (with `linkedMappingId`/`linkedMappingName`), so an admin can see and deliberately move a row to a different identity; linking again just moves it, since `member_aliases.guild_member_id` is unique.

**200 OK**

```json
{
  "ok": true,
  "members": [
    {
      "id": 7,
      "app": "discord",
      "guildId": "710671234471559228",
      "platformUserId": "164208106291724298",
      "handle": "normal_justin",
      "nickname": "JT",
      "roles": [],
      "joinedAt": "2024-01-01 00:00:00",
      "syncedAt": "2026-09-12 07:20:48",
      "linkedMappingId": 1,
      "linkedMappingName": "Justin flavored sauce"
    },
    {
      "id": 42,
      "app": "discord",
      "guildId": "710671234471559228",
      "platformUserId": "999999999999999999",
      "handle": "ghost_user",
      "nickname": "Ghost",
      "roles": [],
      "joinedAt": null,
      "syncedAt": "2026-09-12 07:20:48",
      "linkedMappingId": null,
      "linkedMappingName": null
    }
  ]
}
```

---

## GET /api/guild-members/aliases/1

Admin-only. Every `guild_members` row currently linked (via `member_aliases`) to this `chat_member_mapping` identity — the admin-panel "manage aliases" view for a mapping starts here.

**200 OK**

```json
{
  "ok": true,
  "members": [
    {
      "id": 7,
      "app": "discord",
      "guildId": "710671234471559228",
      "guildName": "Dixon Cox Butte Preservation Society",
      "platformUserId": "164208106291724298",
      "handle": "normal_justin",
      "nickname": "JT",
      "roles": [
        {
          "id": "612842488302141441",
          "app": "discord",
          "name": "Moderator",
          "color": "#5865F2",
          "position": 3,
          "mentionable": true,
          "hoisted": true
        }
      ],
      "joinedAt": "2024-01-01 00:00:00",
      "syncedAt": "2026-09-12 07:20:48"
    }
  ]
}
```

**404 Not Found** (no such `chat_member_mapping.id`)

```json
{
  "ok": false,
  "error": "User mapping not found"
}
```

---

## POST /api/guild-members/42/link

Admin-only. Links `guild_members.id = 42` to a `chat_member_mapping` identity as one of its aliases. Since `member_aliases.guild_member_id` is unique, calling this again for the same guild member moves it — it can only alias one identity at a time.

**Request**

```json
{ "chatMemberMappingId": 1 }
```

**200 OK**

```json
{ "ok": true }
```

**404 Not Found** (unknown `guildMemberId` or `chatMemberMappingId`)

```json
{ "ok": false, "error": "Guild member not found" }
```

---

## DELETE /api/guild-members/42/link

Admin-only. Removes the `member_aliases` row for `guild_members.id = 42`, if any.

**200 OK**

```json
{ "ok": true }
```

**404 Not Found** (no alias link exists for this guild member)

```json
{ "ok": false, "error": "No alias link found for this guild member" }
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
      "roles": [
        {
          "id": "612842488302141441",
          "app": "discord",
          "name": "Moderator",
          "color": "#5865F2",
          "position": 3,
          "mentionable": true,
          "hoisted": true
        }
      ],
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
