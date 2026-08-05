// CONSTELLATIONS — les figures du ciel, tracées d'après les COORDONNÉES RÉELLES
// des étoiles (ascension droite en heures, déclinaison en degrés). Comme pour
// les cartes de pays, on ne dessine pas « à peu près » : on part des vraies
// positions, et la planche de contrôle (tools/planche-ciel.mjs) vérifie que la
// Grande Ourse ressemble bien à une casserole.
//
// Ces données sont des faits astronomiques, pas une œuvre : rien à créditer.

/**
 * Étoiles d'une constellation : [nom, ascension droite (heures), déclinaison
 * (degrés), magnitude]. La magnitude sert au DIAMÈTRE du point — une figure
 * où toutes les étoiles ont la même taille ne ressemble à rien de ce qu'on
 * voit dans le ciel.
 */
const FIGURES = {
  "grande-ourse": {
    etoiles: [
      ["Dubhe", 11.062, 61.75, 1.79], ["Merak", 11.031, 56.38, 2.37],
      ["Phecda", 11.897, 53.69, 2.44], ["Megrez", 12.257, 57.03, 3.31],
      ["Alioth", 12.900, 55.96, 1.77], ["Mizar", 13.399, 54.93, 2.23],
      ["Alkaid", 13.792, 49.31, 1.86],
    ],
    // Le godet (4 étoiles) puis le manche (3) : c'est ce trait continu qui fait
    // la casserole, l'astérisme le plus reconnu de l'hémisphère nord.
    traits: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  orion: {
    etoiles: [
      ["Bételgeuse", 5.919, 7.41, 0.50], ["Bellatrix", 5.418, 6.35, 1.64],
      ["Mintaka", 5.533, -0.30, 2.23], ["Alnilam", 5.604, -1.20, 1.69],
      ["Alnitak", 5.679, -1.94, 1.77], ["Saïph", 5.796, -9.67, 2.06],
      ["Rigel", 5.242, -8.20, 0.13],
    ],
    // Épaules, ceinture de trois étoiles alignées, et pieds : le sablier.
    traits: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [2, 6], [4, 5], [6, 5]],
  },
  cassiopee: {
    etoiles: [
      ["Caph", 0.153, 59.15, 2.27], ["Schedar", 0.675, 56.54, 2.24],
      ["Gamma Cas", 0.945, 60.72, 2.15], ["Ruchbah", 1.430, 60.24, 2.68],
      ["Segin", 1.906, 63.67, 3.35],
    ],
    traits: [[0, 1], [1, 2], [2, 3], [3, 4]], // le W (ou le M, selon la saison)
  },
  "croix-du-sud": {
    etoiles: [
      ["Acrux", 12.443, -63.10, 0.77], ["Gacrux", 12.519, -57.11, 1.63],
      ["Mimosa", 12.795, -59.69, 1.25], ["Delta Crucis", 12.253, -58.75, 2.79],
    ],
    traits: [[0, 1], [2, 3]], // deux barres croisées, la boussole du sud
  },
  cygne: {
    etoiles: [
      ["Deneb", 20.690, 45.28, 1.25], ["Sadr", 20.371, 40.26, 2.23],
      ["Albiréo", 19.512, 27.96, 3.18], ["Gienah", 20.770, 33.97, 2.46],
      ["Delta Cygni", 19.750, 45.13, 2.87],
    ],
    traits: [[0, 1], [1, 2], [3, 1], [1, 4]], // la Croix du Nord
  },
  lyre: {
    etoiles: [
      ["Véga", 18.615, 38.78, 0.03], ["Zeta Lyrae", 18.746, 37.60, 4.36],
      ["Delta Lyrae", 18.909, 36.90, 4.30], ["Sulafat", 18.982, 32.69, 3.25],
      ["Sheliak", 18.835, 33.36, 3.52],
    ],
    traits: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]], // petit parallélogramme
  },
  scorpion: {
    etoiles: [
      ["Dschubba", 16.005, -22.62, 2.29], ["Graffias", 16.091, -19.81, 2.56],
      ["Pi Scorpii", 15.981, -26.11, 2.89], ["Antarès", 16.490, -26.43, 1.06],
      ["Tau Scorpii", 16.598, -28.22, 2.82], ["Epsilon Sco", 16.836, -34.29, 2.29],
      ["Mu Scorpii", 16.865, -38.05, 3.00], ["Zeta Scorpii", 16.910, -42.36, 3.62],
      ["Eta Scorpii", 17.203, -43.24, 3.32], ["Theta Sco", 17.622, -42.99, 1.86],
      ["Shaula", 17.560, -37.10, 1.62],
    ],
    // Les pinces, le corps, puis la queue qui s'enroule jusqu'au dard.
    traits: [[1, 0], [0, 2], [0, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]],
  },
  lion: {
    etoiles: [
      ["Régulus", 10.140, 11.97, 1.36], ["Eta Leonis", 10.278, 16.76, 3.49],
      ["Algieba", 10.333, 19.84, 2.08], ["Zeta Leonis", 10.278, 23.42, 3.43],
      ["Mu Leonis", 9.880, 26.01, 3.88], ["Epsilon Leo", 9.765, 23.77, 2.98],
      ["Zosma", 11.235, 20.52, 2.56], ["Chertan", 11.237, 15.43, 3.33],
      ["Denebola", 11.818, 14.57, 2.14],
    ],
    // La faucille (le point d'interrogation à l'envers) et le triangle arrière.
    traits: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 7], [7, 6], [6, 8], [8, 7], [2, 6]],
  },
};

