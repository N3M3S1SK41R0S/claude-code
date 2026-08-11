import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  answerMatches,
  applyCorrect,
  applyWrong,
  basePoints,
  CCD_MULTIPLIER,
  CONFIDENCE,
  ageForDifficulty,
  difficultyForAge,
  gambitMultiplier,
  makeHint,
  makePlayer,
  normalizeAnswer,
  pickEliminations,
  scoreFor,
} from "../src/lib/engine.ts";
import type { Question } from "../src/lib/types.ts";

describe("scoring", () => {
  it("base is 100 × difficulty", () => {
    assert.equal(basePoints(1), 100);
    assert.equal(basePoints(5), 500);
  });

  it("no streak bonus on the first correct answer", () => {
    assert.equal(scoreFor(3, 1, 1), 300);
  });

  it("streak bonus is +50 × min(streak−1, 5)", () => {
    assert.equal(scoreFor(2, 2, 1), 200 + 50);
    assert.equal(scoreFor(2, 4, 1), 200 + 150);
    assert.equal(scoreFor(2, 10, 1), 200 + 250); // capped at 5 steps
  });

  it("format and joker multipliers compose on the whole total", () => {
    assert.equal(scoreFor(2, 2, CCD_MULTIPLIER.cash), (200 + 50) * 3);
    assert.equal(scoreFor(1, 1, CCD_MULTIPLIER.carre * 2), 100 * 4); // carré + BARGOL
    assert.equal(scoreFor(3, 1, 0.5), 150); // gambit near-miss
  });
});

describe("player state transitions", () => {
  it("applyCorrect grows streak, credits score, steps tier up every 3", () => {
    let p = makePlayer(0, "Test");
    p = applyCorrect(p, 2, 1);
    assert.equal(p.streak, 1);
    assert.equal(p.tier, 2);
    assert.equal(p.score, 200);
    p = applyCorrect(p, 2, 1);
    p = applyCorrect(p, 2, 1);
    assert.equal(p.streak, 3);
    assert.equal(p.tier, 3); // stepped up at streak 3
    assert.equal(p.bestStreak, 3);
    assert.equal(p.correct, 3);
    assert.equal(p.answered, 3);
  });

  it("tier steps up again at streak 6, capped at 5", () => {
    let p: ReturnType<typeof makePlayer> = { ...makePlayer(0, "T"), tier: 5 };
    for (let i = 0; i < 6; i++) p = applyCorrect(p, 1, 1);
    assert.equal(p.tier, 5);
  });

  it("applyWrong resets streak and steps down after 2 consecutive misses", () => {
    let p = makePlayer(0, "T");
    p = applyCorrect(p, 2, 1);
    p = applyWrong(p);
    assert.equal(p.streak, 0);
    assert.equal(p.tier, 2);
    assert.equal(p.missRun, 1);
    p = applyWrong(p);
    assert.equal(p.tier, 1); // stepped down
    assert.equal(p.missRun, 0); // counter reset after the step
    p = applyWrong(p);
    assert.equal(p.tier, 1); // floor at 1 (single new miss anyway)
  });

  it("a lost confident bet deducts the penalty but never goes below 0", () => {
    let p = makePlayer(0, "T");
    const penalty = basePoints(4) * CONFIDENCE.sur.penaltyOfBase;
    p = applyWrong(p, penalty);
    assert.equal(p.score, 0);
    p = { ...makePlayer(0, "T"), score: 500 };
    p = applyWrong(p, 200);
    assert.equal(p.score, 300);
  });
});

describe("gambit_numerique tolerance", () => {
  it("exact answer doubles", () => {
    assert.equal(gambitMultiplier(193, 193), 2);
  });

  it("year-like answers use absolute tolerance (±3 full, ±10 half)", () => {
    assert.equal(gambitMultiplier(1791, 1789), 1);
    assert.equal(gambitMultiplier(1795, 1789), 0.5);
    assert.equal(gambitMultiplier(1750, 1789), 0);
  });

  it("small magnitudes use relative tolerance (10 % full, 25 % half)", () => {
    assert.equal(gambitMultiplier(8, 8), 2);
    assert.equal(gambitMultiplier(62, 60), 1);
    assert.equal(gambitMultiplier(70, 60), 0.5);
    assert.equal(gambitMultiplier(100, 60), 0);
  });

  it("garbage input scores 0", () => {
    assert.equal(gambitMultiplier(NaN, 100), 0);
    assert.equal(gambitMultiplier(Infinity, 100), 0);
  });
});

describe("free-text answer matching", () => {
  it("strips accents, case, punctuation and leading articles", () => {
    assert.equal(normalizeAnswer("L'Équateur"), "equateur");
    assert.equal(normalizeAnswer("le Brésil !"), "bresil");
  });

  it("matches exact and containment both ways", () => {
    assert.ok(answerMatches("l'oural", ["l'Oural"]));
    assert.ok(answerMatches("pyramide de Gizeh", ["la grande pyramide de Gizeh"]));
    assert.ok(answerMatches("la grande pyramide de Gizeh d'Égypte", ["pyramide de Gizeh"]));
    assert.ok(!answerMatches("les Alpes", ["l'Oural"]));
  });

  it("short answers require exact equality (no accidental containment)", () => {
    assert.ok(answerMatches("8", ["8"]));
    assert.ok(!answerMatches("8", ["1889"]));
    assert.ok(!answerMatches("or", ["corse"]));
  });

  it("empty input never matches", () => {
    assert.ok(!answerMatches("   ", ["oui"]));
  });
});

describe("jokers", () => {
  it("GRONK eliminates exactly 2 wrong choices, never the answer", () => {
    for (let i = 0; i < 50; i++) {
      const out = pickEliminations(2, 4);
      assert.equal(out.length, 2);
      assert.ok(!out.includes(2));
      assert.equal(new Set(out).size, 2);
    }
  });

  it("LILUNE hints digits for numeric answers and first letter otherwise", () => {
    const gambit = { format: "gambit_numerique", numericAnswer: 193 } as unknown as Question;
    assert.match(makeHint(gambit), /3 chiffres/);
    const qcm = { format: "qcm", choices: ["Victor Hugo", "a", "b", "c"], answerIndex: 0 } as unknown as Question;
    assert.match(makeHint(qcm), /« V »/);
    assert.match(makeHint(qcm), /2 mots/);
  });
});

describe("age ↔ difficulty mapping", () => {
  it("maps script ages to scoring difficulties", () => {
    assert.equal(difficultyForAge("enfant"), 1);
    assert.equal(difficultyForAge("ado"), 3);
    assert.equal(difficultyForAge("adulte"), 4);
  });

  it("buckets forge difficulties into audiences", () => {
    assert.equal(ageForDifficulty(1), "enfant");
    assert.equal(ageForDifficulty(2), "ado");
    assert.equal(ageForDifficulty(3), "ado");
    assert.equal(ageForDifficulty(4), "adulte");
    assert.equal(ageForDifficulty(5), "adulte");
  });
});
