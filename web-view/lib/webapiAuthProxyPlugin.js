import { warmWebapiAuth, webapiAuthProxyMiddleware } from "./webapiAuth.js";

/**
 * Vite plugin: inject webapi JWT on /api requests before the dev proxy forwards them.
 * @returns {import('vite').Plugin}
 */
export function webapiAuthProxyPlugin() {
  return {
    name: "webview-webapi-auth",
    configureServer(server) {
      void warmWebapiAuth();
      server.middlewares.use((req, res, next) => {
        void webapiAuthProxyMiddleware(req, res, next);
      });
    },
  };
}
