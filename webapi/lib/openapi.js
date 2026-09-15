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
      MilestoneHit: {
        type: "object",
        description: "One milestone newly marked achieved by the increment this response is for.",
        properties: {
          id: { type: "integer" },
          quantity: { type: "integer" },
          message: { type: "string" },
          type: { type: "string" },
          item: { type: "string", nullable: true },
        },
      },
      Milestone: {
        type: "object",
        description: "A milestone definition row (GET/POST/PUT /api/milestones).",
        properties: {
          id: { type: "integer" },
          quantity: { type: "integer" },
          type: { type: "string" },
          item: { type: "string", nullable: true },
          message: { type: "string" },
          object: { type: "string" },
          achieved: { type: "boolean" },
          created_at: { type: "string" },
          updated_at: { type: "string" },
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
      GuildRole: {
        type: "object",
        description:
          "A resolved guild_roles row — the shape every webapi response uses for a role, in " +
          "place of a bare role id. If the id has no matching guild_roles row (deleted or never " +
          "synced), only id/app are populated and the rest are null.",
        properties: {
          id: { type: "string", description: "Discord role snowflake." },
          app: { type: "string" },
          name: { type: "string", nullable: true },
          color: {
            type: "string",
            nullable: true,
            description: "Hex color (e.g. \"#5865f2\"), or null if the role has no color set.",
          },
          position: { type: "integer", nullable: true },
          mentionable: { type: "boolean", nullable: true },
          hoisted: { type: "boolean", nullable: true },
        },
      },
      EmojiFrequency: {
        type: "object",
        description:
          "A resolved emoji_frequency row — the shape every webapi response uses for an emoji " +
          "or sticker, in place of a bare emoid. If the emoid has no matching emoji_frequency " +
          "row (deleted), only emoid is populated and the rest are null.",
        properties: {
          emoid: { type: "string", description: "Discord emoji/sticker snowflake, or the literal unicode character for a built-in emoji." },
          app: { type: "string", nullable: true },
          emoji: { type: "string", nullable: true, description: "Display name (custom emoji/sticker) or the unicode character itself." },
          frequency: { type: "integer", nullable: true, description: "Global usage count for this emoid." },
          animated: { type: "integer", nullable: true, enum: [0, 1, null] },
          type: { type: "string", nullable: true, enum: ["emoji", "sticker", null] },
        },
      },
      ConfigEmojiValue: {
        type: "object",
        description:
          "Resolved value of an \"emoji\"-typed config entry (pin_emoji, plusplus_emoji, " +
          "minusminus_emoji, repost_emoji). If the stored value matches a synced emoji_frequency " +
          "row, this is that row (app is the real app name). If it's freeform text an admin typed " +
          "by hand that was never synced, app/emoid are null and `emoji` holds the raw text — " +
          "comparisons should fall back to matching that string (see emojisMatch).",
        properties: {
          emoid: { type: "string", nullable: true },
          app: { type: "string", nullable: true },
          emoji: { type: "string", nullable: true },
          frequency: { type: "integer", nullable: true },
          animated: { type: "integer", nullable: true, enum: [0, 1, null] },
          type: { type: "string", nullable: true, enum: ["emoji", "sticker", null] },
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

const apis = [toPosix(path.join(ROOT, "routes", "*.js")), toPosix(path.join(ROOT, "index.js"))];

/**
 * Build the full OpenAPI document by scanning routes/*.js and index.js for
 * `@openapi` JSDoc fragments and merging them with the shared base above.
 * @returns {object} OpenAPI 3.0 document.
 */
export function buildOpenApiSpec() {
  return swaggerJsdoc({ definition, apis });
}
