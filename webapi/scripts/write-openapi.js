import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

/**
 * Base OpenAPI document merged with `@openapi` JSDoc fragments found in
 * routes/*.js and index.js. Route files supply `paths`; everything shared
 * (auth scheme, reusable error responses, tags) lives here so route JSDoc
 * blocks stay short.
 */
const definition = {
  openapi: "3.0.3",
  info: {
    title: "dixcord-bot webapi",
    version: pkg.version,
    description:
      "Internal REST API backing the dixcord-bot Discord bot, webview, and webadmin services. " +
      "Every route requires a service-account JWT (admin, bot, or webview) except login and health.",
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Auth", description: "Service-account login" },
    { name: "Users", description: "Current-user profile management" },
    { name: "Bot Responses", description: "Fortune and link-fixing responses" },
    { name: "Message Processing", description: "Discord message/reaction event ingestion" },
    { name: "Config", description: "Runtime configuration key/value store" },
    { name: "Link Replacements", description: "Embed-friendly link host rewrites" },
    { name: "Pin Quips", description: "Quips posted alongside pin alerts" },
    { name: "Trigger Responses", description: "Trigger-response pairs and selection modes" },
    { name: "Scheduled Messages", description: "User-scheduled reminder messages" },
    { name: "Leaderboards", description: "Plusplus, emoji, and repost leaderboards" },
    { name: "Eight Ball Responses", description: "8-ball fortune response pool" },
    { name: "User Mappings", description: "Cross-app user identity mapping" },
    { name: "Pin History", description: "Log of pinned messages" },
    { name: "System", description: "Health, cache-version, and heartbeat" },
    { name: "Events", description: "Raw plusplus/repost/sticker event log" },
    { name: "Audit Log", description: "Admin action audit trail" },
    { name: "Statistics", description: "Aggregate usage counts" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Service-account JWT obtained from POST /api/auth/login.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["ok", "error"],
        properties: {
          ok: { type: "boolean", enum: [false] },
          error: { type: "string" },
        },
      },
      AuthErrorResponse: {
        type: "object",
        required: ["error"],
        description: "Shape returned by the authenticate/requireAdmin middleware, which omits `ok`.",
        properties: {
          error: { type: "string" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing, invalid, or expired bearer token.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/AuthErrorResponse" } },
        },
      },
      ForbiddenRole: {
        description: "Authenticated, but the account role is not permitted for this route.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/AuthErrorResponse" } },
        },
      },
      ForbiddenBotOrAdmin: {
        description: "Requires the bot or admin service-account role.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
        },
      },
      NotFound: {
        description: "Resource not found.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
        },
      },
      BadRequest: {
        description: "Request body or query parameters failed validation.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
        },
      },
      ServerError: {
        description: "Unexpected server error.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
        },
      },
    },
  },
};

/**
 * glob (used internally by swagger-jsdoc) expects forward-slash patterns even on Windows.
 * @param {string} p
 * @returns {string}
 */
function toPosix(p) {
  return p.split(path.sep).join("/");
}

const options = {
  definition,
  apis: [toPosix(path.join(ROOT, "routes", "*.js")), toPosix(path.join(ROOT, "index.js"))],
};

const spec = swaggerJsdoc(options);
const outPath = path.join(ROOT, "openapi.generated.json");
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2) + "\n");

const pathCount = Object.keys(spec.paths || {}).length;
console.log(`Wrote ${path.relative(ROOT, outPath)} (${pathCount} paths).`);
