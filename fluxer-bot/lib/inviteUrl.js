import { PermissionFlags } from "@fluxerjs/core";

import { client } from "../fluxerClient.js";

// View channels, send, embed links, attach files, add reactions, read history.
const INVITE_PERMISSIONS =
  PermissionFlags.ViewChannel |
  PermissionFlags.SendMessages |
  PermissionFlags.EmbedLinks |
  PermissionFlags.AttachFiles |
  PermissionFlags.AddReactions |
  PermissionFlags.ReadMessageHistory;

/**
 * Build the OAuth2 "add bot to community" URL for this bot's application.
 * @returns {Promise<string>}
 */
export async function buildInviteUrl() {
  const app = await client.fetchApplication();
  const base = client.instance.endpoints.marketing.replace(/\/$/, "");
  const params = new URLSearchParams({
    client_id: app.id,
    scope: "bot",
    permissions: INVITE_PERMISSIONS.toString(),
  });
  return `${base}/oauth2/authorize?${params}`;
}