/**
 * Projette une figure dans une viewBox 0 0 100 100.
 * L'ascension droite se compte vers l'EST, donc vers la GAUCHE quand on
 * regarde le ciel : on inverse x, sans quoi toutes les figures sortent en
 * miroir. Et on resserre l'axe horizontal par cos(déclinaison moyenne) : sans
 * cette correction, la Grande Ourse (vers 55° nord) s'étire de 74 % et n'a
 * plus rien d'une casserole.
 */
function projette({ etoiles, traits }) {
  const decMoy = etoiles.reduce((s, e) => s + e[2], 0) / etoiles.length;
  const k = Math.cos((decMoy * Math.PI) / 180);
  const bruts = etoiles.map(([nom, ad, dec, mag]) => ({ nom, mag, x: -ad * 15 * k, y: -dec }));
  const xs = bruts.map((p) => p.x), ys = bruts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const etendue = Math.max(x1 - x0, y1 - y0) || 1;
  const e = 78 / etendue; // marge généreuse : les points débordent du tracé
  const decX = (100 - (x1 - x0) * e) / 2, decY = (100 - (y1 - y0) * e) / 2;
  const pts = bruts.map((p) => ({
    ...p,
    px: (p.x - x0) * e + decX,
    py: (p.y - y0) * e + decY,
    // Une étoile de magnitude 0 est ~2,5 fois plus brillante qu'une de
    // magnitude 1 : le rayon suit cette hiérarchie, borné pour rester lisible.
    r: Math.max(1.1, 3.4 - p.mag * 0.55),
  }));
  return { pts, traits };
}

/** SVG d'une constellation : traits discrets, étoiles à leur vraie brillance. */
export function cielSvg(cle) {
  const figure = FIGURES[cle];
  if (!figure) return null;
  const { pts, traits } = projette(figure);
  const lignes = traits.map(([a, b]) =>
    `<line x1="${pts[a].px.toFixed(1)}" y1="${pts[a].py.toFixed(1)}" x2="${pts[b].px.toFixed(1)}" y2="${pts[b].py.toFixed(1)}" stroke="currentColor" stroke-width="0.7" opacity="0.5"/>`).join("");
  const etoiles = pts.map((p) =>
    `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="${p.r.toFixed(2)}" fill="currentColor"/>`).join("");
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" class="visuel-svg">${lignes}${etoiles}</svg>`;
}

/** Inventaire, pour les outils de contrôle et l'audit des questions. */
export const CIELS = Object.keys(FIGURES);
