#!/usr/bin/env node

/**
 * Run discord-bot, webapi, and web-view together for local development.
 *
 * Usage (from repo root):
 *   node dev-all.mjs
 *   ./dev-all.mjs
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const WEBAPI_HEALTH_URL = `${String(process.env.WEBAPI_URL || "http://localhost:3000")
  .trim()
  .replace(/\/$/, "")}/health`;

const HEALTH_POLL_MS = 2000;
const HEALTH_MAX_ATTEMPTS = 30;
const SHUTDOWN_GRACE_MS = 3000;

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];
let shuttingDown = false;

/**
 * Poll webapi /health until ready or timeout.
 * @returns {Promise<void>}
 */
async function waitForWebapi() {
  for (let attempt = 1; attempt <= HEALTH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(WEBAPI_HEALTH_URL, { method: "GET" });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.status === "ok") {
          console.log(
            `[dev-all] webapi ready at ${WEBAPI_HEALTH_URL} (attempt ${attempt}/${HEALTH_MAX_ATTEMPTS}).`,
          );
          return;
        }
      }
    } catch (err) {
      console.log(
        `[dev-all] waiting for webapi (${attempt}/${HEALTH_MAX_ATTEMPTS}): ${err?.message ?? err}`,
      );
    }

    if (attempt < HEALTH_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
    }
  }

  throw new Error(
    `[dev-all] webapi did not become healthy at ${WEBAPI_HEALTH_URL} after ${HEALTH_MAX_ATTEMPTS} attempts.`,
  );
}

/**
 * Spawn an npm script in a service directory with inherited stdio.
 * @param {string} name - Label for logs.
 * @param {string} serviceDir - Directory relative to repo root.
 * @param {string} script - npm script name.
 * @returns {import("node:child_process").ChildProcess}
 */
function spawnService(name, serviceDir, script) {
  console.log(`[dev-all] starting ${name} (npm run ${script})…`);

  const child = spawn("npm", ["run", script], {
    cwd: path.join(ROOT, serviceDir),
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    if (signal) {
      console.error(`[dev-all] ${name} exited via signal ${signal}.`);
      shutdown(1);
      return;
    }

    if (code !== 0) {
      console.error(`[dev-all] ${name} exited with code ${code}.`);
      shutdown(code ?? 1);
    }
  });

  children.push(child);
  return child;
}

/**
 * Stop all child processes and exit.
 * @param {number} exitCode
 * @returns {void}
 */
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\n[dev-all] shutting down…");

  for (const child of children) {
    if (child.exitCode == null && child.signalCode == null) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode == null && child.signalCode == null) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, SHUTDOWN_GRACE_MS).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

spawnService("webapi", "webapi", "dev");

try {
  await waitForWebapi();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  shutdown(1);
}

spawnService("web-view", "web-view", "dev");
spawnService("discord-bot", "discord-bot", "dev");

console.log("[dev-all] all services running. Press Ctrl+C to stop.");
console.log("[dev-all]   webapi:      http://localhost:3000");
console.log("[dev-all]   web-view:    http://localhost:3002");
console.log("[dev-all]   discord-bot: connected when token is configured");
