// "Questions maison" — the table writes its own questions (stored on the
// device, mixed into the bank). Family fuel for an inexhaustible game:
// kids quizzing parents is half the fun. Custom entries are clearly tagged
// (🏠, no sources) so they are never confused with the verified bank.

const KEY = "donjon-custom-v1";

export const CUSTOM_CATEGORIES = [
  "Histoire", "Géographie", "Littérature", "Sciences & Nature", "Arts",
  "Cinéma", "Musique", "Gastronomie", "Sport", "Langue française",
  "Pop Culture", "Insolite", "Général", "Notre famille",
];

export function loadCustom() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) ?? [];
    return Array.isArray(raw) ? raw.filter(isValidCustom) : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function isValidCustom(q) {
  if (!q || typeof q.texte !== "string" || q.texte.trim().length < 5) return false;
  if (!["qcm", "vrai_faux"].includes(q.format)) return false;
  if (!["enfant", "ado", "adulte"].includes(q.niveau_age)) return false;
  const n = q.format === "qcm" ? 4 : 2;
  return (
    Array.isArray(q.choix) && q.choix.length === n &&
    q.choix.every((c) => typeof c === "string" && c.trim().length > 0) &&
    typeof q.bonne_reponse === "string" && q.choix.includes(q.bonne_reponse)
  );
}

/** Add a custom question; returns the stored entry or null if invalid/full. */
export function addCustom(q) {
  if (!isValidCustom(q)) return null;
  const list = loadCustom();
  const entry = {
    id: `maison-${(list[list.length - 1]?.seq ?? 0) + 1}`,
    seq: (list[list.length - 1]?.seq ?? 0) + 1,
    maison: true,
    format: q.format,
    categorie: CUSTOM_CATEGORIES.includes(q.categorie) ? q.categorie : "Notre famille",
    niveau_age: q.niveau_age,
    difficulte: q.niveau_age === "enfant" ? 1 : q.niveau_age === "ado" ? 3 : 4,
    texte: q.texte.trim(),
    choix: q.choix.map((c) => c.trim()),
    bonne_reponse: q.bonne_reponse.trim(),
    anecdote: (q.anecdote ?? "").trim() || `Question maison${q.auteur ? ` signée ${q.auteur.trim()}` : ""} — le Héraut décline toute responsabilité.`,
    auteur: (q.auteur ?? "").trim(),
    sources: [],
  };
  list.push(entry);
  return persist(list) ? entry : null;
}

export function removeCustom(id) {
  const list = loadCustom().filter((q) => q.id !== id);
  persist(list);
}
