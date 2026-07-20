// Colour + icon system for question THEMES (categories) and TYPES (formats).
// Used to colour-code badges, the theme-reveal panel, and the on-board legend
// so a shared table reads the plateau at a glance. Colours are chosen to stay
// legible on the dark parchment, with dark text laid over the filled chip.

export const THEME_META = {
  "Histoire": { emoji: "🏛️", color: "#d0a13a" },
  "Géographie": { emoji: "🌍", color: "#4aa96c" },
  "Sciences & Nature": { emoji: "🔬", color: "#3f93d8" },
  "Sport": { emoji: "⚽", color: "#e0673f" },
  "Pop Culture": { emoji: "💥", color: "#d05fa8" },
  "Insolite": { emoji: "🦩", color: "#9b7ed6" },
  "Général": { emoji: "🎲", color: "#8794a8" },
  "Littérature": { emoji: "📚", color: "#b98a5a" },
  "Arts": { emoji: "🎨", color: "#e07ba0" },
  "Cinéma": { emoji: "🎬", color: "#6470d8" },
  "Musique": { emoji: "🎵", color: "#3fb3a3" },
  "Gastronomie": { emoji: "🍽️", color: "#d9a441" },
  "Langue française": { emoji: "🔤", color: "#cc5f6a" },
};

const THEME_DEFAULT = { emoji: "🏠", color: "#9a86c9" };

export function themeMeta(categorie) {
  return THEME_META[categorie] ?? THEME_DEFAULT;
}

// Ordered for the legend (matches the 13 verified categories).
export const THEME_ORDER = Object.keys(THEME_META);

// Question TYPES (the underlying format). The displayed question may morph
// into a mini-game, but the type badge reflects how you'll answer.
export const TYPE_META = {
  qcm: { emoji: "🔵", label: "QCM", color: "#3f93d8", regle: "4 propositions, une seule bonne." },
  vrai_faux: { emoji: "⚖️", label: "Vrai ou Faux", color: "#4aa96c", regle: "Deux choix : Vrai ou Faux." },
  gambit_numerique: { emoji: "🔢", label: "Nombre mystère", color: "#d0a13a", regle: "Répondez par un nombre, à voix haute." },
  equipe: { emoji: "👥", label: "En équipe", color: "#d05fa8", regle: "Toute la tablée cherche, à voix haute." },
  cash_carre_duo: { emoji: "🎯", label: "Cash / Carré / Duo", color: "#e0673f", regle: "Choisissez votre risque avant de voir la question." },
};

const TYPE_DEFAULT = { emoji: "❓", label: "Question", color: "#8794a8", regle: "" };

export function typeMeta(format) {
  return TYPE_META[format] ?? TYPE_DEFAULT;
}

export const TYPE_ORDER = Object.keys(TYPE_META);

/** Inline style for a filled chip in a theme/type colour (dark text over it). */
export function chipStyle(color) {
  return `background:${color};color:#1a1230;border:1px solid rgba(0,0,0,0.18)`;
}

/** Inline style for a soft outlined chip (tinted, coloured left border). */
export function softStyle(color) {
  return `background:${color}22;color:var(--ink);border:1px solid ${color};border-left-width:4px`;
}
