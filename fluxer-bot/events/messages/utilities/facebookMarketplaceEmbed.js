import { EmbedBuilder } from "@fluxerjs/builders";

/**
 * Extract up to `limit` facebook.com Marketplace-shaped URLs from message content — a
 * pre-filter so webapi isn't asked about every unrelated facebook.com link (profile/group/post
 * links). A `/share/` link's true destination is unknown until webapi resolves it, so those are
 * included too; webapi does the authoritative check either way.
 * @param {string} content
 * @param {number} [limit]
 * @returns {string[]}
 */
export function extractFacebookMarketplaceUrls(content, limit = 3) {
  if (!content) return [];
  const cleaned = content.replace(/[<>]/g, "");
  const matches = cleaned.match(
    /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:marketplace\/item\/\d+|share\/[^\s]+)\S*/gi,
  );
  if (!matches) return [];
  return [...new Set(matches)].slice(0, limit);
}

/**
 * Build a Facebook Marketplace listing card, matching the pin alert embed's style
 * (utilities/messagePinner.js).
 * @param {{ url: string, title: string|null, price: string|null, location: string|null, description: string|null, imageUrl: string|null }} listing
 * @returns {import("@fluxerjs/builders").EmbedBuilder}
 */
export function buildFacebookMarketplaceEmbed(listing) {
  const embed = new EmbedBuilder()
    .setColor(0x1877f2)
    .setTitle(listing.title || "Facebook Marketplace listing")
    .setURL(listing.url)
    .setFooter({ text: "Facebook Marketplace" });

  if (listing.price || listing.location) {
    embed.addFields(
      { name: "Price", value: listing.price || "Unknown", inline: true },
      { name: "Location", value: listing.location || "Unknown", inline: true },
    );
  }
  if (listing.description) embed.setDescription(listing.description);
  if (listing.imageUrl) embed.setImage(listing.imageUrl);

  return embed;
}
