// Préférences de confort persistées (accessibilité + affichage) et petits
// drapeaux d'état (tutoriel déjà vu). Tout est stocké dans localStorage et
// appliqué sur <html> via des classes que le CSS interprète. Résilient au mode
// privé : en cas d'échec de stockage, on retombe sur les valeurs par défaut.

const KEY = "donjon-prefs";

const DEFAULTS = {
  police: "standard", // "standard" | "lisible" — police sans empattement aérée (aide la dyslexie)
  daltonien: false, // palette bonne/coup dur adaptée (bleu / orange, distinguables)
  animations: "completes", // "completes" | "reduites" — coupe les animations au choix
  gros: false, // texte plus grand pour le confort de lecture
  immersion: true, // saynètes 2.5D + caméra qui suit le pion (façon Mario Party)
  tutoVu: false, // le tutoriel du 1er lancement a déjà été vu
};

let prefs = { ...DEFAULTS };

/** Charge les préférences et les applique. À appeler tôt au démarrage. */
export function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === "object") prefs = { ...DEFAULTS, ...raw };
  } catch { /* mode privé : valeurs par défaut */ }
  applyPrefs();
  return prefs;
}

export function getPrefs() {
  return prefs;
}

/** Modifie une préférence, la persiste et l'applique aussitôt. */
export function setPref(key, value) {
  prefs[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* mode privé */ }
  applyPrefs();
}

/** Applique les préférences sous forme de classes sur <html> (lues par le CSS). */
export function applyPrefs() {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.classList.toggle("pref-lisible", prefs.police === "lisible");
  r.classList.toggle("pref-daltonien", !!prefs.daltonien);
  r.classList.toggle("pref-anim-reduites", prefs.animations === "reduites");
  r.classList.toggle("pref-gros", !!prefs.gros);
}
