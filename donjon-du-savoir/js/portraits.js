// Original hand-drawn SVG medallions for the six companions — flat cartoon
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
};

/** DOM element for a character medallion (decorative; name is given elsewhere). */
export function portraitEl(characterId, size = 56) {
  const div = document.createElement("div");
  div.className = "portrait";
  div.style.width = `${size}px`;
  div.style.height = `${size}px`;
  div.setAttribute("aria-hidden", "true");
  div.innerHTML = PORTRAITS[characterId] ?? "";
  return div;
}
