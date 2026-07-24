// Vérifie le vrai renderer WebGL depuis le fichier autonome : canvas visible,
// mini-carte, héros GLB/Draco chargés et aucun repli silencieux vers la 2D.
// Usage : CHROMIUM_PATH=/chemin/chromium node tools/smoke-3d.mjs [capture.png]
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, "dist", "donjon-standalone.html");
const screenshotPath = process.argv[2] || null;

function findChromium() {
  for (const candidate of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(candidate)) continue;
    if (statSync(candidate).isFile()) return candidate;
    for (const child of ["chrome-linux/chrome", "chrome", "chromium"]) {
      const executable = join(candidate, child);
      if (existsSync(executable) && statSync(executable).isFile()) return executable;
    }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ["--no-proxy-server"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const errors = [];
const failedRequests = [];
const modelWarnings = [];
const failures = [];
const check = (name, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures.push(name);
};

page.on("pageerror", (error) => errors.push(String(error)));
page.on("requestfailed", (request) => failedRequests.push(`${request.url()} — ${request.failure()?.errorText ?? "échec"}`));
page.on("console", (message) => {
  const value = message.text();
  if (/3D indisponible|Modèle 3D|Figurine 3D/.test(value)) modelWarnings.push(value);
});

try {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("donjon-prefs", JSON.stringify({
        tutoVu: true,
        immersion: true,
        animations: "completes",
      }));
    } catch {
      // Un stockage privé indisponible ne doit pas empêcher le diagnostic WebGL.
    }
    try {
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 8 });
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 8 });
    } catch {
      // Le navigateur de CI peut exposer des propriétés non configurables.
    }
  });

  await page.goto(pathToFileURL(standalone).href, { waitUntil: "load" });
  await page.locator("#bank-info").filter({ hasText: /\d+ questions vérifiées/ }).waitFor({ timeout: 12_000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8_000 });

  const canvas = page.locator(".board3d-canvas");
  await canvas.waitFor({ state: "visible", timeout: 12_000 });
  check("canvas WebGL visible", await canvas.isVisible());
  check("plateau 2D masqué", await page.locator("#board").evaluate((node) => node.style.display === "none"));
  check("mini-carte visible", await page.locator(".minimap").isVisible());
  check("contexte WebGL actif", await canvas.evaluate((node) => Boolean(
    node.getContext("webgl2") || node.getContext("webgl") || node.getContext("experimental-webgl"),
  )));

  await page.waitForFunction(
    () => Number(document.querySelector(".board3d-canvas")?.dataset.heroModels || 0) >= 2,
    null,
    { timeout: 15_000 },
  );
  check("deux héros GLB/Draco chargés", Number(await canvas.getAttribute("data-hero-models")) >= 2);

  if (screenshotPath) {
    await page.locator(".board-scroll").screenshot({ path: screenshotPath });
    console.log(`✓ capture ${screenshotPath}`);
  }

  check("aucun repli 3D", modelWarnings.length === 0);
  check("aucune requête échouée", failedRequests.length === 0);
  check("aucune erreur de page", errors.length === 0);
} catch (error) {
  check(`aucune erreur inattendue (${String(error.message).split("\n")[0]})`, false);
} finally {
  if (modelWarnings.length) console.log("  avertissements :", modelWarnings.slice(0, 4).join(" | "));
  if (failedRequests.length) console.log("  requêtes :", failedRequests.slice(0, 4).join(" | "));
  if (errors.length) console.log("  erreurs :", errors.slice(0, 4).join(" | "));
  await browser.close();
}

if (failures.length) {
  console.error(`\nSMOKE 3D ÉCHOUÉ : ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nSMOKE 3D OK");
