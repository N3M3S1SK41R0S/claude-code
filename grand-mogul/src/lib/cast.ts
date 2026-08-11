import type { CastId, CastMember } from "./types";

/**
 * The five companions — original heroic-fantasy parody archetypes.
 * Each one is a once-per-match joker. Each speaks ONLY in their own register,
 * interventions ≤ 2 lines, and the host gets at most one retort per question.
 */
export const CAST: CastMember[] = [
  {
    id: "gronk",
    name: "GRONK",
    title: "Barbare, QI d'enclume",
    emoji: "🪓",
    color: "#c2563e",
    skill: { id: "casse-tout", name: "CASSE-TOUT", description: "Élimine 2 mauvaises réponses" },
    voice: { pitch: 0.5, rate: 0.75 },
    onUse: [
      "GRONK RÉFLÉCHIR. AÏE.",
      "GRONK CASSER MAUVAISES RÉPONSES. GRONK CONTENT.",
      "Deux réponses parties. Gronk compter jusqu'à deux. Fierté.",
      "Ça se mange, la Renaissance ?",
    ],
    hostRetorts: [
      "Merci Gronk. La science te contemple. De loin.",
      "Subtil comme toujours, Gronk. Le mur te remercie.",
    ],
  },
  {
    id: "lilune",
    name: "LILUNE",
    title: "Elfe mystique, à côté de la plaque",
    emoji: "🌙",
    color: "#7a5cc2",
    skill: { id: "vision", name: "VISION", description: "Révèle un indice sur la réponse" },
    voice: { pitch: 1.35, rate: 0.95 },
    onUse: [
      "Les esprits me disent... enfin ils chuchotent, c'est agaçant.",
      "Je vois... une lettre. Le brouillard garde le reste.",
      "L'aura de la réponse est... comment dire... alphabétique.",
    ],
    hostRetorts: [
      "Limpide, Lilune. Comme un puits. La nuit.",
      "Merci Lilune. Les esprits factureront plus tard.",
    ],
  },
  {
    id: "bargol",
    name: "BARGOL",
    title: "Nain râleur, expert autoproclamé",
    emoji: "⛏️",
    color: "#c2913e",
    skill: { id: "double-ou-rien", name: "DOUBLE OU RIEN", description: "×2 points si correct, sinon rien" },
    voice: { pitch: 0.75, rate: 1.15 },
    onUse: [
      "De mon temps, les questions c'était du solide !",
      "Double ou rien. Et que ça saute, je facture à l'heure.",
      "Je mise. Si ça rate, c'est la faute du minerai.",
    ],
    hostRetorts: [
      "Bargol parie. Les statistiques toussotent poliment.",
      "Voilà qui est courageux. Ou dwarf. Les deux.",
    ],
  },
  {
    id: "melissandre",
    name: "MÉLISSANDRE",
    title: "Magicienne bureaucrate",
    emoji: "📜",
    color: "#3e9ec2",
    // The game_script bans timers entirely, so the time-freeze became a
    // retroactive erasure: one wrong answer is annulled and replayed.
    skill: { id: "temps-gele", name: "TEMPS GELÉ", description: "Annule une mauvaise réponse : rejouez le coup" },
    voice: { pitch: 1.1, rate: 1.0 },
    onUse: [
      "Formulaire 12-B : annulation rétroactive d'erreur. Accordée.",
      "Le temps est gelé. Votre faute n'a jamais existé, administrativement.",
      "Rembobinage réglementaire, tamponné en trois exemplaires.",
    ],
    hostRetorts: [
      "Le temps s'arrête. Mon ennui, lui, continue.",
      "Merci Mélissandre. La paperasse a du bon, une fois l'an.",
    ],
  },
  {
    id: "fifrelin",
    name: "FIFRELIN",
    title: "Barde lâche et vantard",
    emoji: "🪕",
    color: "#c23ea0",
    skill: { id: "joker-chante", name: "JOKER CHANTÉ", description: "Passe la question, série conservée" },
    voice: { pitch: 1.25, rate: 1.05 },
    onUse: [
      "Je connaissais la réponse, mais l'art avant tout !",
      "Cette question ne mérite pas ma voix. Suivante !",
      "Une ballade pour l'esquive !... Plus tard, la ballade.",
    ],
    hostRetorts: [
      "Fifrelin fuit en chantant. Cohérent, au moins.",
      "L'art de l'esquive. Sa seule discipline olympique.",
    ],
  },
];

export const CAST_BY_ID: Record<CastId, CastMember> = Object.fromEntries(CAST.map((c) => [c.id, c])) as Record<
  CastId,
  CastMember
>;

export function castLine(id: CastId): string {
  const c = CAST_BY_ID[id];
  return c.onUse[Math.floor(Math.random() * c.onUse.length)] as string;
}

export function hostRetort(id: CastId): string {
  const c = CAST_BY_ID[id];
  return c.hostRetorts[Math.floor(Math.random() * c.hostRetorts.length)] as string;
}
