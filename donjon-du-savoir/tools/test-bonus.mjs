// Pure unit tests for the end-game bonus-star logic (computeBonusStars).
// No browser, no DOM. Run: node tools/test-bonus.mjs
import { computeBonusStars, BONUS_STAR_POOL } from "../js/state.js";

let pass = 0;
const failures = [];
const check = (name, ok) => { console.log(`${ok ? "✓" : "✗"} ${name}`); if (ok) pass++; else failures.push(name); };

// Deterministic RNG (mulberry32) so award selection is reproducible in tests.
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = (id, over) => ({
  id, nom: `J${id}`, characterId: "cageot", etoiles: 0,
  casesParcourues: 0, orGagne: 0, malusSubis: 0,
  stats: { bonnes: 0, questions: 0 }, ...over,
});

// A rich, varied field where every award has a clear winner.
const pions = [
  P(0, { casesParcourues: 50, orGagne: 10, malusSubis: 1, stats: { bonnes: 2, questions: 5 }, etoiles: 3 }),
  P(1, { casesParcourues: 5, orGagne: 40, malusSubis: 0, stats: { bonnes: 8, questions: 9 }, etoiles: 1 }),
  P(2, { casesParcourues: 20, orGagne: 20, malusSubis: 5, stats: { bonnes: 1, questions: 1 }, etoiles: 0 }),
  P(3, { casesParcourues: 30, orGagne: 5, malusSubis: 2, stats: { bonnes: 0, questions: 0 }, etoiles: 2 }),
];

// Selecting ALL awards lets us verify each winner deterministically.
const all = computeBonusStars(pions, { count: BONUS_STAR_POOL.length, rng: rngFrom(1) });
const by = (k) => all.find((a) => a.key === k);
check("all eligible awards returned", all.length === BONUS_STAR_POOL.length);
check("lièvre → most cases (J0)", by("lievre")?.pionId === 0);
check("tortue → fewest cases (J1)", by("tortue")?.pionId === 1);
check("roi des questions → most bonnes (J1)", by("roi_questions")?.pionId === 1);
check("œil de lynx → best rate, ≥3 questions (J1)", by("oeil_de_lynx")?.pionId === 1);
check("magnat → most gold (J1)", by("magnat")?.pionId === 1);
check("souffre-douleur → most malus (J2)", by("souffre_douleur")?.pionId === 2);
check("chouchou (random) → valid pion", [0, 1, 2, 3].includes(by("chouchou")?.pionId));

// A default draw returns exactly 3 distinct awards.
const three = computeBonusStars(pions, { rng: rngFrom(42) });
check("default draw returns 3", three.length === 3);
check("3 distinct award keys", new Set(three.map((a) => a.key)).size === 3);

// Freshly-started field: only the metric-free / no-minValue awards qualify.
const idle = [P(0), P(1)];
const idleAwards = computeBonusStars(idle, { count: 9, rng: rngFrom(7) });
const idleKeys = new Set(idleAwards.map((a) => a.key));
check("idle game: no roi_questions (needs ≥1 bonne)", !idleKeys.has("roi_questions"));
check("idle game: no magnat (needs gold)", !idleKeys.has("magnat"));
check("idle game: lièvre & tortue & chouchou remain", idleKeys.has("lievre") && idleKeys.has("tortue") && idleKeys.has("chouchou"));

// Tie-break favours the underdog (fewer current stars).
const tie = [P(0, { casesParcourues: 10, etoiles: 5 }), P(1, { casesParcourues: 10, etoiles: 1 })];
const tieAwards = computeBonusStars(tie, { count: BONUS_STAR_POOL.length, rng: rngFrom(3) });
check("tie on cases → underdog wins lièvre (J1)", tieAwards.find((a) => a.key === "lievre")?.pionId === 1);

// Empty field is safe.
check("empty pions → []", computeBonusStars([], {}).length === 0);

if (failures.length) { console.error(`\nBONUS TESTS FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log(`\nBONUS TESTS OK (${pass} checks)`);
