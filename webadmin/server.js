import "dotenv/config";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3001", 10);
const WEBAPI_URL = process.env.WEBAPI_URL || "http://localhost:3000";
const distDir = path.join(__dirname, "dist");

const app = express();

/**
 * Health check for Docker and load balancers.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {void}
 */
function healthHandler(_req, res) {
  res.json({ ok: true });
}

app.get("/health", healthHandler);
app.use(
  "/api",
  createProxyMiddleware({
    target: WEBAPI_URL,
    changeOrigin: true,
  }),
);
app.use(express.static(distDir));
app.use((_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`web-panel listening on http://localhost:${PORT}`);
  console.log(`webapi proxy target: ${WEBAPI_URL}`);
});
