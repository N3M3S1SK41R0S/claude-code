// Generates the PWA icons (PNG) by screenshotting a vector design in headless
// Chromium — no image dependency needed. Run: npm run icons
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  for (const c of candidates) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome", "chromium"]) {
      const p = join(c, sub);
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
  }
  return null;
}

// Vector-only design (no emoji font needed): gold top hat + monocle on ink.
function iconHtml(size, padded) {
  const pad = padded ? 0.18 : 0; // maskable safe zone
  return `<!doctype html><html><head><style>
  * { margin: 0; padding: 0 }
  body { width: ${size}px; height: ${size}px; overflow: hidden }
  </style></head><body>
  <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="50%" cy="38%" r="75%">
        <stop offset="0%" stop-color="#251c48"/>
        <stop offset="100%" stop-color="#0e0b1e"/>
      </radialGradient>
    </defs>
    <rect width="100" height="100" fill="url(#bg)"/>
    <g transform="translate(${50 * pad} ${50 * pad}) scale(${1 - pad})">
      <circle cx="50" cy="50" r="44" fill="none" stroke="#d9a83c" stroke-width="2.5" opacity="0.9"/>
      <!-- top hat -->
      <rect x="33" y="24" width="34" height="30" rx="3" fill="#d9a83c"/>
      <rect x="33" y="46" width="34" height="6" fill="#a87c1f"/>
      <ellipse cx="50" cy="55" rx="26" ry="6" fill="#d9a83c"/>
      <!-- monocle -->
      <circle cx="67" cy="72" r="8.5" fill="none" stroke="#f0c05a" stroke-width="2.6"/>
      <line x1="73" y1="78" x2="79" y2="86" stroke="#f0c05a" stroke-width="2.2" stroke-linecap="round"/>
      <!-- eyebrow, unimpressed -->
      <path d="M 30 70 q 8 -5 16 -1" fill="none" stroke="#f0c05a" stroke-width="2.4" stroke-linecap="round"/>
    </g>
  </svg></body></html>`;
}

const exe = findChromium();
if (!exe) {
  console.error("No Chromium binary found — set CHROMIUM_PATH.");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: exe });
const targets = [
  { file: "icon-512.png", size: 512, padded: false },
  { file: "icon-192.png", size: 192, padded: false },
  { file: "maskable-512.png", size: 512, padded: true },
  { file: "apple-touch-icon.png", size: 180, padded: false },
];

for (const { file, size, padded } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(iconHtml(size, padded));
  await page.screenshot({ path: join(outDir, file) });
  await page.close();
  console.log(`✓ ${file}`);
}

await browser.close();
