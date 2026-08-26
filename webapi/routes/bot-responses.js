import express from "express";
import { authenticate } from "../middleware/auth.js";
import { fortuneTeller, twitterFixer } from "../services/botResponses.js";

const router = express.Router();

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
 * Body: { message: string }
 * Auth: required.
 * @openapi
 * /api/bot-responses/link-fixer:
 *   post:
 *     operationId: fixBotLink
 *     tags: [Bot Responses]
 *     summary: Rewrite a social link to an embed-friendly host if triggered
 *     description: Returns an empty response string when the message does not contain a supported trigger/link combination.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
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
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/link-fixer", authenticate, async (req, res) => {
  try {
    const message = req.body?.message ?? "";
    const { response } = await twitterFixer(message);
    res.json({ ok: true, response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fix link" });
  }
});

export default router;
