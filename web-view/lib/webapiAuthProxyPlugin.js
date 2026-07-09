import path from "path";
import { fileURLToPath } from "url";
import { warmWebapiAuth, webapiAuthProxyMiddleware } from "./webapiAuth.js";
import { logEmojiFileInventory } from "./emojiFileInventory.js";

const filesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "files",
);

/**
 * Warm webapi auth and log emoji image inventory at startup.
 * @returns {Promise<void>}
 */
async function runWebviewStartupTasks() {
  await warmWebapiAuth();
  await logEmojiFileInventory(filesDir);
}

/**
 * Vite plugin: inject webapi JWT on /api requests before the dev proxy forwards them.
 * @returns {import('vite').Plugin}
 */
export function webapiAuthProxyPlugin() {
  return {
    name: "webview-webapi-auth",
    configureServer(server) {
      void runWebviewStartupTasks();
      server.middlewares.use((req, res, next) => {
        void webapiAuthProxyMiddleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      void runWebviewStartupTasks();
      server.middlewares.use((req, res, next) => {
        void webapiAuthProxyMiddleware(req, res, next);
      });
    },
  };
}
