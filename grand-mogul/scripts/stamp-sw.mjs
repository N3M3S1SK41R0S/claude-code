// Generates public/sw.js from sw/template.js, stamping a unique build id so
// every deploy re-installs the service worker and refreshes the precache.
// Runs automatically via the prebuild/predev npm hooks.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(join(root, "sw", "template.js"), "utf8");
const buildId = process.env.SW_BUILD_ID ?? Date.now().toString(36);

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "sw.js"), template.replaceAll("__BUILD_ID__", buildId), "utf8");
console.log(`✓ public/sw.js stamped (build ${buildId})`);
