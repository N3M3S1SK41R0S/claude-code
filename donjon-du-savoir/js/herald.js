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
  "Place à {nom} ! Le Donjon retient son souffle. Enfin, ses courants d'air.",
  "{nom} s'avance ! Les dalles grincent d'impatience.",
  "Au tour de {nom} ! Que la chance soit vaguement de votre côté.",
];

const caseComment = {
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
  "Bonne réponse ! Quelque part, un parchemin verse une larme de joie.",
  "Bravo ! Votre cervelle mérite une statue. Petite, mais une statue.",
  "Correct ! Même les gargouilles sont impressionnées.",
];

const mauvaiseReponse = [
  "Raté ! Mais quel panache dans l'erreur.",
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

const pouvoirUtilise = [
  "Pouvoir activé ! La magie opère, réglementairement.",
  "Et hop ! Un pouvoir de moins, un moment de gloire de plus.",
];

export const herald = {
  ouverture: () => pick(ouverture),
  debutTour: (nom) => pick(debutTour).replace("{nom}", nom),
  surCase: (type) => pick(caseComment[type] ?? caseComment.question),
  bonne: () => pick(bonneReponse),
  mauvaise: () => pick(mauvaiseReponse),
  anecdote: () => pick(anecdoteIntro),
  victoire: (nom) => pick(victoire).replace("{nom}", nom),
  pouvoir: () => pick(pouvoirUtilise),
};
