# Trigger-Responses – Response Examples

See also [trigger-responses-examples.md](trigger-responses-examples.md) for sample **requests** (cURL).

---

## GET /api/trigger-responses

**200 OK**

```json
{
  "ok": true,
  "triggerResponses": [
    {
      "id": 1,
      "trigger_string": "takealookatthis",
      "response_string": "https://example.com/image.png",
      "response_order": 0,
      "selection_mode": "ordered",
      "created_at": "2024-01-15T12:00:00.000Z",
      "trigger_id": 1,
      "response_id": 1
    }
  ]
}
```

---

## GET /api/trigger-responses/triggers

**200 OK**

```json
{
  "ok": true,
  "triggers": ["takealookatthis", "hello", "greet"]
}
```

---

## GET /api/trigger-responses/triggers/list

**200 OK**

```json
{
  "ok": true,
  "triggers": [
    { "id": 1, "trigger_string": "takealookatthis", "selection_mode": "ordered" },
    { "id": 2, "trigger_string": "hello", "selection_mode": "random" }
  ]
}
```

---

## GET /api/trigger-responses/triggers/responses?trigger=xxx | ?triggerId=1

**200 OK**

```json
{
  "ok": true,
  "trigger_id": 1,
  "trigger_string": "takealookatthis",
  "selection_mode": "ordered",
  "responses": [
    { "id": 1, "response_string": "First response.", "order": 0, "linkId": 5 },
    { "id": 2, "response_string": "Second response.", "order": 1, "linkId": 6 }
  ]
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "Query parameter 'trigger' (trigger text) or 'triggerId' (trigger id) is required"
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Trigger not found"
}
```

---

## GET /api/trigger-responses/triggers/:id

**200 OK**

```json
{
  "ok": true,
  "id": 1,
  "trigger_string": "takealookatthis",
  "selection_mode": "ordered",
  "created_at": "2024-01-15T12:00:00.000Z",
  "responses": [
    { "id": 1, "response_string": "First response.", "order": 0, "linkId": 5 },
    { "id": 2, "response_string": "Second response.", "order": 1, "linkId": 6 }
  ]
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Trigger not found"
}
```

---

## POST /api/trigger-responses/triggers

**201 Created**

```json
{
  "ok": true,
  "id": 3,
  "trigger_string": "hello",
  "selection_mode": "ordered",
  "created_at": "2024-01-15T13:00:00.000Z",
  "responses": [
    { "id": 10, "response_string": "Hi there!", "order": 0, "linkId": 20 },
    { "id": 11, "response_string": "Hey!", "order": 1, "linkId": 21 }
  ]
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "trigger_string (non-empty string) is required"
}
```

---

## PUT /api/trigger-responses/triggers/:id

**200 OK** (returns full trigger with updated responses)

```json
{
  "ok": true,
  "id": 1,
  "trigger_string": "takealookatthis",
  "selection_mode": "ordered",
  "created_at": "2024-01-15T12:00:00.000Z",
  "responses": [
    { "id": 1, "response_string": "First response.", "order": 0, "linkId": 5 },
    { "id": 2, "response_string": "Second response.", "order": 1, "linkId": 6 }
  ]
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Trigger not found"
}
```

---

## GET /api/trigger-responses/random?trigger=xxx

**200 OK**

```json
{
  "ok": true,
  "response": "https://example.com/image.png",
  "id": 1
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "Query parameter 'trigger' (non-empty string) is required"
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "No responses found for this trigger"
}
```

---

## GET /api/trigger-responses/responses/:id

**200 OK**

```json
{
  "ok": true,
  "id": 1,
  "response_string": "https://example.com/image.png",
  "created_at": "2024-01-15T12:00:00.000Z"
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Response not found"
}
```

---

## PUT /api/trigger-responses/responses/:id

**200 OK**

```json
{
  "ok": true,
  "id": 1,
  "response_string": "Updated response text",
  "created_at": "2024-01-15T12:00:00.000Z"
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "response_string (non-empty string) is required"
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Response not found"
}
```

---

## DELETE /api/trigger-responses/responses/:id

**200 OK**

```json
{
  "ok": true
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Response not found"
}
```

---

## GET /api/trigger-responses/:id (junction/link)

**200 OK**

```json
{
  "ok": true,
  "id": 10,
  "trigger_string": "hello",
  "response_string": "Hi!",
  "response_order": 0,
  "selection_mode": "random",
  "created_at": "2024-01-15T12:00:00.000Z",
  "trigger_id": 2,
  "response_id": 5
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Trigger-response not found"
}
```

---

## POST /api/trigger-responses (single link)

**201 Created**

```json
{
  "ok": true,
  "id": 15,
  "trigger_string": "bye",
  "response_string": "See you!",
  "response_order": null,
  "selection_mode": "random",
  "created_at": "2024-01-15T12:00:00.000Z",
  "trigger_id": 4,
  "response_id": 8
}
```

---

## PUT /api/trigger-responses/:id (junction)

**200 OK**

```json
{
  "ok": true,
  "id": 10,
  "trigger_string": "hello",
  "response_string": "Hi!",
  "response_order": 2,
  "selection_mode": "ordered",
  "created_at": "2024-01-15T12:00:00.000Z",
  "trigger_id": 2,
  "response_id": 5
}
```

---

## DELETE /api/trigger-responses/:id (junction)

**200 OK**

```json
{
  "ok": true
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Trigger-response not found"
}
```
