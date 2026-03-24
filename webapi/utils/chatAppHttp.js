import { isChatMemberAppSupported } from "../services/chatMemberMapping.js";

export const CHAT_APP_PARAM_ERROR = {
  ok: false,
  error: 'Parameter "app" is required and must be "discord".',
};

/**
 * Read `app` from JSON body or query string; validate against supported chat apps.
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function resolveChatAppFromRequest(req) {
  const app = req.body?.app ?? req.query?.app;
  if (!isChatMemberAppSupported(app)) return null;
  return app;
}
