// SMOKE des trois nouveaux formats : la devinette en CASCADE (indices
// dégressifs), le BACCALAURÉAT ÉCLAIR (une lettre, trois rubriques) et le SON
// MYSTÈRE (bruitage synthétisé). Pour ce dernier on ne se contente pas de voir
// l'écran : on REND réellement chaque partition dans un contexte audio hors
// ligne et on mesure le signal — un son muet ne se verrait pas autrement.
// Run: node tools/smoke-formats.mjs
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

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
let fails = 0;
const check = (nom, ok) => { console.log(`${ok ? "✓" : "✗"} ${nom}`); if (!ok) fails++; };

/** Ouvre une partie de plateau avec les drapeaux de test demandés. */
async function nouvellePartie(page, flags) {
  await page.addInitScript((f) => { window.__DONJON_TEST = true; for (const [k, v] of Object.entries(f)) window[k] = v; }, flags);
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 10000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
}

/**
 * Joue les tours jusqu'à voir apparaître le sélecteur attendu. Les écrans qui
 * ne se referment pas d'un simple « Continuer » (marchand, boutique, paris de
 * la galerie, saisie d'un nombre) sont traités NOMMÉMENT : sans cela la
 * traversée s'enlise et le test échoue au hasard plutôt que sur un vrai défaut.
 */
async function jusqua(page, selecteur, tours = 140) {
  for (let i = 0; i < tours; i++) {
    if (await page.locator(selecteur).count()) return true;
    // On reconnaît la boutique et le marchand à leur BOUTON de sortie, pas à
    // leur titre : le titre reste écrit dans le journal du Héraut, et chercher
    // le texte dans toute la page enfermait la traversée dans une boucle.
    for (const nom of ["Quitter la boutique", "Garder mon or"]) {
      const sortie = page.getByRole("button", { name: nom });
      if (await sortie.isVisible().catch(() => false)) await sortie.click().catch(() => {});
    }
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (await roll.isVisible().catch(() => false)) {
      await roll.click();
      await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});
      continue;
    }
    if (await page.locator(selecteur).count()) return true;
    // Paris de la galerie : chaque groupe doit avoir voté pour que ça avance.
    const groups = page.locator(".bet-buttons");
    let vote = false;
    for (let g = 0; g < (await groups.count()); g++) {
      const grp = groups.nth(g);
      if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click().catch(() => {}); vote = true; break; }
    }
    if (vote) continue;
    if ((await page.locator(".num-input").count()) > 0) { await page.locator(".num-input").first().fill("50").catch(() => {}); }
    const suite = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Quitter|Garder|Passer|Suivant|Terminer|J'ai|On a|Personne|Tout le monde a écrit/ }).first();
    if ((await suite.isVisible().catch(() => false)) && (await suite.isEnabled().catch(() => false))) { await suite.click().catch(() => {}); continue; }
    // Filet : n'importe quel bouton VISIBLE du panneau. Le `:visible` compte —
    // sans lui, `.first()` s'arrêtait sur un bouton caché d'un autre écran et
    // la traversée tournait en rond sans jamais rien cliquer.
    const gros = page.locator("#panel .btn-big:not([disabled]):visible, #panel .btn-choice:not([disabled]):visible, #panel button:not([disabled]):visible").first();
    if (await gros.isVisible().catch(() => false)) { await gros.click().catch(() => {}); continue; }
    await page.waitForTimeout(120);
  }
  if (!(await page.locator(selecteur).count())) {
    // Un échec de traversée doit DIRE où l'on s'est arrêté : sinon on cherche
    // un bogue de format alors que c'est le parcours qui s'est enlisé.
    const ecran = (await page.locator("#panel, .panel").first().innerText().catch(() => "")) ?? "";
    console.log(`  (bloqué sur : ${ecran.split("\n").slice(0, 3).join(" | ").slice(0, 140)})`);
    return false;
  }
  return true;
}

