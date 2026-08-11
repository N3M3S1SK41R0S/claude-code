// Generates the PWA icons by screenshotting a vector design in headless
// Chromium. Run: node tools/make-icons.mjs
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "icons");
mkdirSync(outDir, { recursive: true });

function findChromium() {
  const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].filter(Boolean);
  for (const c of candidates) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome", "chromium"]) {
      const p = join(c, sub);
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
  }
  throw new Error("Chromium not found — set CHROMIUM_PATH");
}

// Vector-only: dungeon gate + golden question mark banner.
function iconHtml(size, padded) {
  const pad = padded ? 0.18 : 0;
  return `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;overflow:hidden}</style></head><body>
  <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="50%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#332457"/>
        <stop offset="100%" stop-color="#1a1230"/>
      </radialGradient>
    </defs>
    <rect width="100" height="100" fill="url(#bg)"/>
    <g transform="translate(${50 * pad} ${50 * pad}) scale(${1 - pad})">
      <!-- crenellated wall -->
      <path d="M14 34 h8 v-7 h8 v7 h10 v-7 h8 v7 h10 v-7 h8 v7 h10 v-7 h8 v7 h2 v56 H14 Z" fill="#4a3a78" stroke="#2a1f4a" stroke-width="1.5"/>
      <!-- gate arch -->
      <path d="M34 90 v-30 a16 16 0 0 1 32 0 v30 Z" fill="#120c22" stroke="#e0b04a" stroke-width="2.5"/>
      <!-- portcullis bars -->
      <g stroke="#5c4a92" stroke-width="1.6">
        <line x1="40" y1="90" x2="40" y2="52"/><line x1="47" y1="90" x2="47" y2="48"/>
        <line x1="53" y1="90" x2="53" y2="48"/><line x1="60" y1="90" x2="60" y2="52"/>
      </g>
      <!-- golden question mark over the gate -->
      <text x="50" y="72" font-size="30" font-family="Georgia, serif" font-weight="bold"
            text-anchor="middle" fill="#e0b04a" stroke="#1a1230" stroke-width="0.8">?</text>
      <!-- banner -->
      <rect x="30" y="12" width="40" height="10" rx="3" fill="#e0b04a"/>
      <path d="M30 22 l5 5 5 -5 Z M60 22 l5 5 5 -5 Z" fill="#e0b04a"/>
    </g>
  </svg></body></html>`;
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
for (const { file, size, padded } of [
  { file: "icon-512.png", size: 512, padded: false },
  { file: "icon-192.png", size: 192, padded: false },
  { file: "maskable-512.png", size: 512, padded: true },
  { file: "apple-touch-icon.png", size: 180, padded: false },
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(iconHtml(size, padded));
  await page.screenshot({ path: join(outDir, file) });
  await page.close();
  console.log(`✓ ${file}`);
}
await browser.close();
