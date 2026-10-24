import * as api from "./client.js";

/**
 * List source hosts from link replacements (for detecting messages that need link fixing).
 * GET /api/link-replacements
 * @returns {Promise<string[]>} source_host values, e.g. ["x.com", "twitter.com", "instagram.com", ...]
 */
export const getLinkReplacementSourceHosts = async () => {
  const { data } = await api.get("/api/link-replacements");
  if (!data?.ok || !Array.isArray(data.linkReplacements)) return [];
  return data.linkReplacements.map((r) => r.source_host).filter(Boolean);
};
