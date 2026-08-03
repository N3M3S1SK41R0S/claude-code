// LE GRAND HÉRAUT DU DONJON — original mascot narrator (option B of §9).
// Register: pompous medieval herald, absurd and warm, never mean to kids.
// 100 % original character; no impersonation of any real person.

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

const ouverture = [
  "Oyez, oyez ! Le Donjon du Savoir ouvre ses portes. Essuyez vos pieds sur la culture.",
  "Bienvenue, nobles aventuriers ! Ici, on ne tue pas de dragons : on répond à des questions. C'est plus dangereux.",
  "Par ma trompette ! Que les cerveaux s'échauffent, le Donjon vous attend.",
];

const debutTour = [
  "{nom}, à vous l'honneur ! Le dé n'attend que votre poignet légendaire.",
  "{nom}, le Donjon vous observe. Il a d'excellents avis sur vous — il attend juste une confirmation.",
  "C'est à {nom}. Protocole royal : on respire, on lance, on triomphe. Le deuxième point est le plus sûr.",
  "{nom}, en piste ! L'Histoire retiendra ce tour. Enfin, si quelqu'un prend des notes.",
  "Place à {nom} ! Le Donjon retient son souffle. Enfin, ses courants d'air.",
  "{nom} s'avance ! Les dalles grincent d'impatience.",
  "Au tour de {nom} ! Que la chance soit vaguement de votre côté.",
];

const caseComment = {
  teleporteur: [
    "Un tourbillon ! Accrochez votre chapeau, le voyage est inclus dans le prix.",
    "Le tourbillon vous regarde avec appétit. C'est flatteur, d'une certaine façon.",
  ],
  carrefour: [
    "Un carrefour ! Deux chemins, zéro GPS. Le Donjon adore vous voir hésiter.",
    "Carrefour en vue. Petit conseil du Héraut : le chemin le plus court n'est jamais gratuit.",
  ],
  question: [
    "Une question ! Le Donjon teste votre esprit. Il est joueur, mais jamais pressé.",
    "Halte ! Nul ne passe sans faire travailler sa cervelle.",
  ],
  chance: [
    "Case Chance ! Le Donjon est de bonne humeur, profitez-en.",
    "Fortune sourit ! C'est rare, savourez.",
  ],
  evenement: [
    "Événement ! Tout le monde sur le pont, même ceux qui dormaient.",
    "Grand rassemblement ! Le Donjon convoque toutes les cervelles.",
  ],
  malus: [
    "Aïe. Le Donjon a ses humeurs, et là, c'est la mauvaise.",
    "Coup dur ! Courage, les légendes naissent dans la boue.",
  ],
  pieces: [
    "Des pièces d'or ! Le Gobelin Comptable en frémit quelque part.",
    "Sonnante et trébuchante fortune ! Ramassez, ramassez.",
  ],
  joker: [
    "Une carte Joker ! Gardez-la précieusement, elle vaut son pesant de malice.",
    "Le Donjon vous offre un Joker. Il attend un merci.",
  ],
  gambit: [
    "GAMBIT ! Un nombre, des paris, et beaucoup de mauvaise foi. J'adore.",
    "Place au Gambit ! Les spectateurs deviennent parieurs.",
  ],
  trounoir: [
    "LE TROU NOIR... Même moi, je baisse la voix. La question suprême vous attend.",
    "Frissons garantis : voici le Trou Noir. Nul chronomètre, mais quel vertige.",
  ],
  arrivee: [
    "LE TRÉSOR EST EN VUE !",
  ],
};

const bonneReponse = [
  "Exact ! Le Donjon applaudit des deux créneaux.",
  "Bonne réponse. Le Donjon applaudirait des deux mains s'il en avait.",
  "Exact. Je n'en attendais pas moins, et j'attendais beaucoup.",
  "C'est juste ! Le comité d'experts que je suis à moi tout seul valide.",
  "Bonne réponse ! Quelque part, un parchemin verse une larme de joie.",
  "Bravo ! Votre cervelle mérite une statue. Petite, mais une statue.",
  "Correct ! Même les gargouilles sont impressionnées.",
];

