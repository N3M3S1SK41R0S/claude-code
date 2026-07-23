// Voix et répliques par personnage. Les répliques s'affichent en petite bulle
// (avec le portrait) et, si le « Héraut vocal » est activé, sont dites par la
// synthèse vocale du navigateur avec un profil de voix propre au personnage
// (hauteur/débit) — aucune imitation d'une vraie personne, juste des timbres
// contrastés. Tout est original (aucun contenu de marque).

// Profil de voix : pitch (0.5-2), rate (0.6-1.4), v = index de voix fr à préférer.
export const VOICE = {
  // héros
  cageot: { pitch: 0.9, rate: 1.0, v: 0 },
  etincelle: { pitch: 1.5, rate: 1.1, v: 1 },
  gobelin: { pitch: 1.2, rate: 1.2, v: 0 },
  nebulia: { pitch: 0.85, rate: 0.82, v: 1 },
  boumbastien: { pitch: 1.25, rate: 1.28, v: 0 },
  duchesse: { pitch: 1.15, rate: 0.9, v: 1 },
  flaque: { pitch: 0.8, rate: 1.0, v: 0 },
  pelote: { pitch: 1.1, rate: 0.82, v: 1 },
  hibou: { pitch: 0.95, rate: 0.9, v: 0 },
  kribouille: { pitch: 1.7, rate: 1.2, v: 1 },
  plomberoy: { pitch: 0.9, rate: 1.05, v: 0 },
  // PNJ (par slug)
  merlinouche: { pitch: 0.8, rate: 0.95, v: 0 },
  biscornu: { pitch: 1.4, rate: 1.1, v: 1 },
  "hibou-passage": { pitch: 0.95, rate: 0.88, v: 0 },
  barnabe: { pitch: 1.2, rate: 1.2, v: 0 },
  roquefort: { pitch: 1.5, rate: 1.25, v: 1 },
  "fee-bricole": { pitch: 1.55, rate: 1.15, v: 1 },
  boubou: { pitch: 1.3, rate: 0.9, v: 1 },
  gerard: { pitch: 0.85, rate: 0.95, v: 0 },
  turbo: { pitch: 1.0, rate: 0.75, v: 0 },
  groumf: { pitch: 0.7, rate: 0.85, v: 0 },
  ratichon: { pitch: 1.25, rate: 1.2, v: 0 },
  sylvette: { pitch: 1.5, rate: 0.95, v: 1 },
  coassin: { pitch: 1.15, rate: 1.05, v: 0 },
  piquot: { pitch: 1.3, rate: 1.3, v: 1 },
  zebulon: { pitch: 1.05, rate: 1.0, v: 0 },
};

