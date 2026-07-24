// Le Grimoire : carnet PERSISTANT des anecdotes découvertes en jeu. Chaque
// anecdote affichée s'y range (avec sa question, sa catégorie et ses sources) ;
// on le consulte depuis l'accueil, filtrable par thème. Capé aux 400 plus
// récentes ; résilient au mode privé.

const KEY = "donjon-grimoire";
const CAP = 400;

let entries = null;

function load() {
  if (entries) return entries;
  try { entries = JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { entries = []; }
  if (!Array.isArray(entries)) entries = [];
  return entries;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* mode privé */ }
}

/** Range une anecdote découverte (déduplication par id de question). */
export function addToGrimoire(q) {
  if (!q || !q.anecdote || q.maison) return; // les questions maison ne sont pas vérifiées
  load();
  if (entries.some((e) => e.id === q.id)) return;
  entries.push({
    id: q.id,
    categorie: q.categorie ?? "Général",
    texte: q.texte ?? "",
    anecdote: q.anecdote,
    sources: (q.sources ?? []).slice(0, 3),
    ts: Date.now(),
  });
  if (entries.length > CAP) entries = entries.slice(entries.length - CAP);
  persist();
}

/** Toutes les entrées, des plus récentes aux plus anciennes. */
export function grimoireEntries() {
  return [...load()].reverse();
}

export function grimoireSize() {
  return load().length;
}