const mauvaiseReponse = [
  "Raté ! Mais quel panache dans l'erreur.",
  "Raté. Mais dit avec une conviction remarquable, c'est déjà ça.",
  "Non. Réponse incorrecte, aplomb impeccable : moyenne honorable.",
  "Perdu ! Le Donjon efface tout et ne retient que le panache.",
  "Hélas ! Le Donjon note l'audace, à défaut de la réponse.",
  "Non ! Mais rassurez-vous : ici, on apprend même en se trompant.",
  "Perdu ! Les plus grands héros ont commencé par se cogner aux murs.",
];

const anecdoteIntro = [
  "Et maintenant, la minute savante du Héraut :",
  "Approchez, voici la pépite du jour :",
  "Le saviez-vous ? Le Donjon, lui, le savait :",
];

const victoire = [
  "OYEZ, OYEZ ! {nom} atteint le Trésor du Savoir ! Que les trompettes sonnent faux en son honneur !",
  "Victoire de {nom} ! Le Donjon s'incline. Les autres aussi, mais de fatigue.",
];

// 🎬 « Documentaire animalier » du Trou Noir : le Héraut chuchote (humour).
const docTrouNoir = [
  "Chut… Observons l'aventurier s'approcher du Trou Noir. Il ne se doute de rien. Enfin si : il y a un panneau.",
  "Le Trou Noir, milieu hostile s'il en est. L'aventurier avance. La science reste sans voix ; moi, je chuchote.",
  "Notez la démarche assurée de l'espèce. C'est précisément ainsi que commencent les grandes anecdotes.",
];

// 🎲 Le dé, commenté avec la plus grande retenue.
const dePetit = [
  "Le dé a parlé. Le dé est parfois laconique.",
  "Un. C'est un début. Techniquement.",
  "Le dé vous offre un 1. Il précise que c'est pour votre humilité.",
];
const deTriple = [
  "Trois 6 d'affilée. Je ne dis rien. Je note.",
  "Encore un 6. Le dé et vous, on en reparlera.",
];

// 📜 « Une page de nos sponsors » : réclames absurdes du royaume (rarissimes).
const sponsors = [
  "La Taverne du Gobelin — certifiée sans dragon depuis mardi.",
  "Les Potions de la Fée Bricole : effets garantis, effets non précisés.",
  "Boucliers Groumf & Fils. Solides. Comme l'argument.",
  "L'Auberge du Trou Noir : personne n'est jamais revenu se plaindre.",
  "Parchemins Merlinouche — l'orthographe est comprise, l'ordre des mots en option.",
  "Les cours du soir de Maître Hibou : hou hou, mais avec mention.",
];

const pouvoirUtilise = [
  "Pouvoir activé ! La magie opère, réglementairement.",
  "Et hop ! Un pouvoir de moins, un moment de gloire de plus.",
];

// Le RÉCIT DES RÈGLES (bouton 🔊 de la page Règles) : les deux répliques fixes
// qui encadrent la lecture — même source pour le jeu ET l'inventaire des voix,
// afin que leur identifiant de clip ne dérive jamais.
export const RECIT_REGLES = {
  intro: "Oyez, oyez ! Le Grand Héraut vous raconte les règles du Donjon du Savoir.",
  outro: "Voilà pour les règles. Le reste s'apprend en jouant, et le Héraut veille. Bonne partie !",
};

// Viviers exportés pour l'outil d'inventaire des voix (tools/export-repliques).
export const HERALD_POOLS = {
  ouverture, debutTour, caseComment, bonneReponse, mauvaiseReponse,
  anecdoteIntro, victoire, docTrouNoir, dePetit, deTriple, sponsors,
  pouvoirUtilise,
  recitRegles: [RECIT_REGLES.intro, RECIT_REGLES.outro],
};

export const herald = {
  ouverture: () => pick(ouverture),
  debutTour: (nom) => pick(debutTour).replace("{nom}", nom),
  surCase: (type) => pick(caseComment[type] ?? caseComment.question),
  bonne: () => pick(bonneReponse),
  mauvaise: () => pick(mauvaiseReponse),
  anecdote: () => pick(anecdoteIntro),
  victoire: (nom) => pick(victoire).replace("{nom}", nom),
  pouvoir: () => pick(pouvoirUtilise),
  docTrouNoir: () => pick(docTrouNoir),
  dePetit: () => pick(dePetit),
  deTriple: () => pick(deTriple),
  sponsor: () => pick(sponsors),
};
