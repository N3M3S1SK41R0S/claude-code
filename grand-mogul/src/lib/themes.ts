import type { AgeLevel, ThemeDef, ThemeId } from "./types";

export const THEMES: ThemeDef[] = [
  { id: "histoire", name: "Histoire", emoji: "🏛️", color: "#c2703e" },
  { id: "geographie", name: "Géographie", emoji: "🗺️", color: "#3e8ec2" },
  { id: "litterature", name: "Littérature", emoji: "📚", color: "#8e5cc2" },
  { id: "sciences", name: "Sciences & Nature", emoji: "🔬", color: "#3ec27a" },
  { id: "arts", name: "Arts", emoji: "🎨", color: "#c23e6b" },
  { id: "cinema", name: "Cinéma", emoji: "🎬", color: "#c2b23e" },
  { id: "musique", name: "Musique", emoji: "🎼", color: "#5c6ec2" },
  { id: "gastronomie", name: "Gastronomie", emoji: "🧀", color: "#c2803e" },
  { id: "sport", name: "Sport", emoji: "🏅", color: "#3eb8c2" },
  { id: "langue", name: "Langue française", emoji: "🖋️", color: "#a83ec2" },
  { id: "pop-culture", name: "Pop Culture", emoji: "🌟", color: "#c2573e" },
  { id: "insolite", name: "Insolite", emoji: "🦩", color: "#e0568f" },
  { id: "general", name: "Général", emoji: "🧠", color: "#6aa84f" },
];

export const THEME_BY_ID: Record<ThemeId, ThemeDef> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
) as Record<ThemeId, ThemeDef>;

/** game_script categories → internal theme ids (Burger Loufoque merges into Insolite). */
export const SCRIPT_CATEGORY_MAP: Record<string, ThemeId> = {
  "Géographie": "geographie",
  "Histoire": "histoire",
  "Sciences & Nature": "sciences",
  "Sport": "sport",
  "Pop Culture": "pop-culture",
  "Insolite": "insolite",
  "Burger Loufoque": "insolite",
  "Général": "general",
};

/** Audience filter per the game_script: enfant suits all, ado suits adults too. */
export function allowedAges(audience: AgeLevel): AgeLevel[] {
  if (audience === "enfant") return ["enfant"];
  if (audience === "ado") return ["enfant", "ado"];
  return ["enfant", "ado", "adulte"];
}
