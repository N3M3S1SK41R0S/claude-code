/**
 * Design tokens VELUM (§11.1) — extraits du sceau de cire du logo :
 * bordeaux profond + or, ambiance feutrée (cave / cabinet / galerie).
 * Fichier CJS : consommé par tailwind.config.js (Node) ET réexporté en TS
 * par @velum/ui pour les composants.
 */
const velumColors = {
  // Fond « cave » — brun-noir chaud
  ink: {
    DEFAULT: '#14090B',
    soft: '#1A0D10',
    raised: '#241217',
    border: '#3A1F26',
  },
  // Bordeaux — cire du sceau
  bordeaux: {
    DEFAULT: '#7A2230',
    deep: '#5C1A22',
    bright: '#9E2F3F',
  },
  // Or — lettrage du sceau
  gold: {
    DEFAULT: '#C9A227',
    soft: '#E5C158',
    faint: '#8A7119',
  },
  // Parchemin — textes et surfaces claires
  parchment: {
    DEFAULT: '#F2E7D5',
    dim: '#CBBFA9',
    faint: '#8F8570',
  },
  // Sémantique
  success: '#4C9A6A',
  warning: '#D08B2C',
  danger: '#C0392B',
  info: '#5B7FA6',
};

const velumTailwindTheme = {
  colors: velumColors,
  fontFamily: {
    serif: ['PlayfairDisplay_700Bold', 'Georgia', 'serif'],
    sans: ['System', 'Inter', 'sans-serif'],
  },
  borderRadius: {
    card: '16px',
    seal: '999px',
  },
};

module.exports = { velumColors, velumTailwindTheme };
