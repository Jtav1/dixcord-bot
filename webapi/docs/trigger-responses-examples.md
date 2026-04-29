# Trigger-Response API – Sample Requests

All routes require authentication: `Authorization: Bearer <token>`.

Replace `BASE_URL` with your API base (e.g. `http://localhost:3000`) and `TOKEN` with a valid JWT.

---

## List all trigger-response links (flat pairs)

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## List trigger strings (for bot matching)

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses/triggers" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## List all triggers with id and selection_mode

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses/triggers/list" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Get all responses for a trigger (by trigger text or id)

By trigger text:

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses/triggers/responses?trigger=takealookatthis" \
  -H "Authorization: Bearer ${TOKEN}"
```

By trigger id:

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses/triggers/responses?triggerId=1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Get one trigger by id (with responses array)

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses/triggers/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Create a trigger with responses

```bash
curl -s -X POST "${BASE_URL}/api/trigger-responses/triggers" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger_string": "hello",
    "selection_mode": "ordered",
    "responses": [
      { "response_string": "Hi there!", "order": 0 },
      { "response_string": "Hey!", "order": 1 },
      { "response_string": "Hello!", "order": 2 }
    ]
  }'
```

Minimal (random mode, no order):

```bash
curl -s -X POST "${BASE_URL}/api/trigger-responses/triggers" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger_string": "greet",
    "responses": [
      { "response_string": "Hi!" },
      { "response_string": "Hello!" }
    ]
  }'
```

---

## Update a trigger (selection_mode and/or response order / new responses)

Set selection_mode and set order for existing links (use `id` = linkId from GET trigger):

```bash
curl -s -X PUT "${BASE_URL}/api/trigger-responses/triggers/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "selection_mode": "ordered",
    "responses": [
      { "id": 5, "order": 0 },
      { "id": 6, "order": 1 }
    ]
  }'
```

Add a new response to the trigger:

```bash
curl -s -X PUT "${BASE_URL}/api/trigger-responses/triggers/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "responses": [
      { "response_string": "Another reply", "order": 3 }
    ]
  }'
```

---

## Delete a trigger by id (cleans links, deletes orphan responses only)

```bash
curl -s -X DELETE "${BASE_URL}/api/trigger-responses/triggers/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Get one random response for a trigger (bot use)

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses/random?trigger=takealookatthis" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Get one response by id (responses table)

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses/responses/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Update a response's text

```bash
curl -s -X PUT "${BASE_URL}/api/trigger-responses/responses/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "response_string": "Updated response text" }'
```

---

## Delete a response (removes from all triggers)

```bash
curl -s -X DELETE "${BASE_URL}/api/trigger-responses/responses/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Get one trigger-response link by junction id

```bash
curl -s -X GET "${BASE_URL}/api/trigger-responses/10" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Create a single trigger-response link (one pair)

```bash
curl -s -X POST "${BASE_URL}/api/trigger-responses" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger_string": "bye",
    "response_string": "See you!",
    "response_order": null,
    "selection_mode": "random"
  }'
```

---

## Update a trigger-response link by junction id

```bash
curl -s -X PUT "${BASE_URL}/api/trigger-responses/10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "response_order": 2,
    "selection_mode": "ordered"
  }'
```

---

## Delete a trigger-response link by junction id

```bash
curl -s -X DELETE "${BASE_URL}/api/trigger-responses/10" \
  -H "Authorization: Bearer ${TOKEN}"
```
