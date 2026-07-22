// Original hand-drawn SVG medallions for the eleven companions — flat cartoon
// style, no external assets (fills the §12 "illustrations" gap until real
// artwork lands; the §6 prompts remain available for a generator pass).

const FACE = "#f2c9a0";

function medallion(bg, inner) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs><radialGradient id="m" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="${bg}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0.15"/>
    </radialGradient></defs>
    <circle cx="50" cy="50" r="48" fill="url(#m)" stroke="${bg}" stroke-width="3"/>
    ${inner}
  </svg>`;
}

const eyes = (dx = 0, dy = 0) => `
  <circle cx="${41 + dx}" cy="${52 + dy}" r="3.2" fill="#221a10"/>
  <circle cx="${59 + dx}" cy="${52 + dy}" r="3.2" fill="#221a10"/>`;

const smile = (dy = 0) => `<path d="M 42 ${63 + dy} Q 50 ${69 + dy} 58 ${63 + dy}" fill="none" stroke="#221a10" stroke-width="2.4" stroke-linecap="round"/>`;

export const PORTRAITS = {
  // Chevalier en carton : casserole sur la tête, plastron en carton scotché.
  cageot: medallion("#c2703e", `
    <rect x="30" y="66" width="40" height="26" rx="6" fill="#b98a54" stroke="#8a6234" stroke-width="2"/>
    <path d="M 36 74 l 28 8 M 36 82 l 28 -8" stroke="#e8d6b8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="50" cy="52" r="18" fill="${FACE}"/>
    ${eyes()} ${smile()}
    <path d="M 29 40 a 21 12 0 0 1 42 0 Z" fill="#9aa2ad" stroke="#6d747e" stroke-width="2"/>
    <rect x="44" y="24" width="12" height="7" rx="3.5" fill="#6d747e"/>
    <path d="M 68 42 h 12" stroke="#6d747e" stroke-width="4" stroke-linecap="round"/>
  `),
  // Magicienne pétillante : chapeau violet, étincelles dorées.
  etincelle: medallion("#8e5cc2", `
    <circle cx="50" cy="55" r="17" fill="${FACE}"/>
    ${eyes(0, 1)} ${smile(2)}
    <path d="M 30 45 Q 50 14 70 45 Q 50 38 30 45 Z" fill="#8e5cc2" stroke="#6a3fa0" stroke-width="2"/>
    <path d="M 26 45 h 48" stroke="#6a3fa0" stroke-width="4" stroke-linecap="round"/>
    <path d="M 76 30 l 2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill="#e0b04a"/>
    <path d="M 22 62 l 1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z" fill="#e0b04a"/>
    <path d="M 74 66 l 1.4 3.2 3.2 1.4 -3.2 1.4 -1.4 3.2 -1.4 -3.2 -3.2 -1.4 3.2 -1.4 Z" fill="#f0d080"/>
  `),
  // Gobelin comptable : peau verte, lunettes rondes, pièce d'or.
  gobelin: medallion("#3ec27a", `
    <path d="M 27 47 l -9 -8 7 12 Z" fill="#69c98a"/>
    <path d="M 73 47 l 9 -8 -7 12 Z" fill="#69c98a"/>
    <circle cx="50" cy="54" r="19" fill="#7dd39a"/>
    <circle cx="41" cy="52" r="6.5" fill="#fff" stroke="#221a10" stroke-width="2.2"/>
    <circle cx="59" cy="52" r="6.5" fill="#fff" stroke="#221a10" stroke-width="2.2"/>
    <path d="M 47.5 52 h 5" stroke="#221a10" stroke-width="2.2"/>
    <circle cx="41" cy="52" r="2.2" fill="#221a10"/>
    <circle cx="59" cy="52" r="2.2" fill="#221a10"/>
    <path d="M 43 65 Q 50 70 57 65" fill="none" stroke="#221a10" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="72" cy="76" r="10" fill="#e0b04a" stroke="#a87c1f" stroke-width="2"/>
    <text x="72" y="80" font-size="11" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" fill="#7a5a12">1</text>
  `),
  // Sorcière cosmique : capuche bleu nuit, étoiles, petite spirale galactique.
  nebulia: medallion("#3e6ec2", `
    <path d="M 28 78 Q 28 34 50 30 Q 72 34 72 78 Z" fill="#2b2d66" stroke="#1d1f4a" stroke-width="2"/>
    <circle cx="50" cy="56" r="14" fill="#e8d8f0"/>
    ${eyes(0, 0)} <path d="M 44 64 Q 50 68 56 64" fill="none" stroke="#221a10" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="34" cy="42" r="1.6" fill="#f0e6a0"/>
    <circle cx="66" cy="40" r="1.6" fill="#f0e6a0"/>
    <circle cx="62" cy="74" r="1.4" fill="#f0e6a0"/>
    <circle cx="37" cy="72" r="1.4" fill="#f0e6a0"/>
    <path d="M 68 24 a 6 6 0 1 1 -6 6 a 4.5 4.5 0 1 0 4.5 -4.5" fill="none" stroke="#9ab0f0" stroke-width="2" stroke-linecap="round"/>
  `),
  // Inventeur farfelu : cheveux en pétard roussis, lunettes d'atelier.
  boumbastien: medallion("#c2b23e", `
    <g stroke="#b06428" stroke-width="4" stroke-linecap="round">
      <path d="M 36 34 l -6 -10"/><path d="M 44 30 l -2 -12"/>
      <path d="M 54 29 l 3 -11"/><path d="M 63 33 l 7 -9"/>
    </g>
    <circle cx="50" cy="54" r="18" fill="${FACE}"/>
    <path d="M 30 42 a 20 14 0 0 1 40 0 Z" fill="#a0522d"/>
    <circle cx="41" cy="51" r="6" fill="#cfe8f0" stroke="#5a4a3a" stroke-width="2.4"/>
    <circle cx="59" cy="51" r="6" fill="#cfe8f0" stroke="#5a4a3a" stroke-width="2.4"/>
    <path d="M 47 51 h 6" stroke="#5a4a3a" stroke-width="2.4"/>
    ${smile(1)}
    <circle cx="73" cy="73" r="4" fill="#9aa2ad"/><path d="M 73 66 v -5" stroke="#9aa2ad" stroke-width="2"/>
    <circle cx="73" cy="59" r="2" fill="#e05a3c"/>
  `),
  // Duchesse érudite : chignon, diadème, face-à-main devant l'œil.
  duchesse: medallion("#c23e6b", `
    <circle cx="50" cy="34" r="10" fill="#d8d0e8"/>
    <circle cx="50" cy="55" r="17" fill="${FACE}"/>
    <path d="M 33 46 a 18 12 0 0 1 34 0" fill="#d8d0e8"/>
    <path d="M 42 30 l 3 -7 5 6 5 -6 3 7" fill="none" stroke="#e0b04a" stroke-width="2.6" stroke-linejoin="round"/>
    <circle cx="41" cy="53" r="3" fill="#221a10"/>
    <circle cx="59" cy="53" r="6.5" fill="none" stroke="#a87c1f" stroke-width="2.4"/>
    <circle cx="59" cy="53" r="2.6" fill="#221a10"/>
    <path d="M 64 58 l 8 12" stroke="#a87c1f" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M 43 65 Q 50 69 57 65" fill="none" stroke="#221a10" stroke-width="2.2" stroke-linecap="round"/>
  `),
  // Corsaire des flaques : bandana rouge, cache-œil, grand sourire, éclaboussure.
  flaque: medallion("#2f9e8f", `
    <circle cx="50" cy="55" r="18" fill="${FACE}"/>
    <path d="M 31 47 Q 50 29 69 47 Z" fill="#c0392b" stroke="#8e2b20" stroke-width="2"/>
    <path d="M 31 47 h 38" stroke="#8e2b20" stroke-width="2.4"/>
    <path d="M 67 44 l 11 -3 -4 9 Z" fill="#c0392b" stroke="#8e2b20" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="59" cy="55" r="3.2" fill="#221a10"/>
    <rect x="35" y="50" width="12" height="10" rx="2" fill="#221a10"/>
    <path d="M 31 52 l 6 -3 M 47 52 l 6 -2" stroke="#221a10" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M 43 66 Q 50 72 58 65" fill="none" stroke="#221a10" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 24 80 q 6 -6 12 0 q 6 6 12 0" fill="none" stroke="#8fe3d6" stroke-width="3" stroke-linecap="round"/>
  `),
  // Mamie tricoteuse : chignon gris, lunettes rondes, pelote de laine.
  pelote: medallion("#d47ba6", `
    <path d="M 30 52 Q 26 30 50 28 Q 74 30 70 52 Z" fill="#d8d8de" stroke="#b7b7c2" stroke-width="2"/>
    <circle cx="50" cy="30" r="8" fill="#d8d8de" stroke="#b7b7c2" stroke-width="2"/>
    <circle cx="50" cy="57" r="17" fill="${FACE}"/>
    <circle cx="42" cy="55" r="6" fill="#fff" stroke="#6a5a4a" stroke-width="2.2"/>
    <circle cx="58" cy="55" r="6" fill="#fff" stroke="#6a5a4a" stroke-width="2.2"/>
    <path d="M 48 55 h 4" stroke="#6a5a4a" stroke-width="2.2"/>
    <circle cx="42" cy="55" r="2" fill="#221a10"/>
    <circle cx="58" cy="55" r="2" fill="#221a10"/>
    <path d="M 44 67 Q 50 71 56 67" fill="none" stroke="#221a10" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="72" cy="76" r="9" fill="#e07ba0" stroke="#b85c80" stroke-width="1.6"/>
    <path d="M 65 74 q 7 -4 14 2 M 64 78 q 8 -1 15 3 M 66 71 q 6 4 12 10" fill="none" stroke="#b85c80" stroke-width="1.3"/>
  `),
  // Hibou bibliothécaire : grosses lunettes rondes, aigrettes, petit livre.
  hibou: medallion("#7a6ad0", `
    <path d="M 26 40 l 8 -14 6 12 Z" fill="#8a6a4a"/>
    <path d="M 74 40 l -8 -14 -6 12 Z" fill="#8a6a4a"/>
    <path d="M 28 56 Q 28 30 50 30 Q 72 30 72 56 Q 72 82 50 82 Q 28 82 28 56 Z" fill="#a07a52" stroke="#7a5a38" stroke-width="2"/>
    <path d="M 34 62 Q 50 72 66 62 Q 66 78 50 80 Q 34 78 34 62 Z" fill="#c9a978"/>
    <circle cx="41" cy="52" r="9" fill="#f4ecd8" stroke="#221a10" stroke-width="2.4"/>
    <circle cx="59" cy="52" r="9" fill="#f4ecd8" stroke="#221a10" stroke-width="2.4"/>
    <circle cx="41" cy="52" r="3.4" fill="#221a10"/>
    <circle cx="59" cy="52" r="3.4" fill="#221a10"/>
    <path d="M 46 60 l 4 6 4 -6 Z" fill="#e0a83a" stroke="#a87c1f" stroke-width="1.4" stroke-linejoin="round"/>
  `),
  // Petite créature des étoiles : fourrure turquoise, ventre lavande, grandes
  // oreilles rondes, croissant et collerette d'étoiles.
  kribouille: medallion("#2fb0a0", `
    <circle cx="31" cy="42" r="11" fill="#3fc4b0"/>
    <circle cx="69" cy="42" r="11" fill="#3fc4b0"/>
    <circle cx="31" cy="42" r="5" fill="#c9a6e0"/>
    <circle cx="69" cy="42" r="5" fill="#c9a6e0"/>
    <ellipse cx="50" cy="70" rx="24" ry="22" fill="#3fc4b0"/>
    <ellipse cx="50" cy="76" rx="12" ry="13" fill="#c9a6e0"/>
    <circle cx="50" cy="54" r="21" fill="#3fc4b0"/>
    <path d="M 46 46 a 4.5 4.5 0 0 0 8 0" fill="none" stroke="#e0b04a" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="42" cy="55" r="5" fill="#221a10"/>
    <circle cx="58" cy="55" r="5" fill="#221a10"/>
    <circle cx="43.6" cy="53.2" r="1.6" fill="#fff"/>
    <circle cx="59.6" cy="53.2" r="1.6" fill="#fff"/>
    <path d="M 45 62 q 5 5 10 0" fill="none" stroke="#221a10" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M 47 65 l 1.5 3 3 0 -1.5 3 M 50 65 l 1.5 3 3 0" fill="#c23e6b" opacity="0"/>
    <path d="M 40 66 l 2 -6 2 6 Z" fill="#e0b04a"/>
    <path d="M 56 66 l 2 -6 2 6 Z" fill="#e0b04a"/>
    <path d="M 50 82 l 2.2 -6 2.2 6 Z" fill="#f0d080"/>
    <circle cx="34" cy="60" r="1.4" fill="#f0e6a0"/>
    <circle cx="66" cy="60" r="1.4" fill="#f0e6a0"/>
  `),
  // Plombier-chevalier : casque à plume, grosse moustache, armure rouge, clé.
  plomberoy: medallion("#c0532f", `
    <path d="M 56 26 q 18 -4 22 12 q -12 -4 -20 3 Z" fill="#e8d6b8" stroke="#c9b48a" stroke-width="1.5"/>
    <rect x="33" y="66" width="34" height="26" rx="6" fill="#b23a2a" stroke="#7a2418" stroke-width="2"/>
    <rect x="60" y="66" width="14" height="26" rx="5" fill="#9c3020" stroke="#7a2418" stroke-width="2"/>
    <circle cx="50" cy="55" r="17" fill="${FACE}"/>
    <path d="M 31 46 a 19 13 0 0 1 38 0 l -2 5 -34 0 Z" fill="#9aa2ad" stroke="#6d747e" stroke-width="2"/>
    <g stroke="#6d747e" stroke-width="2"><path d="M 41 47 v 5"/><path d="M 47 47 v 5"/><path d="M 53 47 v 5"/><path d="M 59 47 v 5"/></g>
    <circle cx="44" cy="57" r="2.6" fill="#221a10"/>
    <circle cx="56" cy="57" r="2.6" fill="#221a10"/>
    <ellipse cx="50" cy="60" rx="3.4" ry="2.6" fill="#c67a3a"/>
    <path d="M 38 64 q 6 7 12 2 q 6 5 12 -2" fill="none" stroke="#a0522d" stroke-width="5" stroke-linecap="round"/>
    <path d="M 25 52 l 7 -6 5 5 -5 5 -3 -2 2 -3 -2 -2 -2 3 Z" fill="#c9a86a" stroke="#8a6a3a" stroke-width="1.4" stroke-linejoin="round"/>
    <rect x="25" y="58" width="4.5" height="18" rx="2" fill="#c9a86a" stroke="#8a6a3a" stroke-width="1.2" transform="rotate(28 27 62)"/>
  `),
};

// Illustrations peintes (PNG) posées PAR-DESSUS le médaillon SVG : si une image
// manque, le SVG d'origine reste visible (repli garanti). En version un seul
// fichier, le bundler remplace ces chemins par des data-URI.
const PORTRAIT_ART = {
  cageot: "assets/portrait-cageot.png",
  etincelle: "assets/portrait-etincelle.png",
  gobelin: "assets/portrait-gobelin.png",
  nebulia: "assets/portrait-nebulia.png",
  boumbastien: "assets/portrait-boumbastien.png",
  duchesse: "assets/portrait-duchesse.png",
  flaque: "assets/portrait-flaque.png",
  pelote: "assets/portrait-pelote.png",
  hibou: "assets/portrait-hibou.png",
  kribouille: "assets/portrait-kribouille.png",
  plomberoy: "assets/portrait-plomberoy.png",
};

// Portraits peints (PNG) des 15 PNJ rencontrés sur le plateau. Repli : l'emoji
// du PNJ si l'image manque. En version un seul fichier, le bundler remplace ces
// chemins par des data-URI.
const NPC_ART = {
  "merlinouche": "assets/pnj-merlinouche.png",
  "biscornu": "assets/pnj-biscornu.png",
  "hibou-passage": "assets/pnj-hibou-passage.png",
  "barnabe": "assets/pnj-barnabe.png",
  "roquefort": "assets/pnj-roquefort.png",
  "fee-bricole": "assets/pnj-fee-bricole.png",
  "boubou": "assets/pnj-boubou.png",
  "gerard": "assets/pnj-gerard.png",
  "turbo": "assets/pnj-turbo.png",
  "groumf": "assets/pnj-groumf.png",
  "ratichon": "assets/pnj-ratichon.png",
  "sylvette": "assets/pnj-sylvette.png",
  "coassin": "assets/pnj-coassin.png",
  "piquot": "assets/pnj-piquot.png",
  "zebulon": "assets/pnj-zebulon.png",
};

/** Portrait d'un PNJ (image peinte, repli sur l'emoji). */
export function npcPortraitEl(slug, emoji, size = 96) {
  const div = document.createElement("div");
  div.className = "portrait portrait-npc";
  div.style.width = `${size}px`;
  div.style.height = `${size}px`;
  div.setAttribute("aria-hidden", "true");
  div.innerHTML = `<span class="portrait-emoji" style="font-size:${Math.round(size * 0.6)}px;line-height:${size}px">${emoji ?? ""}</span>`;
  const src = NPC_ART[slug];
  if (src) {
    const img = document.createElement("img");
    img.className = "portrait-art";
    img.alt = "";
    img.decoding = "async";
    img.src = src;
    img.onerror = () => img.remove(); // repli : l'emoji reste visible
    div.appendChild(img);
  }
  return div;
}

/** DOM element for a character medallion (decorative; name is given elsewhere). */
export function portraitEl(characterId, size = 56) {
  const div = document.createElement("div");
  div.className = "portrait";
  div.style.width = `${size}px`;
  div.style.height = `${size}px`;
  div.setAttribute("aria-hidden", "true");
  div.innerHTML = PORTRAITS[characterId] ?? "";
  const src = PORTRAIT_ART[characterId];
  if (src) {
    const img = document.createElement("img");
    img.className = "portrait-art";
    img.alt = "";
    img.decoding = "async";
    img.src = src;
    img.onerror = () => img.remove(); // repli : le médaillon SVG reste
    div.appendChild(img);
  }
  return div;
}