try {
  /* ---------- ① la devinette en cascade ---------- */
  {
    const contexte = await browser.newContext({ viewport: { width: 900, height: 1100 } });
    const page = await contexte.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await nouvellePartie(page, { __DONJON_MINIGAME: "cascade" });
    const vue = await jusqua(page, ".cascade-indices");
    check("la devinette en cascade s'ouvre sur le plateau", vue);
    if (vue) {
      check("un seul indice au départ", (await page.locator(".cascade-indice").count()) === 1);
      const gain1 = await page.locator(".cascade-gain").first().textContent();
      check(`le premier indice vaut le plus gros gain (${gain1})`, gain1?.trim() === "+4");
      await page.getByRole("button", { name: /Indice suivant/ }).click();
      await page.waitForTimeout(250);
      check("le deuxième indice s'ajoute au premier", (await page.locator(".cascade-indice").count()) === 2);
      const annonce = await page.getByRole("button", { name: /J'annonce ma réponse/ }).textContent();
      check(`la mise a baissé après un indice (${annonce?.match(/\+\d/)?.[0]})`, /\+3 cases/.test(annonce ?? ""));
      await page.getByRole("button", { name: /Indice suivant/ }).click();
      await page.waitForTimeout(250);
      check("le troisième indice montre le squelette du mot", /_/.test((await page.locator(".cascade-indice").last().textContent()) ?? ""));
      check("plus d'indice à demander au dernier palier", (await page.getByRole("button", { name: /Indice suivant/ }).count()) === 0);
      // Le filet : on redescend sur les quatre propositions.
      await page.getByRole("button", { name: /montrez-moi les 4 propositions/ }).click();
      await page.waitForTimeout(300);
      check("le filet ramène bien aux propositions", (await page.locator(".choices .btn-choice").count()) >= 2);
    }
    await contexte.close();
  }

  /* ---------- ② le Baccalauréat Éclair ---------- */
  {
    const contexte = await browser.newContext({ viewport: { width: 900, height: 1100 } });
    const page = await contexte.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    // __DONJON_BONUS ouvre le bonus de tablée, __DONJON_BAC en choisit la variante.
    await nouvellePartie(page, { __DONJON_BONUS: true, __DONJON_BAC: true });
    const vue = await jusqua(page, ".bac-lettre");
    check("le Baccalauréat Éclair s'ouvre entre deux tours", vue);
    if (vue) {
      const lettre = (await page.locator(".bac-lettre").textContent())?.trim();
      check(`une lettre jouable est tirée (${lettre})`, /^[A-Z]$/.test(lettre ?? "") && !"KQWXYZ".includes(lettre));
      check("trois rubriques sont proposées", (await page.locator(".bac-coche").count()) === 3);
      const pieces = async () => Number((await page.locator("[data-pion] .player-meta").first().textContent())?.match(/🪙(\d+)/)?.[1] ?? -1);
      const avant = await pieces();
      await page.locator(".bac-coche").first().click();
      await page.locator(".bac-coche").nth(1).click();
      await page.waitForTimeout(150);
      await page.getByRole("button", { name: /Valider : 2 rubriques/ }).click();
      await page.waitForTimeout(300);
      const apres = await pieces();
      check(`deux rubriques cochées rapportent 2 🪙 à la tablée (${avant} → ${apres})`, apres === avant + 2);
      check("l'écran de bilan liste les rubriques", (await page.locator(".bet-result").count()) === 3);
    }
    await contexte.close();
  }

  /* ---------- ③ le Son Mystère ---------- */
  {
    const contexte = await browser.newContext({ viewport: { width: 900, height: 1100 } });
    const page = await contexte.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await nouvellePartie(page, { __DONJON_SON: true });
    const vue = await jusqua(page, ".regle-banner:has-text('Son Mystère')");
    check("le Son Mystère s'ouvre sur le plateau", vue);
    if (vue) {
      check("le bouton de réécoute est là (aucun chronomètre)", (await page.getByRole("button", { name: /Réécouter le son|\(Ré\)écouter/ }).count()) === 1);
      check("quatre propositions à l'écoute", (await page.locator(".choices .btn-choice").count()) === 4);
      // Le secours « on n'a pas compris » vaut aussi pour un bruitage.
      const avant = await page.locator(".choices .btn-choice").first().textContent();
      check("un autre son peut être demandé", (await page.locator(".changer-question").count()) === 1);
      await page.locator(".changer-question").click();
      await page.waitForTimeout(400);
      const apres = await page.locator(".choices .btn-choice").first().textContent();
      check(`le bruitage a bien changé (« ${String(avant).slice(0, 22)}… » → « ${String(apres).slice(0, 22)}… »)`, avant !== apres);
      check("on ne peut pas en redemander indéfiniment", (await page.locator(".changer-question").count()) === 0);
    }
    // Chaque partition produit-elle VRAIMENT du son ? Rendu hors ligne + mesure.
    const mesures = await page.evaluate(async () => {
      const noms = window.__donjonSonsConnus();
      const out = [];
      for (const nom of noms) {
        const ctx = new OfflineAudioContext(1, 44100 * 5, 44100);
        window.__donjonSonPartition(nom, ctx, 0.02);
        const buf = await ctx.startRendering();
        const d = buf.getChannelData(0);
        // Un RMS moyenné sur cinq secondes punirait injustement les sons
        // BREFS mais bien nets (le galop, les gouttes) : on mesure donc la
        // crête et la DURÉE AUDIBLE, pas la moyenne du silence autour.
        let crete = 0, audibles = 0;
        for (let i = 0; i < d.length; i++) {
          const a = Math.abs(d[i]);
          if (a > crete) crete = a;
          if (a > 0.01) audibles += 1;
        }
        out.push({ nom, crete, msAudibles: Math.round((audibles / buf.sampleRate) * 1000) });
      }
      return out;
    });
    const muets = mesures.filter((m) => m.crete < 0.03 || m.msAudibles < 60);
    check(`les ${mesures.length} bruitages produisent un vrai signal`, muets.length === 0);
    if (muets.length) console.log("  muets : " + muets.map((m) => `${m.nom} (crête ${m.crete.toFixed(3)}, ${m.msAudibles} ms audibles)`).join(", "));
    const satures = mesures.filter((m) => m.crete > 1);
    check("aucun bruitage ne sature (crête ≤ 1)", satures.length === 0);
    if (satures.length) console.log("  saturés : " + satures.map((m) => `${m.nom} (crête ${m.crete.toFixed(2)})`).join(", "));
    await contexte.close();
  }

  /* ---------- ④ le Son Mystère existe AUSSI en Partie Éclair ---------- */
  {
    const contexte = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await contexte.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await page.addInitScript(() => { window.__DONJON_TEST = true; window.__DONJON_SON = true; });
    await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
    await page.locator("#bank-info").textContent({ timeout: 10000 });
    await page.getByRole("button", { name: /Partie Éclair/ }).click();
    await page.waitForSelector(".eclair-setup", { timeout: 8000 });
    await page.getByRole("button", { name: "⚡ C'est parti !" }).click();
    await page.waitForSelector(".eclair-carte", { timeout: 8000 });
    const reecoute = (await page.locator(".eclair-reecoute").count()) > 0;
    check("le Son Mystère s'invite dans le sprint éclair", reecoute);
    if (reecoute) {
      check("quatre propositions à l'écoute (éclair)", (await page.locator(".eclair-choix").count()) === 4);
      await page.locator(".eclair-choix").first().click();
      await page.waitForSelector(".eclair-verdict", { timeout: 8000 });
      const anecdote = await page.locator(".eclair-v-anecdote").innerText();
      check(`le verdict garde son anecdote (« ${anecdote.slice(2, 40)}… »)`, anecdote.length > 12);
    }
    await contexte.close();
  }

  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log("  " + errors.slice(0, 3).join("\n  "));
} catch (e) {
  check(`déroulement sans imprévu (${String(e.message).split("\n")[0]})`, false);
} finally {
  await browser.close();
}
console.log(fails ? "FORMATS SMOKE: ÉCHEC" : "FORMATS SMOKE OK");
process.exit(fails ? 1 : 0);
