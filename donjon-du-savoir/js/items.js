// Objets, dés spéciaux et inventaire (v2). Catalogue de données pur : les
// EFFETS sont appliqués par game.js, ici on décrit quoi existe, combien ça
// coûte, sur qui ça se joue, et les règles d'inventaire. Prix ajustables.
//
// Garde-fou familial : tout malus est PARABLE (bouclier) et RÉCUPÉRABLE ; aucun
// effet n'élimine ni ne bloque durablement un joueur.

export const INV_BASE = 3;
export const INV_BESASSE = 6;
export const BESASSE_COST = 40;

// Prix calés sur le panel de design (revenu ~14 or/tour ; l'objet le plus fort
// reste sous le prix d'une étoile de base à 20, sauf le tuyau d'or, quasi-étoile).
// cible : "soi" (sur son tour), "autre" (choisir une victime), "aucune" (dé).
// `art` : icône 3D peinte affichée à la place de l'emoji en boutique et dans la
// besace (repli sur l'emoji si l'image manque).
export const ITEMS = {
  // ---- dés spéciaux ----
  de_double: { id: "de_double", nom: "Dé Double", emoji: "🎲🎲", art: "assets/objet-de.png", type: "de", cible: "aucune", cout: 8, desc: "Lance 2 dés, avance de leur somme." },
  de_choisi: { id: "de_choisi", nom: "Dé Choisi", emoji: "🎯", art: "assets/objet-de.png", type: "de", cible: "aucune", cout: 12, desc: "Choisis la valeur 1 à 6 : vise ta case." },
  de_triple: { id: "de_triple", nom: "Dé Triple", emoji: "🎲🎲🎲", art: "assets/objet-de.png", type: "de", cible: "aucune", cout: 14, desc: "Lance 3 dés, avance de leur somme." },
  de_teleport: { id: "de_teleport", nom: "Dé Mirage", emoji: "🌫️", art: "assets/objet-cristal.png", type: "de", cible: "aucune", cout: 10, desc: "Téléporte sur une case au hasard." },
  de_echange: { id: "de_echange", nom: "Dé d'Échange", emoji: "🔄", art: "assets/objet-sablier.png", type: "de", cible: "autre", cout: 12, desc: "Échange ta place avec un adversaire au choix." },
  tuyau_or: { id: "tuyau_or", nom: "Tuyau d'Or", emoji: "🌀", art: "assets/objet-etoile.png", type: "de", cible: "aucune", cout: 18, desc: "Bond en avant vers l'Étoile / le Trésor." },

  // ---- jokers (sur soi) ----
  bouclier: { id: "bouclier", nom: "Bouclier", emoji: "🛡️", art: "assets/objet-bouclier.png", type: "joker", cible: "soi", cout: 10, desc: "Pare le prochain malus ou vol subi." },
  aimant_or: { id: "aimant_or", nom: "Aimant à Or", emoji: "🧲", art: "assets/objet-pieces.png", type: "joker", cible: "soi", cout: 9, desc: "Double l'or gagné pendant ce tour." },
  relance: { id: "relance", nom: "Fiole de Relance", emoji: "🔁", art: "assets/objet-potion.png", type: "joker", cible: "soi", cout: 6, desc: "Relance le dé une fois." },

  // ---- malus (sur autrui, parables — jamais cruels) ----
  sabotage: { id: "sabotage", nom: "Sabotage", emoji: "💣", art: "assets/objet-tonneau.png", type: "malus", cible: "autre", cout: 6, desc: "Recule un adversaire de 3 cases." },
  racket: { id: "racket", nom: "Racket", emoji: "🪙", art: "assets/objet-cle.png", type: "malus", cible: "autre", cout: 6, desc: "Vole 5 or à un adversaire." },
  sceptre_larcin: { id: "sceptre_larcin", nom: "Sceptre du Larcin", emoji: "👑", art: "assets/objet-parchemin.png", type: "malus", cible: "autre", cout: 35, desc: "Vole une étoile à un adversaire (mode Étoiles, très cher)." },
};

/** Objets proposés en boutique (ordre d'affichage). */
export const SHOP_ORDER = [
  "de_double", "de_choisi", "de_triple", "de_teleport", "de_echange", "tuyau_or",
  "bouclier", "aimant_or", "relance",
  "sabotage", "racket",
];

export function itemById(id) {
  return ITEMS[id] ?? null;
}

export function inventoryCap(pion) {
  return pion.besasse ? INV_BESASSE : INV_BASE;
}

export function inventoryCount(pion) {
  return (pion.objets ?? []).reduce((n, o) => n + o.qte, 0);
}

export function hasRoom(pion) {
  return inventoryCount(pion) < inventoryCap(pion);
}

/** Add one unit of an item to a pion's bag; returns false if full/unknown. */
export function addItem(pion, id) {
  if (!ITEMS[id] || !hasRoom(pion)) return false;
  pion.objets = pion.objets ?? [];
  const slot = pion.objets.find((o) => o.id === id);
  if (slot) slot.qte += 1;
  else pion.objets.push({ id, qte: 1 });
  return true;
}

/** Remove one unit; returns false if the pion doesn't have it. */
export function consumeItem(pion, id) {
  const slot = (pion.objets ?? []).find((o) => o.id === id);
  if (!slot || slot.qte <= 0) return false;
  slot.qte -= 1;
  if (slot.qte <= 0) pion.objets = pion.objets.filter((o) => o.id !== id);
  return true;
}

export function ownedItems(pion) {
  return (pion.objets ?? []).map((o) => ({ ...ITEMS[o.id], qte: o.qte })).filter((o) => o.id);
}
