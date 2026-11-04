import { PermissionFlags } from "@fluxerjs/core";

import { client } from "../fluxerClient.js";

// View channels, send, embed links, attach files, add reactions, read history.
// ManageRoles + ManageMessages are for react-for-role: granting/revoking the bound role requires
// ManageRoles (and the bot's own role must sit above every role it manages, in community role
// order — not grantable via a permission bit), and stripping an unlisted reaction off someone
// else's react requires ManageMessages.
const INVITE_PERMISSIONS =
  PermissionFlags.ViewChannel |
  PermissionFlags.SendMessages |
  PermissionFlags.EmbedLinks |
  PermissionFlags.AttachFiles |
  PermissionFlags.AddReactions |
  PermissionFlags.ReadMessageHistory |
  PermissionFlags.ManageRoles |
  PermissionFlags.ManageMessages;

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
