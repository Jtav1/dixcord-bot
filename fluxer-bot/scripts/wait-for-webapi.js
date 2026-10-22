import "dotenv/config";

const INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;

function normalizeBaseUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\/$/, "");
}

/**
 * Poll GET ${WEBAPI_URL}/health until 200 and JSON { status: "ok" }, or throw after max attempts.
 */
export async function waitForWebapi() {
  const base = normalizeBaseUrl(process.env.WEBAPI_URL);
  if (!base) {
    throw new Error(
      "wait-for-webapi: WEBAPI_URL is not set; cannot wait for API readiness.",
    );
  }
  const healthUrl = `${base}/health`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(healthUrl, { method: "GET" });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.status === "ok") {
          console.log(
            `wait-for-webapi: ${healthUrl} ready (attempt ${attempt}/${MAX_ATTEMPTS}).`,
          );
          return;
        }
      }
    } catch (err) {
      console.log(
        `wait-for-webapi: attempt ${attempt}/${MAX_ATTEMPTS} failed (${err?.message ?? err}).`,
      );
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  throw new Error(
    `wait-for-webapi: timed out after ${MAX_ATTEMPTS} attempts (${healthUrl}).`,
  );
}
