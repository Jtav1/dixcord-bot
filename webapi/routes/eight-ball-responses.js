import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import * as eightBall from "../services/eightBallResponses.js";
import { recordAudit } from "../services/auditLog.js";

const router = express.Router();

/**
 * GET /api/eight-ball-responses
 * List all eight-ball responses.
 * Auth: admin required.
 */
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const list = await eightBall.getAll();
    res.json({ ok: true, eightBallResponses: list });
  } catch (err) {
    console.error("GET /api/eight-ball-responses error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to list eight-ball responses" });
  }
});

/**
 * GET /api/eight-ball-responses/:id
 * Get one eight-ball response by id.
 * Auth: admin required.
 */
router.get("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const row = await eightBall.getById(id);
    if (!row) {
      return res
        .status(404)
        .json({ ok: false, error: "Eight-ball response not found" });
    }
    res.json({ ok: true, eightBallResponse: row });
  } catch (err) {
    console.error("GET /api/eight-ball-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to get eight-ball response" });
  }
});

/**
 * POST /api/eight-ball-responses
 * Create an eight-ball response.
 * Body: { response_string: string, sentiment: "positive"|"negative"|"neutral" }
 * Auth: admin required.
 */
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const responseString = req.body?.response_string;
    const sentiment = req.body?.sentiment;
    if (
      responseString == null ||
      typeof responseString !== "string" ||
      !responseString.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "response_string (non-empty string) is required",
      });
    }
    if (sentiment == null || !eightBall.VALID_SENTIMENTS.has(String(sentiment))) {
      return res.status(400).json({
        ok: false,
        error: 'sentiment must be "positive", "negative", or "neutral"',
      });
    }
    const id = await eightBall.create(responseString, sentiment);
    if (id == null) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to create eight-ball response" });
    }
    const row = await eightBall.getById(id);
    await recordAudit(req.user.id, "create", "eight_ball_responses", id, {
      response_string: row.response_string,
    });
    res.status(201).json({ ok: true, eightBallResponse: row });
  } catch (err) {
    console.error("POST /api/eight-ball-responses error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to create eight-ball response" });
  }
});

/**
 * PUT /api/eight-ball-responses/:id
 * Update an eight-ball response.
 * Body: { response_string?: string, sentiment?: string }
 * Auth: admin required.
 */
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const updated = await eightBall.update(id, {
      response_string: req.body?.response_string,
      sentiment: req.body?.sentiment,
    });
    if (!updated) {
      const existing = await eightBall.getById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ ok: false, error: "Eight-ball response not found" });
      }
      return res.status(400).json({
        ok: false,
        error: "Provide valid response_string and/or sentiment to update",
      });
    }
    const row = await eightBall.getById(id);
    await recordAudit(req.user.id, "update", "eight_ball_responses", id, {});
    res.json({ ok: true, eightBallResponse: row });
  } catch (err) {
    console.error("PUT /api/eight-ball-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to update eight-ball response" });
  }
});

/**
 * DELETE /api/eight-ball-responses/:id
 * Delete an eight-ball response.
 * Auth: admin required.
 */
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const deleted = await eightBall.remove(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ ok: false, error: "Eight-ball response not found" });
    }
    await recordAudit(req.user.id, "delete", "eight_ball_responses", id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/eight-ball-responses/:id error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to delete eight-ball response" });
  }
});

export default router;
