import { API_BASE } from "./api.js";

/** Pin history rows shown per page. */
export const PIN_PAGE_SIZE = 20;

/**
 * Parse a fetch Response as JSON, with a clear error when the body is not JSON.
 * @param {Response} res Fetch response.
 * @param {string} context Label for error messages.
 * @returns {Promise<unknown>}
 */
async function parseJsonResponse(res, context) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `${context}: expected JSON but got ${contentType || "unknown content type"}`,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${context}: invalid JSON response`);
  }
}

/**
 * Fetch one page of pin history from webapi.
 * @param {number} [offset=0] Rows to skip.
 * @param {number} [limit=PIN_PAGE_SIZE] Page size.
 * @returns {Promise<{ entries: Array<{ id: number, msgid: string, timestamp: string, author: number|null, contents: string|null, attachments: string[], channelId: string|null, channelName: string|null, pinners: number[], hydrated: boolean }>, total: number, limit: number, offset: number }>}
 */
export async function fetchPinHistoryPage(offset = 0, limit = PIN_PAGE_SIZE) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`${API_BASE}/pin-history?${params}`);

  if (!res.ok) {
    throw new Error(`Failed to load pin history (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Pin history");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load pin history");
  }

  return {
    entries: Array.isArray(data.pinHistory) ? data.pinHistory : [],
    total: Number(data.total) || 0,
    limit: Number(data.limit) || limit,
    offset: Number(data.offset) || offset,
  };
}

/** Allowed attachment subdirectory prefixes under the files root. */
const ATTACHMENT_PREFIXES = ["images/", "videos/", "other/"];

/**
 * Normalize a stored attachment path for validation.
 * @param {string} relativePath Path from pin_history.attachments.
 * @returns {string}
 */
function normalizeAttachmentPath(relativePath) {
  return String(relativePath ?? "").trim().replace(/^\/+/, "");
}

/**
 * Whether a stored attachment path is safe to serve from /files.
 * @param {string} relativePath Path from pin_history.attachments.
 * @returns {boolean}
 */
export function isValidAttachmentPath(relativePath) {
  const rel = normalizeAttachmentPath(relativePath);
  if (!rel || rel.includes("..") || rel.includes("\\")) return false;
  return ATTACHMENT_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

/**
 * Public URL for a pin attachment stored relative to the files directory.
 * @param {string} relativePath Path from pin_history.attachments (e.g. `images/123-0.png`).
 * @returns {string} URL under /files, or empty string when path is invalid.
 */
export function pinAttachmentUrl(relativePath) {
  const rel = normalizeAttachmentPath(relativePath);
  if (!isValidAttachmentPath(rel)) return "";
  return `/files/${rel}`;
}

/**
 * Classify a stored attachment path by subdirectory prefix.
 * @param {string} relativePath Path from pin_history.attachments.
 * @returns {"image"|"video"|"file"}
 */
export function attachmentKind(relativePath) {
  const rel = String(relativePath ?? "").trim().replace(/^\/+/, "");
  if (rel.startsWith("images/")) return "image";
  if (rel.startsWith("videos/")) return "video";
  return "file";
}

/**
 * Basename of an attachment path for link labels.
 * @param {string} relativePath Path from pin_history.attachments.
 * @returns {string}
 */
export function attachmentFileName(relativePath) {
  const rel = String(relativePath ?? "").trim().replace(/^\/+/, "");
  const parts = rel.split("/");
  return parts[parts.length - 1] || rel || "attachment";
}

/**
 * Format a pin timestamp for display.
 * @param {string|Date|null|undefined} timestamp Pin timestamp from webapi.
 * @returns {string}
 */
export function formatPinTimestamp(timestamp) {
  if (timestamp == null) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  return date.toLocaleString();
}

/**
 * Build a lookup map from chat_member_mapping internal id to display name.
 * @param {Array<{ id: number, name: string }>} userMappings User mapping rows.
 * @returns {Map<number, string>}
 */
export function buildMappingIdNameMap(userMappings) {
  const map = new Map();
  for (const row of userMappings) {
    if (row?.id != null && row?.name != null) {
      map.set(Number(row.id), String(row.name));
    }
  }
  return map;
}

/**
 * Resolve the display label for a chat_member_mapping internal id.
 * @param {number|null|undefined} mappingId chat_member_mapping.id.
 * @param {Map<number, string>} nameMap mapping id → display name.
 * @returns {string}
 */
export function resolveMappingLabel(mappingId, nameMap) {
  if (mappingId == null) return "Unknown";
  const id = Number(mappingId);
  if (!Number.isFinite(id)) return "Unknown";
  return nameMap.get(id) ?? `User #${id}`;
}

/**
 * Resolve pinner mapping ids to a comma-separated display string.
 * @param {number[]} pinnerIds chat_member_mapping ids.
 * @param {Map<number, string>} nameMap mapping id → display name.
 * @returns {string}
 */
export function resolvePinnerLabels(pinnerIds, nameMap) {
  if (!Array.isArray(pinnerIds) || pinnerIds.length === 0) return "Unknown";
  return pinnerIds
    .map((id) => resolveMappingLabel(id, nameMap))
    .join(", ");
}

/**
 * Resolve channel label from a pin history row.
 * @param {{ channelName?: string|null, channelId?: string|null }} entry Pin row.
 * @returns {string}
 */
export function resolveChannelLabel(entry) {
  const name = String(entry?.channelName ?? "").trim();
  if (name) return `#${name}`;
  const id = String(entry?.channelId ?? "").trim();
  if (id) return `#${id}`;
  return "Unknown channel";
}

/** Discord user mention tokens embedded in message text (`<@id>` or `<@!id>`). */
const DISCORD_USER_MENTION_RE = /<@!?(\d+)>/g;

/**
 * Replace Discord user mention tags in pin message text with mapped display names.
 * @param {string|null|undefined} contents Raw pin message text.
 * @param {Map<string, string>} platformNameMap platformUserId → display name.
 * @returns {string}
 */
export function resolvePinContents(contents, platformNameMap) {
  if (contents == null || contents === "") return "";

  return String(contents).replace(
    DISCORD_USER_MENTION_RE,
    (mention, platformUserId) => {
      const name = platformNameMap.get(String(platformUserId));
      if (name) return `@${name}`;
      return `@${platformUserId}`;
    },
  );
}
