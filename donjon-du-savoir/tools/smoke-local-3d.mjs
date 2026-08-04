// SMOKE « comme chez le joueur » : le FICHIER AUTONOME ouvert en file://,
// sur un rendu logiciel volontairement lent (SwiftShader). Vérifie que le
// plateau 3D s'affiche ET QU'IL Y RESTE — c'est précisément ce que les
// autres tests rataient : ils servaient le jeu en HTTP avec le garde-fou de
// performance neutralisé, et ne voyaient donc jamais le repli 2D subi par le
// joueur. Vérifie aussi l'état affiché de la voix dans les Réglages.
// Run: node tools/smoke-local-3d.mjs
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({
  executablePath: findChromium(),
  // Rendu LOGICIEL : le pire cas réaliste, celui qui déclenchait le repli.
  args: ["--no-proxy-server", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
let fails = 0;
const check = (nom, ok) => { console.log(`${ok ? "✓" : "✗"} ${nom}`); if (!ok) fails++; };

try {
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 20000 });
  const tuto = page.getByRole("button", { name: "Passer le tutoriel" });
  if (await tuto.isVisible().catch(() => false)) await tuto.click();

  // ① L'état de la voix est ANNONCÉ dans les Réglages (sans clé : synthèse).
  await page.getByRole("button", { name: /Réglages/ }).click();
  await page.waitForTimeout(400);
  const etatVoix = (await page.locator(".voixdirect-etat").first().textContent().catch(() => "")) ?? "";
  check(`l'état de la voix est affiché (« ${etatVoix.slice(0, 44)}… »)`, /SYNTHÈSE|VRAIE voix/.test(etatVoix));
  // ② Le réglage du plateau 3D existe et vaut « Toujours » par défaut.
  const reglage3D = await page.locator(".reglage-row", { hasText: "Plateau 3D" }).first().innerText().catch(() => "");
  check("le réglage « Plateau 3D » est proposé", /Toujours/.test(reglage3D));
  await page.getByRole("button", { name: /Retour|Accueil/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);

  // ③ Une partie : la 3D s'affiche…
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.waitForTimeout(600);
  const micro = page.getByRole("button", { name: "🔊 Oui, à voix haute !" });
  if (await micro.isVisible().catch(() => false)) await micro.click();
  await page.waitForTimeout(3000);
  const visible = async () => page.evaluate(() => {
    const c = document.querySelector(".board3d-canvas");
    return c ? getComputedStyle(c).display !== "none" : false;
  });
  check("le plateau 3D s'affiche dans le fichier autonome", await visible());

  // ④ … ET IL Y RESTE : 45 s de rendu logiciel très lent, sans repli subi.
  let resteEn3D = true;
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(5000);
    if (!(await visible())) { resteEn3D = false; break; }
  }
  check("le plateau RESTE en 3D après 45 s de rendu lent", resteEn3D);
  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log("  " + errors.slice(0, 3).join("\n  "));
} catch (e) {
  check(`déroulement sans imprévu (${String(e.message).split("\n")[0]})`, false);
} finally {
  await browser.close();
}
console.log(fails ? "LOCAL-3D SMOKE: ÉCHEC" : "LOCAL-3D SMOKE OK");
process.exit(fails ? 1 : 0);
