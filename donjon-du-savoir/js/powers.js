// The 6 characters' powers (adult + child variants), per §6 of the cahier.
// One use per game by default; recharged by a Joker card or 8 pièces.

export const RECHARGE_COST = 8;

export const POWERS = {
  cageot: {
    adulte: {
      nom: "Charge Téméraire",
      desc: "Transforme la question à choix en CASH : répondez sans les choix, gain maximal.",
      quand: "question",
      moment: "pendant une question à choix (QCM ou Carré) — le bouton apparaît sous l'énoncé",
    },
    enfant: {
      nom: "Bouclier Facile",
      desc: "Remplace la question par une plus facile.",
      quand: "question",
      moment: "pendant une question — le bouton apparaît sous l'énoncé",
    },
  },
  etincelle: {
    adulte: {
      nom: "Chapardage",
      desc: "Vole une carte Joker à un adversaire.",
      quand: "tour",
    },
    enfant: {
      nom: "Deuxième Chance",
      desc: "Relance le dé une fois.",
      quand: "de",
      moment: "juste après votre lancer — le bouton de relance apparaît à côté du résultat",
    },
  },
  gobelin: {
    adulte: {
      nom: "Bonus Comptable",
      desc: "Double les pièces gagnées pendant ce tour.",
      quand: "tour",
    },
    enfant: {
      nom: "Petit Trésor",
      desc: "Pioche 2 cartes Chance et garde la meilleure.",
      quand: "tour",
    },
  },
  nebulia: {
    adulte: {
      nom: "Échange Cosmique",
      desc: "Échange sa position avec un adversaire.",
      quand: "tour",
    },
    enfant: {
      nom: "Bulle Protectrice",
      desc: "Annule un Coup dur.",
      quand: "malus",
      moment: "proposé automatiquement quand un Coup dur vous frappe",
    },
  },
  boumbastien: {
    adulte: {
      nom: "Relance !",
      desc: "Relance le dé après avoir vu le résultat.",
      quand: "de",
      moment: "juste après votre lancer — le bouton de relance apparaît à côté du résultat",
    },
    enfant: {
      nom: "Turbo Case",
      desc: "Avance automatiquement de 2 cases.",
      quand: "tour",
    },
  },
  duchesse: {
    adulte: {
      nom: "Indice Royal",
      desc: "Révèle l'anecdote avant de répondre.",
      quand: "question",
      moment: "pendant une question — le bouton apparaît sous l'énoncé",
    },
    enfant: {
      nom: "Indice Malin",
      desc: "Un indice supplémentaire sur la question.",
      quand: "question",
      moment: "pendant une question — le bouton apparaît sous l'énoncé",
    },
  },
  flaque: {
    adulte: {
      nom: "Abordage",
      desc: "Pille jusqu'à 3 pièces au joueur le plus riche.",
      quand: "tour",
    },
    enfant: {
      nom: "Vent en Poupe",
      desc: "Relance le dé une fois.",
      quand: "de",
      moment: "juste après votre lancer — le bouton de relance apparaît à côté du résultat",
    },
  },
  pelote: {
    adulte: {
      nom: "Maille Solide",
      desc: "Se tricote un bouclier qui parera le prochain coup dur ou larcin.",
      quand: "tour",
    },
    enfant: {
      nom: "Doudou Réconfort",
      desc: "Annule un Coup dur.",
      quand: "malus",
      moment: "proposé automatiquement quand un Coup dur vous frappe",
    },
  },
  hibou: {
    adulte: {
      nom: "Cinquante-Cinquante",
      desc: "Retire 2 mauvaises réponses d'un QCM.",
      quand: "question",
      moment: "pendant un QCM — le bouton apparaît sous l'énoncé",
    },
    enfant: {
      nom: "Petit Curieux",
      desc: "Révèle la première lettre de la réponse.",
      quand: "question",
      moment: "pendant une question — le bouton apparaît sous l'énoncé",
    },
  },
  kribouille: {
    adulte: {
      nom: "Aspiration farceuse",
      desc: "Chipe 2 pièces à un adversaire au choix.",
      quand: "tour",
    },
    enfant: {
      nom: "Galipette",
      desc: "Relance le dé une fois.",
      quand: "de",
      moment: "juste après votre lancer — le bouton de relance apparaît à côté du résultat",
    },
  },
  plomberoy: {
    adulte: {
      nom: "Super Bond",
      desc: "Avance d'un grand bond de 3 cases.",
      quand: "tour",
    },
    enfant: {
      nom: "Coup de Clé",
      desc: "Répare tout : annule un Coup dur.",
      quand: "malus",
      moment: "proposé automatiquement quand un Coup dur vous frappe",
    },
  },
};

export function powerOf(pion) {
  const set = POWERS[pion.characterId];
  if (!set) return null;
  return set[pion.profil] ?? set.adulte;
}

/** A power can be recharged with a Joker card (free) or 8 pièces. */
export function canRecharge(pion) {
  return pion.pouvoirUtilise && (pion.jokers > 0 || pion.pieces >= RECHARGE_COST);
}

export function recharge(pion) {
  if (!pion.pouvoirUtilise) return false;
  if (pion.jokers > 0) {
    pion.jokers -= 1;
  } else if (pion.pieces >= RECHARGE_COST) {
    pion.pieces -= RECHARGE_COST;
  } else {
    return false;
  }
  pion.pouvoirUtilise = false;
  return true;
}
