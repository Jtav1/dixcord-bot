import express from "express";
import { authenticate } from "../middleware/auth.js";
import { fortuneTeller, twitterFixer } from "../services/botResponses.js";
import { getFacebookMarketplacePreview, isFacebookUrl } from "../services/facebookMarketplace.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";

const router = express.Router();

const GUILD_ID_PARAM_ERROR = {
  ok: false,
  error: 'Parameter "guildId" is required',
};

/**
 * POST /api/bot-responses/fortune
 * Returns a random 8-ball style fortune.
 * Auth: required.
 * @openapi
 * /api/bot-responses/fortune:
 *   post:
 *     operationId: getBotFortune
 *     tags: [Bot Responses]
 *     summary: Get a random 8-ball fortune
 *     responses:
 *       '200':
 *         description: A random fortune response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 response: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/fortune", authenticate, async (req, res) => {
  try {
    const { response } = await fortuneTeller();
    res.json({ ok: true, response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to get fortune" });
  }
});

/**
 * POST /api/bot-responses/link-fixer
 * Returns a fixed embed-friendly link if message contains a social link and trigger.
 * Body: { message: string, app: string, guildId: string }
 * Auth: required.
 * @openapi
 * /api/bot-responses/link-fixer:
 *   post:
 *     operationId: fixBotLink
 *     tags: [Bot Responses]
 *     summary: Rewrite a social link to an embed-friendly host if triggered
 *     description: Returns an empty response string when the message does not contain a supported trigger/link combination, or when twitter_fix_enabled is off for this server.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId]
 *             properties:
 *               message: { type: string }
 *               app: { type: string, enum: [discord, fluxer] }
 *               guildId: { type: string }
 *     responses:
 *       '200':
 *         description: Fixed link response (empty string if no fix applied).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 response: { type: string }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/link-fixer", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const guildId = String(req.body?.guildId ?? "").trim();
    if (!guildId) return res.status(400).json(GUILD_ID_PARAM_ERROR);

    const message = req.body?.message ?? "";
    const { response } = await twitterFixer(message, app, guildId);
    res.json({ ok: true, response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fix link" });
  }
});

/**
 * POST /api/bot-responses/facebook-marketplace
 * Resolve a Facebook URL and, if it's a Marketplace listing, scrape (or return cached) details.
 * Body: { url: string, app: string, guildId: string }
 * Auth: required.
 * @openapi
 * /api/bot-responses/facebook-marketplace:
 *   post:
 *     operationId: getFacebookMarketplacePreview
 *     tags: [Bot Responses]
 *     summary: Resolve a Facebook link to Marketplace listing details, if it is one
 *     description: >
 *       Returns isMarketplaceListing:false (not an error) for any facebook.com URL that isn't a
 *       Marketplace item, or when facebook_marketplace_enabled is off for this server. 400 only
 *       for a URL whose host isn't a recognized Facebook domain (this endpoint fetches the URL
 *       server-side, so that's an SSRF guard, not a soft case).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, app, guildId]
 *             properties:
 *               url: { type: string, example: "https://www.facebook.com/marketplace/item/1157528266644960/" }
 *               app: { type: string, enum: [discord, fluxer] }
 *               guildId: { type: string }
 *     responses:
 *       '200':
 *         description: Resolution result.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 isMarketplaceListing: { type: boolean }
 *                 listing:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id: { type: string }
 *                     url: { type: string }
 *                     title: { type: string, nullable: true }
 *                     price: { type: string, nullable: true }
 *                     location: { type: string, nullable: true }
 *                     description: { type: string, nullable: true }
 *                     imageUrl: { type: string, nullable: true }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/facebook-marketplace", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);
    const guildId = String(req.body?.guildId ?? "").trim();
    if (!guildId) return res.status(400).json(GUILD_ID_PARAM_ERROR);

    const url = String(req.body?.url ?? "").trim();
    if (!url || !isFacebookUrl(url)) {
      return res.status(400).json({ ok: false, error: "url must be a facebook.com URL" });
    }

    const result = await getFacebookMarketplacePreview(url, app, guildId);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to resolve Facebook link" });
  }
});

export default router;
