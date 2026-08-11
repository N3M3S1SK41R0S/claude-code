import type { ThemeId } from "./types";

/**
 * LE GRAND MOGUL — original French quiz host.
 * Register: deadpan absurdity, mock solemnity, dry punchlines, self-deprecation.
 * Hard rules: quips ≤ 15 words, one per question, fails celebrated as much as wins.
 */

export const MOGUL_NAME = "LE GRAND MOGUL";

const matchIntros = [
  "Bienvenue. Le règlement tient en un mot : moi.",
  "Des questions, zéro pitié, et beaucoup de dignité à perdre. Commençons.",
  "On m'appelle le Grand Mogul. Mes torts sont innombrables, mes questions aussi.",
  "Installez-vous. Le savoir n'attend pas, moi non plus, sauf le mardi.",
  "Ce plateau a vu des génies. Il s'en remettra ce soir aussi.",
];

const teasersByTheme: Record<ThemeId, string[]> = {
  histoire: [
    "Histoire. Les morts vous regardent, ne les décevez pas.",
    "Une question d'histoire. Le passé, ce truc qui vous juge.",
  ],
  geographie: [
    "Géographie. Perdez-vous, mais avec panache.",
    "Géographie. La boussole est interdite, la panique autorisée.",
  ],
  litterature: [
    "Littérature. Les livres, ces objets qu'on décore d'étagères.",
    "Littérature. Répondez, ou taisez-vous en alexandrins.",
  ],
  sciences: [
    "Sciences. La gravité de la situation est mesurable.",
    "Sciences et nature. Respirez. C'est déjà de la biologie.",
  ],
  arts: [
    "Arts. Plissez les yeux, ça fait connaisseur.",
    "Arts. Le beau vous attend. Il patientera.",
  ],
  cinema: [
    "Cinéma. Silence sur le plateau. Surtout en cas d'erreur.",
    "Cinéma. Moteur. Vous, en revanche, on verra.",
  ],
  musique: [
    "Musique. Une fausse note et je fronce un sourcil. Le gauche.",
    "Musique. Accordez-vous. La question, elle, est déjà accordée.",
  ],
  gastronomie: [
    "Gastronomie. Question à déguster. L'erreur se digère mal.",
    "Gastronomie. Ici, on ne joue pas avec la nourriture. On interroge.",
  ],
  sport: [
    "Sport. Échauffez le neurone. Oui, celui-là.",
    "Sport. L'important, c'est de participer. Paraît-il.",
  ],
  langue: [
    "Langue française. Un piège par syllabe, cadeau de la maison.",
    "Langue française. L'accent circonflexe vous observe.",
  ],
  "pop-culture": [
    "Pop culture. Enfin une matière que personne n'a révisée. Officiellement.",
    "Pop culture. Votre écran vous a préparé toute votre vie pour ça.",
  ],
  insolite: [
    "Insolite. Plus c'est absurde, plus c'est vrai. Généralement.",
    "Insolite. Je décline toute responsabilité sur ce qui suit.",
  ],
  general: [
    "Culture générale. Le mot « générale » est un piège, évidemment.",
    "Question générale. Comme l'anesthésie, ça peut endormir.",
  ],
};

const genericTeasers = [
  "Question suivante. Le suspense me coiffe.",
  "Attention. Ceci est une question. Tout se complique.",
];

const quipsCorrect = [
  "Correct. Je note un progrès. C'est louche.",
  "Bonne réponse. N'en tirez aucune gloire durable.",
  "Exact. Quelque part, une encyclopédie sourit.",
  "Correct. Même mon monocle est surpris.",
  "Bien. Je retire un dixième de ce que je pensais de vous.",
];

const quipsWrong = [
  "Faux. Magnifiquement faux. Bravo pour l'engagement.",
  "Raté. Mais avec une conviction qui force le respect.",
  "Non. La réponse a pris peur et s'est enfuie.",
  "Faux. C'est un art aussi, ne laissez personne dire le contraire.",
  "Erreur splendide. Je l'encadrerais volontiers.",
];

const quipsTimeout = [
  "Temps écoulé. Comme mes espoirs, mais on s'habitue.",
  "Le chrono a gagné. Lui au moins, il est régulier.",
  "Trop tard. Le silence était une réponse. Fausse.",
];

const resultsLines = {
  high: [
    "Un score respectable. Je vais devoir revoir mes questions. Ou mes standards.",
    "Impressionnant. Le trône du savoir reste à moi. De peu. N'en parlons plus.",
  ],
  mid: [
    "Honorable. Ni gloire ni naufrage : la moyenne, ce doux pays.",
    "Un score médian. L'audace du milieu. Respect mesuré.",
  ],
  low: [
    "Ce score est un choix artistique, je le respecte infiniment.",
    "Défaite somptueuse. Les plus grands ont commencé plus bas. Peu, mais bon.",
  ],
};

const anecdoteLeadIns = [
  "L'anecdote, offerte par la maison :",
  "Un instant. La minute culturelle du Mogul :",
  "Retenez ceci pour briller en société :",
];

const passDevice = [
  "Passez l'appareil. Délicatement, c'est mon plateau.",
  "Au suivant. L'appareil, pas les excuses.",
];

function pick<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)] as T;
}

export const host = {
  intro: () => pick(matchIntros),
  teaser: (theme: ThemeId) => pick([...(teasersByTheme[theme] ?? []), ...genericTeasers]),
  quipCorrect: () => pick(quipsCorrect),
  quipWrong: () => pick(quipsWrong),
  quipTimeout: () => pick(quipsTimeout),
  anecdoteLeadIn: () => pick(anecdoteLeadIns),
  passDevice: () => pick(passDevice),
  resultsLine: (ratio: number) => (ratio >= 0.7 ? pick(resultsLines.high) : ratio >= 0.4 ? pick(resultsLines.mid) : pick(resultsLines.low)),
};
