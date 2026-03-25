# JavaScript code standards

This document describes formatting, naming, and documentation conventions used across this repository’s JavaScript code (Discord bot, Web API, and shared patterns). For **general layout and export style**, [`discord-bot/events/messages/utilities/messagePinner.js`](../../discord-bot/events/messages/utilities/messagePinner.js) is the reference example.

---

## Language and tooling

- **JavaScript** with **ES modules** (`import` / `export`). Use **explicit `.js` extensions** in relative import paths (Node ESM resolution).
- **Semicolons** at the end of statements.
- **Double quotes** for string literals.

---

## Indentation and whitespace

- **2 spaces** per indentation level. Do not use tabs.
- **One blank line** between logical sections (e.g. after imports, between unrelated blocks).
- **One blank line** between import groups: first third-party / library imports, then a blank line, then local/project imports.
- **Trailing commas** in multiline object literals, array literals, and function argument lists where it improves diffs and readability.
- Avoid trailing whitespace on lines.

---

## Line length and wrapping

- Prefer readable line breaks over very long lines. When a statement spans multiple lines, indent continuations consistently (typically one extra level from the start of the statement).
- For chained calls (e.g. `EmbedBuilder`), one method per line is fine when it stays readable.

---

## Naming

- **Variables and functions:** `camelCase` (`pinChannelId`, `isMessageAlreadyPinned`, `logPinnedMessage`).
- **Constants** at module scope: `const` with `camelCase` unless the value is a true fixed literal enum-style name; use whatever matches surrounding files (`configs`, `filteredConfigs`).
- **Files:** `camelCase.js` for single-purpose modules (e.g. `messagePinner.js`). Route files may use **kebab-case** matching URL segments (e.g. `message-processing.js`) where that convention already exists in the tree.
- **API / database field names:** preserve external naming when building request bodies or mapping rows (e.g. `messageId`, `config_entry` if aligned with stored config keys). Prefer **camelCase** in new JS-only code.

---

## Imports

- Order: external packages first, blank line, then relative project imports.
- Use **named imports** where the module exports named symbols; use `import * as alias` when importing a whole API surface (e.g. `import * as api from "../../../api/client.js"`).
- Re-export or aggregate imports only when it clarifies usage; avoid unused imports.

---

## Functions and exports

- Prefer **`export const name = async (...) => { ... }`** or **`export const name = (...) => { ... }`** for exported functions, matching the reference file.
- Use **`async`/`await`** for asynchronous work instead of mixing unnecessary `.then()` chains when clarity is equal or better with `await`.
- **Early returns** are encouraged for guard clauses (e.g. `if (!msgid) return false;`).

---

## Comments and JSDoc

### Inline comments

- Use `//` for short explanations next to logic (e.g. why a condition exists, or a non-obvious Discord/API quirk).
- Place `//` on their own line above the code they describe, or at the end of a line only when the comment is very short.

### JSDoc for exported functions

Use a **block comment** `/** ... */` above exported functions. A typical pattern (as in `messagePinner.js` and `webapi/routes/*.js`) includes:

1. **First line(s):** what the function does in plain language.
2. **HTTP/API context (when relevant):** method and path, e.g. `POST /api/message-processing/pin-check with { messageId }`, or a short note about the request body.
3. **`@param`** for each parameter, with **braced types**: `@param {string} msgid - Message ID`
4. **`@returns`** with type (and description if non-obvious): `@returns {Promise<boolean>}`

Example shape:

```js
/**
 * Short description of behavior.
 * POST /api/example/path with { foo }.
 * @param {string} foo - What foo is
 * @returns {Promise<boolean>}
 */
export const doSomething = async (foo) => { ... };
```

### Module and section headers (especially Web API)

- **Service modules** may start with a file-level JSDoc describing the module’s responsibility (see `webapi/services/messageProcessing.js`).
- **Section dividers** inside large files: a short `// --- Section name ---` comment is acceptable to group related helpers.
- **Private helpers:** use `@private` in JSDoc when a function is not part of the public API of the module.

### Route handlers (Express)

- Document **`METHOD` + path**, **body/query shape**, and **auth** in the JSDoc above `router.post(...)`, etc., so maintainers can align with [`README.md`](./README.md) and client code.

---

## Objects and control flow

- Prefer **optional chaining** (`data?.alreadyPinned`) where it avoids redundant checks.
- **Ternaries:** when nesting, format with clear indentation (see `pinChannelId` in the reference file). If logic grows beyond a few branches, use `if/else` or a small helper for readability.
- **Boolean coercion:** use `Boolean(...)` when the intent is explicitly true/false.

---

## Error handling

- **Web API route handlers:** wrap async handlers in `try/catch`, `console.error` the error, and return appropriate HTTP status and JSON `{ ok: false, error: "..." }` consistent with neighboring routes.
- **Discord bot / clients:** follow existing patterns in each file (avoid swallowing errors silently unless the codebase already does so intentionally).

---

## What to avoid

- Mixing quote styles or omitting semicolons without project-wide agreement.
- Very large functions without section comments or extraction—mirror the structure of the reference file and similar modules.
- JSDoc that only repeats the function name—prefer describing behavior, parameters, return value, and API contract.

---

## Reference

- **Discord bot formatting and JSDoc shape:** [`discord-bot/events/messages/utilities/messagePinner.js`](../../discord-bot/events/messages/utilities/messagePinner.js)
- **Express route documentation style:** [`webapi/routes/message-processing.js`](../routes/message-processing.js)
- **Service module layout:** [`webapi/services/messageProcessing.js`](../services/messageProcessing.js)
