// End-to-end smoke test: boots the production server, plays one full question
// (wheel → teaser → answer → reveal) and checks the offline shell via the
// service worker. Run after `npm run build`: node scripts/smoke.mjs
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const PORT = 3111;
const BASE = `http://localhost:${PORT}`;

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
  throw new Error("Chromium not found");
}

// With SMOKE_EXTERNAL_SERVER=1 the script expects `next start -p 3111` to be
// already running (useful under CI harnesses that reap child processes).
let killServer = () => {};
if (process.env.SMOKE_EXTERNAL_SERVER !== "1") {
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
  killServer = () => {
    try {
      server.kill("SIGTERM");
    } catch {}
  };
  process.on("exit", killServer);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server start timeout")), 30000);
    const watch = (d) => {
      if (/Ready|started server/i.test(String(d))) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on("data", watch);
    server.stderr.on("data", watch);
    server.on("exit", () => reject(new Error("server died")));
  });
} else {
  // Poll until the externally-started server answers.
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
      if (res.ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error("external server not reachable");
    await new Promise((r) => setTimeout(r, 500));
  }
}

// --no-proxy-server: Chromium on Linux honors HTTP(S)_PROXY env vars, which
// would route localhost through the CI proxy and hang the test.
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const failures = [];
const check = (name, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures.push(name);
};

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  check("home loads", (await page.title()).includes("Grand Mogul"));
  check("manifest linked", (await page.locator('link[rel="manifest"]').count()) === 1);

  const swOk = await page
    .evaluate(() => Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise((r) => setTimeout(() => r(false), 10000)),
    ]))
    .catch(() => false);
  check("service worker registered", swOk);

  const bankLine = await page.locator("footer p").first().textContent();
  check("seed bank loaded", /\d+ questions vérifiées/.test(bankLine ?? ""));

  // Solo game: intro → wheel → teaser → question (any format) → reveal.
  await page.getByRole("button", { name: "Entrer sur le plateau" }).click();
  await page.getByRole("button", { name: "C'est parti" }).click();
  await page.getByRole("button", { name: "Tourner la roue" }).click();
  await page.waitForSelector(
    [
      'div[role="group"][aria-label="Choix de réponse"] button',
      'div[role="group"][aria-label="Choisissez votre mise"] button',
      'div[role="group"][aria-label="Pari de confiance"] button',
      'input[aria-label="Votre réponse"]',
      'input[aria-label="Votre estimation numérique"]',
    ].join(", "),
    { timeout: 15000 },
  );
  check("question displayed", true);

  // Format-specific pre-steps: pick CARRÉ for cash/carré/duo, PRUDENT for a bet.
  if (await page.getByRole("button", { name: /CARRÉ/ }).count()) {
    await page.getByRole("button", { name: /CARRÉ/ }).click();
  }
  if (await page.getByRole("button", { name: /PRUDENT/ }).count()) {
    await page.getByRole("button", { name: /PRUDENT/ }).click();
  }

  // Use LILUNE's hint, then answer whatever input the format offers.
  await page.locator('button[aria-label^="LILUNE"]').click();
  check("hint shown", (await page.locator("text=🌙").count()) > 0);
  const textInput = page.locator('input[aria-label="Votre réponse"], input[aria-label="Votre estimation numérique"]');
  if (await textInput.count()) {
    await textInput.fill("42");
    await page.getByRole("button", { name: "Valider" }).click();
  } else {
    await page.locator('div[aria-label="Choix de réponse"] button:not([disabled])').first().click();
  }
  await page.waitForSelector("text=L'anecdote du Mogul", { timeout: 8000 });
  check("reveal + anecdote", true);
  check("continue button", (await page.getByRole("button", { name: /Continuer|Voir le verdict/ }).count()) === 1);
  check("quit button present", (await page.locator('button[aria-label="Quitter la partie"]').count()) === 1);

  // Offline: the service worker must serve the app shell.
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.goto(BASE, { waitUntil: "load", timeout: 15000 });
  const offlineTitleOk = (await page.title()).includes("Grand Mogul") || (await page.title()).includes("Hors-ligne");
  check("offline shell served", offlineTitleOk);
  await context.setOffline(false);
} catch (err) {
  check(`no unexpected error (${err.message})`, false);
} finally {
  await browser.close();
  killServer();
}

if (failures.length > 0) {
  console.error(`\nSMOKE FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nSMOKE OK");
