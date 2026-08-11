// CONTRÔLE DES SOURCES : chaque question promet une anecdote VÉRIFIÉE et
// affiche ses liens en jeu. Une URL inventée trahit cette promesse — et rien
// ne la distingue d'une bonne à l'œil nu. Ce contrôle les interroge vraiment.
//
//   node tools/verif-sources.mjs                    → toute la banque
//   node tools/verif-sources.mjs data/forge/lot-A.json  → un lot de candidates
//
// Seul un 404/410 (page absente) est un ÉCHEC : un blocage réseau, un 403 ou
// un délai dépassé sont signalés à part, sans condamner une source peut-être
// parfaitement valable.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cible = process.argv[2];
const brut = JSON.parse(readFileSync(cible ? join(root, cible) : join(root, "data", "questions.json"), "utf8"));
const questions = Array.isArray(brut) ? brut : brut.questions;

// Une même URL sert souvent plusieurs questions : on ne l'interroge qu'une fois.
const parUrl = new Map();
for (const q of questions) {
  for (const u of q.sources ?? []) {
    if (!parUrl.has(u)) parUrl.set(u, []);
    parUrl.get(u).push(q.id ?? q.texte.slice(0, 40));
  }
}
console.log(`${parUrl.size} URL distinctes pour ${questions.length} questions.`);

const absentes = [], douteuses = [];
const urls = [...parUrl.keys()];
const LOT = 8; // politesse : on n'assomme pas les serveurs
for (let i = 0; i < urls.length; i += LOT) {
  await Promise.all(urls.slice(i, i + LOT).map(async (u) => {
    try {
      const ctl = AbortSignal.timeout(20000);
      // HEAD d'abord (léger) ; certains sites ne l'acceptent pas → GET.
      let r = await fetch(u, { method: "HEAD", redirect: "follow", signal: ctl }).catch(() => null);
      if (!r || r.status === 405 || r.status === 403) r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (r.status === 404 || r.status === 410) absentes.push([u, r.status]);
      else if (!r.ok) douteuses.push([u, r.status]);
    } catch (e) {
      douteuses.push([u, String(e.name || e.message).slice(0, 40)]);
    }
  }));
  process.stdout.write(`\r  interrogées : ${Math.min(i + LOT, urls.length)}/${urls.length}`);
}
console.log("");

// SECONDE CHANCE, AU RALENTI : un « 429 » (trop de requêtes) vient de notre
// propre cadence, pas d'une source fautive. On repasse ces URL une par une,
// espacées — sans quoi un contrôle sain ressemblerait à une avalanche de
// problèmes et on finirait par ne plus le lire.
if (douteuses.length) {
  console.log(`\nSeconde chance au ralenti pour ${douteuses.length} URL…`);
  const restantes = [];
  for (const [u, code] of douteuses) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(25000) });
      if (r.status === 404 || r.status === 410) absentes.push([u, r.status]);
      else if (!r.ok) restantes.push([u, r.status]);
    } catch { restantes.push([u, code]); }
  }
  douteuses.length = 0;
  douteuses.push(...restantes);
}

for (const [u, code] of absentes) console.log(`✗ ${code} — ${u}\n     questions : ${parUrl.get(u).slice(0, 4).join(", ")}`);
for (const [u, code] of douteuses) console.log(`? ${code} — ${u}`);
console.log(`\n${absentes.length} source(s) INTROUVABLE(S), ${douteuses.length} non concluante(s) (réseau/403).`);
process.exit(absentes.length ? 1 : 0);
