import vue from "@vitejs/plugin-vue";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import vuetify from "vite-plugin-vuetify";
import { attachCachedWebapiAuthHeader } from "./lib/webapiAuth.js";
import { createCaseInsensitiveEmojiFilesMiddleware } from "./lib/emojiFilesMiddleware.js";
import { webapiAuthProxyPlugin } from "./lib/webapiAuthProxyPlugin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filesDir = path.join(__dirname, "files");

/**
 * Serve local emoji/sticker image assets at /files during Vite dev and preview.
 * @returns {import('vite').Plugin}
 */
function filesStaticPlugin() {
  const staticMiddleware = express.static(filesDir);
  const emojiFilesMiddleware = createCaseInsensitiveEmojiFilesMiddleware(
    filesDir,
    staticMiddleware,
  );
  return {
    name: "files-static",
    configureServer(server) {
      server.middlewares.use("/files", emojiFilesMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/files", emojiFilesMiddleware);
    },
  };
}

/**
 * Apply web-view server env from Vite loadEnv (supports legacy VITE_* names).
 * @param {Record<string, string>} env Loaded .env values.
 * @returns {string} webapi base URL for the dev proxy.
 */
function applyServerEnv(env) {
  process.env["WEBAPI_URL"] =
    env.WEBAPI_URL ||
    env.VITE_WEBAPI_URL ||
    process.env["WEBAPI_URL"] ||
    "http://localhost:3000";
  process.env["WEBVIEW_USERNAME"] =
    env.WEBVIEW_USERNAME ||
    env.VITE_WEBVIEW_USERNAME ||
    process.env["WEBVIEW_USERNAME"];
  process.env["WEBVIEW_PASSWORD"] =
    env.WEBVIEW_PASSWORD ||
    env.VITE_WEBVIEW_PASSWORD ||
    process.env["WEBVIEW_PASSWORD"];
  return process.env["WEBAPI_URL"];
}

/**
 * Vite configuration for local development and production builds.
 * @param {{ mode: string }} ctx
 * @returns {import('vite').UserConfig}
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const webapiUrl = applyServerEnv(env);
  const port = parseInt(env.PORT || "3002", 10);
  const apiProxy = {
    "/api": {
      target: webapiUrl,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq) => {
          attachCachedWebapiAuthHeader(proxyReq);
        });
        proxy.on("error", (err, req, res) => {
          console.error("web-view dev API proxy error:", err.message);
          if (res.writeHead && !res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ ok: false, error: "Failed to reach webapi" }),
            );
          }
        });
      },
    },
  };

  return {
    plugins: [
      webapiAuthProxyPlugin(),
      filesStaticPlugin(),
      vue(),
      vuetify({ autoImport: true }),
    ],
    server: {
      port,
      strictPort: true,
      proxy: apiProxy,
    },
    preview: {
      port,
      strictPort: true,
      proxy: apiProxy,
    },
  };
});
