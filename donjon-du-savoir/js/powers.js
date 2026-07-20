// The 6 characters' powers (adult + child variants), per §6 of the cahier.
// One use per game by default; recharged by a Joker card or 8 pièces.

export const RECHARGE_COST = 8;

export const POWERS = {
  cageot: {
    adulte: {
      nom: "Charge Téméraire",
      desc: "Transforme la question à choix en CASH : répondez sans les choix, gain maximal.",
      quand: "question",
    },
    enfant: {
      nom: "Bouclier Facile",
      desc: "Remplace la question par une plus facile.",
      quand: "question",
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
    },
  },
  boumbastien: {
    adulte: {
      nom: "Relance !",
      desc: "Relance le dé après avoir vu le résultat.",
      quand: "de",
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
    },
    enfant: {
      nom: "Indice Malin",
      desc: "Un indice supplémentaire sur la question.",
      quand: "question",
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
    },
  },
  hibou: {
    adulte: {
      nom: "Cinquante-Cinquante",
      desc: "Retire 2 mauvaises réponses d'un QCM.",
      quand: "question",
    },
    enfant: {
      nom: "Petit Curieux",
      desc: "Révèle la première lettre de la réponse.",
      quand: "question",
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