// Répliques des héros par moment : tour (à soi de jouer), bonne / mauvaise
// réponse, pouvoir (usage), victoire. Courtes, drôles, dans le caractère.
export const HERO_LINES = {
  cageot: {
    tour: ["En avant, pour le carton et la gloire !", "Mon casque-casserole est bien vissé, j'y vais !", "Un chevalier en carton n'a peur de rien… ou presque."],
    bonne: ["Solide comme du carton triple épaisseur !", "Ha ! Même pas plié !"],
    mauvaise: ["Aïe, mon plastron a pris l'humidité…", "Bon. On va dire que c'était un galop d'essai."],
    pouvoir: ["Pouvoir du Grand Cageot, déploie-toi !", "Place au carton renforcé !"],
    victoire: ["Le carton triomphe de tout ! Youpi !", "Champion, en armure recyclée s'il vous plaît !"],
  },
  etincelle: {
    tour: ["Abracada-me voilà ! À moi de jouer !", "Ça pétille là-dedans, j'y vais !", "Une pincée d'étoiles et c'est parti !"],
    bonne: ["Étincelant ! Pouf, paillettes !", "Magie de la mémoire : réussie !"],
    mauvaise: ["Oups, ma potion a fait pschitt…", "Ce n'était pas la bonne formule, tant pis !"],
    pouvoir: ["Que la magie opère !", "Un p'tit sort et hop !"],
    victoire: ["Feu d'artifice de joie ! J'ai gagné !", "La magie a parlé, et elle a bon goût !"],
  },
  gobelin: {
    tour: ["Comptons, comptons… à moi de jouer !", "Chaque pièce compte, et chaque question aussi !", "Un bon calcul et le trésor est à moi."],
    bonne: ["Exact au centime près !", "Bénéfice net : une bonne réponse !"],
    mauvaise: ["Erreur dans mes comptes… ça arrive.", "Petit déficit, je me referai."],
    pouvoir: ["Bonus comptable, activé !", "Les intérêts, ça se cultive !"],
    victoire: ["Trésor sécurisé, comptes équilibrés : j'ai gagné !", "Riche en or ET en savoir !"],
  },
  nebulia: {
    tour: ["Les étoiles m'appellent… à moi de jouer.", "Je lis l'avenir dans la poussière d'étoiles…", "L'univers murmure la réponse, écoutons."],
    bonne: ["Écrit dans les astres, forcément juste.", "Les constellations approuvent."],
    mauvaise: ["Une éclipse a brouillé ma vision…", "Le cosmos est parfois taquin."],
    pouvoir: ["Que la voûte céleste m'assiste !", "Poussière d'étoiles, fais ton œuvre !"],
    victoire: ["Les étoiles s'alignent : victoire cosmique !", "Je brille plus fort que la Voie lactée !"],
  },
  boumbastien: {
    tour: ["BOUM ! Enfin, doucement… à moi de jouer !", "J'ai bricolé un plan génial, regardez !", "Attention, ça va faire des étincelles !"],
    bonne: ["EURÊKA ! Ça marche !", "Explosion de génie contrôlée !"],
    mauvaise: ["Bon, ça a fait pschitt au lieu de boum.", "Petit court-circuit, je répare !"],
    pouvoir: ["Invention numéro 42, en marche !", "Trois, deux, un… ça part !"],
    victoire: ["BOUM final : j'ai tout fait sauter, sauf ma victoire !", "Mon plus beau feu d'artifice, c'est ce triomphe !"],
  },
  duchesse: {
    tour: ["À moi, je vous prie. Noblesse oblige.", "Un peu d'érudition, mes chers.", "Observez la classe en action."],
    bonne: ["Élémentaire, voyons.", "Comme il se doit, très chère."],
    mauvaise: ["Une broutille sans importance.", "Même la noblesse a ses petits jours."],
    pouvoir: ["Permettez que je m'illustre.", "Avec distinction, naturellement."],
    victoire: ["La victoire sied à mon rang. Merci, merci.", "Couronnée de savoir, quelle élégance !"],
  },
  flaque: {
    tour: ["Moussaillons, à l'abordage des questions !", "Hissez la grand-voile, à moi de jouer !", "Par mes bottes trempées, c'est mon tour !"],
    bonne: ["Trésor trouvé, matelot !", "En plein dans le mille, tonnerre !"],
    mauvaise: ["Sacré grain de sable dans la boussole…", "Homme à la mer ! Enfin, réponse à la mer."],
    pouvoir: ["Vent en poupe, pouvoir déployé !", "Par le pouvoir des sept flaques !"],
    victoire: ["Le trésor est à moi, moussaillons ! Yo-ho !", "Capitaine du savoir, ça se fête au grog… de sirop !"],
  },
  pelote: {
    tour: ["À mon tour, mes petits chats.", "Laissez faire mamie, tricot-tricot !", "Une maille à l'endroit, une bonne réponse à l'envers !"],
    bonne: ["Voilà, tout doux, c'était juste !", "Mamie sait des choses, figurez-vous."],
    mauvaise: ["Oh, une maille filée… ce n'est rien.", "J'ai dû laisser mes lunettes au salon."],
    pouvoir: ["Un petit coup de laine magique !", "Tricotons-nous un joli coup."],
    victoire: ["Mamie gagne, venez tous faire un câlin !", "Et une écharpe de champion, tricotée maison !"],
  },
  hibou: {
    tour: ["Hou hou… à moi de réfléchir.", "Ouvrons le grand livre du savoir.", "Chut, laissez le sage travailler."],
    bonne: ["Page 42, comme je le pensais.", "Le savoir a toujours raison."],
    mauvaise: ["Hmm, une note en bas de page m'a échappé.", "Même les hiboux clignent parfois des yeux."],
    pouvoir: ["Sagesse ancestrale, à l'œuvre.", "Le grimoire s'ouvre pour moi."],
    victoire: ["Le savoir couronne le patient. Hou hou !", "Bibliothèque une, hasard zéro !"],
  },
  kribouille: {
    tour: ["Kribi-kribi ! À moi, à moi !", "Youpiii, c'est mon tour de jouer !", "Guili-question, j'adore !"],
    bonne: ["Kribi ouiii ! Trop facile !", "Hihi, j'ai trouvé, j'ai trouvé !"],
    mauvaise: ["Ououh… pas grave, pas grave !", "Oups-a-daisy ! On recommence !"],
    pouvoir: ["Galipette magique, hop hop !", "Kribouille-pouvoir, activé !"],
    victoire: ["KRIBIII ! J'ai gagné, câlin d'étoiles !", "Youpi youpi, sautons de joie !"],
  },
  plomberoy: {
    tour: ["Clé à molette en main, c'est parti !", "On répare la question et on avance !", "Y'a du boulot ? J'adore, à moi de jouer !"],
    bonne: ["Et voilà, réparé du premier coup !", "Ça, c'est du travail bien serré !"],
    mauvaise: ["Petite fuite… je colmate au prochain tour.", "Bon, faut resserrer le boulon."],
    pouvoir: ["Super Bond, c'est parti !", "Un coup de clé et hop, magie de plombier !"],
    victoire: ["Chantier terminé, victoire livrée !", "Champion toutes catégories, et sans fuite !"],
  },
};

/** Une réplique au hasard pour un héros à un moment donné (ou null). */
export function heroLine(characterId, moment) {
  const set = HERO_LINES[characterId]?.[moment];
  if (!set || set.length === 0) return null;
  return set[Math.floor(Math.random() * set.length)];
}

/** Profil de voix d'un personnage (héros ou PNJ). Valeur par défaut douce. */
export function voiceOf(id) {
  return VOICE[id] ?? { pitch: 1.05, rate: 0.95, v: 0 };
}
