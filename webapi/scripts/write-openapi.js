import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiSpec } from "../lib/openapi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const spec = buildOpenApiSpec();
const outPath = path.join(ROOT, "openapi.generated.json");
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2) + "\n");

const pathCount = Object.keys(spec.paths || {}).length;
console.log(`Wrote ${path.relative(ROOT, outPath)} (${pathCount} paths).`);
