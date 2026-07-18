// Validates the verified word-game content (data/wordgames.json) and the
// drawDefi freshness logic. No browser. Run: node tools/test-wordgames.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "wordgames.json"), "utf8"));

let pass = 0;
const failures = [];
const check = (name, ok) => { console.log(`${ok ? "✓" : "✗"} ${name}`); if (ok) pass++; else failures.push(name); };

const defis = data.defis ?? [];
const TYPES = new Set(["tabou", "password", "mime"]);
const NIVEAUX = new Set(["enfant", "ado", "adulte"]);

// ---- Schema & integrity ----
check("has a decent number of défis", defis.length >= 40);
check("all ids unique", new Set(defis.map((d) => d.id)).size === defis.length);
check("all types valid", defis.every((d) => TYPES.has(d.type)));
check("all niveaux valid", defis.every((d) => NIVEAUX.has(d.niveau)));
check("all have a theme", defis.every((d) => typeof d.theme === "string" && d.theme.length > 0));

const tabous = defis.filter((d) => d.type === "tabou");
const passwords = defis.filter((d) => d.type === "password");
const mimes = defis.filter((d) => d.type === "mime");
check("has all three game types", tabous.length > 0 && passwords.length > 0 && mimes.length > 0);
check("tabou: word + exactly 5 forbidden words", tabous.every((d) => d.mot && Array.isArray(d.interdits) && d.interdits.length === 5));
check("tabou: forbidden words never contain the target", tabous.every((d) => d.interdits.every((w) => !d.mot.toLowerCase().includes(w.toLowerCase()) && !w.toLowerCase().includes(d.mot.toLowerCase()))));
check("password: has a single-word target", passwords.every((d) => d.mot && d.mot.trim().split(/\s+/).length <= 2));
check("mime: has an expression to act out", mimes.every((d) => d.expression && d.expression.length >= 3));
check("every entry has a playable target", defis.every((d) => (d.mot ?? d.expression ?? "").length >= 2));

// ---- Each level is represented (so the child-only rule always has content) ----
check("has enfant-level défis (playable by everyone)", defis.some((d) => d.niveau === "enfant"));
check("has an enfant défi for each guessing type", ["tabou", "password", "mime"].every((t) => defis.some((d) => d.type === t && d.niveau === "enfant")));

// ---- Light originality / safety scan (no brands or licensed characters) ----
const BANNED = ["mario", "pokémon", "pokemon", "astérix", "asterix", "naheulbeuk", "kaamelott", "disney", "star wars", "harry potter", "coca", "google"];
const haystack = JSON.stringify(defis).toLowerCase();
check("no obvious brand/licensed terms", !BANNED.some((w) => haystack.includes(w)));

// ---- drawDefi freshness (import the real module with a fetch shim) ----
globalThis.localStorage = (() => {
  let store = {};
  return { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
})();
globalThis.fetch = async (url) => {
  if (String(url).includes("wordgames.json")) return { ok: true, json: async () => data };
  throw new Error("unexpected fetch");
};
const wg = await import(pathToFileURL(join(root, "js", "wordgames.js")).href);
const n = await wg.loadWordgames();
check("loadWordgames returns the count", n === defis.length);
check("wordgamesSize matches", wg.wordgamesSize() === defis.length);

// hasChild → only enfant défis
let childOk = true;
for (let i = 0; i < 30; i++) { const d = wg.drawDefi({ hasChild: true }); if (!d || d.niveau !== "enfant") { childOk = false; break; } }
check("drawDefi(hasChild) only returns enfant défis", childOk);

// type filter works
const mime = wg.drawDefi({ type: "mime" });
check("drawDefi(type: mime) returns a mime", mime?.type === "mime");

// Freshness: drawing many times spreads across all entries before repeating a lot.
const seen = new Set();
for (let i = 0; i < defis.length; i++) { const d = wg.drawDefi({}); if (d) seen.add(d.id); }
check("freshness spreads draws across most content", seen.size >= Math.floor(defis.length * 0.7));

if (failures.length) { console.error(`\nWORDGAMES TESTS FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log(`\nWORDGAMES TESTS OK (${pass} checks)`);
