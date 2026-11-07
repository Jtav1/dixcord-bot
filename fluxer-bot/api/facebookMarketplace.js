import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Resolve a Facebook URL via webapi. Returns null if it's not a Marketplace listing (or the
 * feature is disabled server-side) — never throws into the message pipeline.
 * POST /api/bot-responses/facebook-marketplace
 * @param {string} url
 * @returns {Promise<{ id: string, url: string, title: string|null, price: string|null, location: string|null, description: string|null, imageUrl: string|null }|null>}
 */
export const getFacebookMarketplacePreview = async (url) => {
  if (!url) return null;
  const { data } = await api.post("/api/bot-responses/facebook-marketplace", {
    url: String(url),
    app: "fluxer",
    guildId,
  });
  if (!data?.ok || !data.isMarketplaceListing) return null;
  return data.listing ?? null;
};
