/**
 * Singleton Client instance. Separate from bot.js so event handlers (which fluxer.js
 * does not pass the client into, unlike discord.js) can import it directly.
 */

import { Client } from "@fluxerjs/core";

import { instanceUrl } from "./configVars.js";

// Self-hosted instances need discovery (GET /.well-known/fluxer) to resolve their
// endpoints; omit FLUXER_INSTANCE_URL to use the hosted fluxer.app defaults.
export const client = instanceUrl
  ? await Client.fromDiscovery(instanceUrl)
  : new Client();
