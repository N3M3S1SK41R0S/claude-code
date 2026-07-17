// Turn engine: dice, case effects, question formats, powers, victory.
// Design rules (documented in README):
//  - only DICE movement triggers case effects; rewards/penalties move the
//    pion without re-triggering, so a turn always terminates;
//  - nothing is ever timed (non-negotiable rule of the cahier des charges);
//  - anecdote after EVERY question, no exception.
import { drawEasier, drawEvent, drawGambit, drawHardest, drawQuestion } from "./data.js";
import { BOARD_LENGTH, renderBoard } from "./board.js";
import { herald } from "./herald.js";
import { canRecharge, powerOf, recharge, RECHARGE_COST } from "./powers.js";
import { characterById, currentPion, getState, isLast, nextTurn, porteParole, ranking, save } from "./state.js";
import { bigButton, choiceButton, el, heraldSays, setPanel } from "./ui.js";

let onVictory = null;

export function startGame(victoryCallback) {
  onVictory = victoryCallback;
  render();
  heraldSays(herald.ouverture());
  window.setTimeout(() => startTurn(), 50);
}

export function resumeGame(victoryCallback) {
  onVictory = victoryCallback;
  render();
  startTurn({ silent: true });
}

/* ---------- rendering ---------- */

function pionView(p) {
  const c = characterById(p.characterId);
  return { ...p, emoji: c.emoji, couleur: c.couleur };
}

function render() {
  const state = getState();
  renderBoard(
    document.getElementById("board"),
    state.board,
    state.pions.map(pionView),
    currentPion().id,
  );
  renderPlayersStrip();
}

function renderPlayersStrip() {
  const state = getState();
  const strip = document.getElementById("players");
  strip.innerHTML = "";
  for (const p of ranking()) {
    const c = characterById(p.characterId);
    const power = powerOf(p);
    strip.append(
      el("div", { class: "player-chip" + (p.id === currentPion().id ? " player-chip-actif" : "") },
        el("span", { class: "player-emoji", "aria-hidden": "true", text: c.emoji }),
        el("div", { class: "player-info" },
          el("strong", { text: p.nom }),
          el("span", {
            class: "player-meta",
            text: `case ${p.position} · 🪙${p.pieces} · 🃏${p.jokers} · ${power ? (p.pouvoirUtilise ? "pouvoir épuisé" : power.nom) : ""}`,
          }),
        ),
      ),
    );
  }
}

/* ---------- turn start ---------- */

function startTurn({ silent = false } = {}) {
  const state = getState();
  if (state.finished) return;
  const pion = currentPion();
  render();
  if (!silent) heraldSays(herald.debutTour(pion.nom));

  const actions = [bigButton("🎲 Lancer le dé", () => rollDie())];

  // Pre-roll powers ("tour"-timed) + recharge.
  const power = powerOf(pion);
  if (power && !pion.pouvoirUtilise && power.quand === "tour") {
    actions.push(choiceButton(`${characterById(pion.characterId).emoji} ${power.nom} — ${power.desc}`, () => useTurnPower(pion)));
  }
  if (canRecharge(pion)) {
    actions.push(
      choiceButton(
        `♻️ Recharger le pouvoir (${pion.jokers > 0 ? "1 carte Joker" : `${RECHARGE_COST} pièces`})`,
        () => {
          recharge(pion);
          save();
          startTurn({ silent: true });
        },
      ),
    );
  }
  setPanel(
    el("h2", { class: "panel-title", text: `Tour de ${pion.nom}` }),
    ...actions,
  );
}

/* ---------- dice ---------- */

function rollDie() {
  const value = 1 + Math.floor(Math.random() * 6);
  // Short tumble animation — pure spectacle, the player is never rushed.
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return showDieResult(value, { rerollAvailable: true });
  setPanel(el("div", { class: "die die-rolling", "aria-hidden": "true" }, "🎲"));
  window.setTimeout(() => showDieResult(value, { rerollAvailable: true }), 600);
}

function showDieResult(value, { rerollAvailable }) {
  const pion = currentPion();
  const power = powerOf(pion);
  const actions = [bigButton(`Avancer de ${value}`, () => moveAndResolve(value))];
  if (rerollAvailable && power && !pion.pouvoirUtilise && power.quand === "de") {
    actions.push(
      choiceButton(`${characterById(pion.characterId).emoji} ${power.nom} — relancer le dé`, () => {
        pion.pouvoirUtilise = true;
        save();
        heraldSays(herald.pouvoir());
        const v2 = 1 + Math.floor(Math.random() * 6);
        showDieResult(v2, { rerollAvailable: false });
      }),
    );
  }
  setPanel(
    el("div", { class: "die", role: "img", "aria-label": `Dé : ${value}` }, ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value]),
    ...actions,
  );
}

/** Move without triggering the landing case (rewards/penalties). */
function shift(pion, delta) {
  pion.position = Math.max(0, Math.min(BOARD_LENGTH - 1, pion.position + delta));
  save();
  render();
  if (pion.position >= BOARD_LENGTH - 1) return finishGame(pion);
  return false;
}

function moveAndResolve(steps) {
  const pion = currentPion();
  pion.position = Math.max(0, Math.min(BOARD_LENGTH - 1, pion.position + steps));
  save();
  render();
  if (pion.position >= BOARD_LENGTH - 1) return finishGame(pion);
  const type = getState().board[pion.position];
  heraldSays(herald.surCase(type));
  resolveCase(type);
}

/* ---------- case effects ---------- */

function resolveCase(type) {
  const pion = currentPion();
  switch (type) {
    case "question":
      return doQuestion();
    case "chance":
      return doChance(pion);
    case "evenement":
      return doEvent();
    case "malus":
      return doMalus(pion);
    case "pieces": {
      const gain = 3 + Math.floor(Math.random() * 3);
      addCoins(pion, gain);
      return endPanel(`Vous ramassez ${gain} pièces d'or ! 🪙`);
    }
    case "joker":
      pion.jokers += 1;
      save();
      return endPanel("Vous gagnez une carte Joker ! 🃏 Elle recharge un pouvoir déjà utilisé.");
    case "gambit":
      return doGambit(pion);
    case "trounoir":
      return doTrouNoir(pion);
    default:
      return endPanel("Case tranquille. Le Donjon vous laisse souffler.");
  }
}

function addCoins(pion, n) {
  const gain = pion.doublePieces ? n * 2 : n;
  pion.pieces += gain;
  save();
  renderPlayersStrip();
  return gain;
}

const CHANCE_EFFECTS = [
  { texte: "Un raccourci secret ! Avancez de 2 cases.", apply: (p) => shift(p, 2) },
  { texte: "Un courant d'air favorable ! Avancez de 3 cases.", apply: (p) => shift(p, 3) },
  { texte: "Une bourse oubliée : +3 pièces.", apply: (p) => void addCoins(p, 3) },
  { texte: "Le trésor d'un rat distrait : +5 pièces.", apply: (p) => void addCoins(p, 5) },
  { texte: "Une carte Joker qui traînait ! +1 Joker.", apply: (p) => void (p.jokers += 1) },
  { texte: "Petit bond en avant : +1 case.", apply: (p) => shift(p, 1) },
];

const MALUS_EFFECTS = [
  { texte: "Une dalle piégée ! Reculez de 2 cases.", apply: (p) => shift(p, -2) },
  { texte: "Un escalier glissant ! Reculez de 3 cases.", apply: (p) => shift(p, -3) },
  { texte: "Un péage de gobelins : −3 pièces.", apply: (p) => void (p.pieces = Math.max(0, p.pieces - 3)) },
  { texte: "Une sieste involontaire : vous passez votre prochain tour.", apply: (p) => void (p.tourASauter = true) },
  { texte: "Petite chute : reculez d'1 case.", apply: (p) => shift(p, -1) },
];

function doChance(pion, { forced = null } = {}) {
  const effect = forced ?? CHANCE_EFFECTS[Math.floor(Math.random() * CHANCE_EFFECTS.length)];
  const won = effect.apply(pion) === true; // shift() returns true on victory
  save();
  render();
  if (won) return;
  endPanel(`🍀 ${effect.texte}`);
}

function doMalus(pion) {
  const effect = MALUS_EFFECTS[Math.floor(Math.random() * MALUS_EFFECTS.length)];
  const power = powerOf(pion);
  const apply = () => {
    effect.apply(pion);
    save();
    render();
    endPanel(`💀 ${effect.texte}`);
  };
  if (power && !pion.pouvoirUtilise && power.quand === "malus") {
    setPanel(
      el("h2", { class: "panel-title", text: "Coup dur en approche…" }),
      el("p", { class: "panel-text", text: effect.texte }),
      choiceButton(`${characterById(pion.characterId).emoji} ${power.nom} — annuler ce malus`, () => {
        pion.pouvoirUtilise = true;
        save();
        heraldSays(herald.pouvoir());
        endPanel("🫧 Le malus éclate comme une bulle de savon. Il ne s'est rien passé.");
      }),
      bigButton("Subir son destin", apply),
    );
    return;
  }
  apply();
}

/* ---------- turn-timed powers ---------- */

function useTurnPower(pion) {
  const power = powerOf(pion);
  const others = getState().pions.filter((p) => p.id !== pion.id);
  const done = () => {
    pion.pouvoirUtilise = true;
    save();
    heraldSays(herald.pouvoir());
    startTurn({ silent: true });
  };
  switch (`${pion.characterId}:${pion.profil}`) {
    case "etincelle:adulte": {
      const targets = others.filter((p) => p.jokers > 0);
      if (targets.length === 0) return startTurn({ silent: true });
      setPanel(
        el("h2", { class: "panel-title", text: "Chapardage — voler un Joker à qui ?" }),
        ...targets.map((t) => choiceButton(`${t.nom} (🃏 ${t.jokers})`, () => {
          t.jokers -= 1;
          pion.jokers += 1;
          done();
        })),
        choiceButton("Annuler", () => startTurn({ silent: true })),
      );
      return;
    }
    case "gobelin:adulte":
      pion.doublePieces = true;
      return done();
    case "gobelin:enfant": {
      const [a, b] = [...CHANCE_EFFECTS].sort(() => Math.random() - 0.5).slice(0, 2);
      setPanel(
        el("h2", { class: "panel-title", text: "Petit Trésor — choisis ta carte Chance !" }),
        choiceButton(`🍀 ${a.texte}`, () => {
          pion.pouvoirUtilise = true;
          save();
          doChance(pion, { forced: a });
        }),
        choiceButton(`🍀 ${b.texte}`, () => {
          pion.pouvoirUtilise = true;
          save();
          doChance(pion, { forced: b });
        }),
      );
      return;
    }
    case "nebulia:adulte": {
      setPanel(
        el("h2", { class: "panel-title", text: "Échange Cosmique — avec qui ?" }),
        ...others.map((t) => choiceButton(`${t.nom} (case ${t.position})`, () => {
          [pion.position, t.position] = [t.position, pion.position];
          render();
          done();
        })),
        choiceButton("Annuler", () => startTurn({ silent: true })),
      );
      return;
    }
    case "boumbastien:enfant":
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir());
      if (shift(pion, 2)) return;
      return startTurn({ silent: true });
    default:
      return startTurn({ silent: true });
  }
}

/* ---------- questions (all formats, never timed) ---------- */

const ADVANCE = { qcm: 2, vrai_faux: 1, equipe: 2, duo: 1, carre: 2, cash: 4 };

function speakerIntro(pion) {
  const membre = porteParole(pion);
  return membre ? `C'est ${membre.nom} qui répond pour l'équipe ${pion.nom} !` : null;
}

function doQuestion() {
  const pion = currentPion();
  const q = drawQuestion(pion, { formats: ["qcm", "vrai_faux", "cash_carre_duo", "equipe", "pari_confiance"] });
  if (!q) return endPanel("La banque de questions est épuisée. Le Donjon est impressionné.");
  // TTMC-style confidence bet: applied to a share of the classic QCM draws.
  if (q.format === "qcm" && Math.random() < 0.15) return confianceFlow(pion, q);
  questionFlow(pion, q);
}

function questionFlow(pion, q, { advanceOverride = null, cashMode = null } = {}) {
  const intro = speakerIntro(pion);
  if (intro) heraldSays(intro);

  if (q.format === "cash_carre_duo" && cashMode === null) return ccdPicker(pion, q);
  if (q.format === "equipe") return openAnswerFlow(pion, q, { advance: ADVANCE.equipe, accepted: q.reponses_acceptees ?? [] });
  if (q.format === "gambit_numerique") return openAnswerFlow(pion, q, { advance: 2, accepted: [String(q.reponse_numerique)] });
  if (cashMode === "cash") return openAnswerFlow(pion, q, { advance: ADVANCE.cash, accepted: [q.bonne_reponse] });

  // Choice-based rendering (qcm, vrai_faux, carré, duo).
  let choices = q.choix ?? [];
  if (cashMode === "duo") {
    const wrong = choices.filter((c) => c !== q.bonne_reponse);
    choices = [q.bonne_reponse, wrong[Math.floor(Math.random() * wrong.length)]].sort(() => Math.random() - 0.5);
  }
  const advance = advanceOverride ?? (cashMode ? ADVANCE[cashMode] : ADVANCE[q.format] ?? 2);

  // Catch-up help (§5): the last-placed pion gets one wrong choice struck.
  let struck = null;
  if (isLast(pion) && choices.length >= 3) {
    const wrong = choices.filter((c) => c !== q.bonne_reponse);
    struck = wrong[Math.floor(Math.random() * wrong.length)];
  }

  const container = el("div", { class: "question-block" });
  container.append(questionHeader(q), el("p", { class: "question-texte", text: q.texte }));
  const hintZone = el("div", { class: "hint-zone" });
  container.append(hintZone);

  const grid = el("div", { class: `choices ${choices.length === 2 ? "choices-2" : ""}`, role: "group", "aria-label": "Choix de réponse" });
  choices.forEach((choice) => {
    const btn = choiceButton(choice, () => resolveAnswer(pion, q, choice === q.bonne_reponse, advance));
    if (struck === choice) {
      btn.classList.add("choice-struck");
      btn.disabled = true;
      btn.setAttribute("aria-label", `${choice} (éliminée — coup de pouce du Donjon)`);
    }
    grid.append(btn);
  });
  container.append(grid);
  if (struck) container.append(el("p", { class: "help-note", text: "🤝 Coup de pouce du Donjon : une mauvaise réponse a été éliminée pour le dernier du classement." }));

  appendQuestionPowers(container, hintZone, pion, q, { cashMode });
  setPanel(container);
}

function questionHeader(q) {
  return el("div", { class: "question-head" },
    el("span", { class: "badge badge-cat", text: q.categorie }),
    el("span", { class: "badge", text: q.niveau_age === "enfant" ? "👶 enfant" : q.niveau_age === "ado" ? "🧢 ado" : "🎩 adulte" }),
    el("span", { class: "badge", text: "★".repeat(q.difficulte ?? 3) }),
  );
}

/** Powers usable while a question is displayed (Cageot & Duchesse). */
function appendQuestionPowers(container, hintZone, pion, q, { cashMode }) {
  const power = powerOf(pion);
  if (!power || pion.pouvoirUtilise || power.quand !== "question") return;
  const c = characterById(pion.characterId);
  const zone = el("div", { class: "power-zone" });

  const key = `${pion.characterId}:${pion.profil}`;
  if (key === "cageot:adulte" && (q.format === "qcm" || (q.format === "cash_carre_duo" && cashMode === "carre"))) {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — répondre CASH (+${ADVANCE.cash} cases)`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir());
      openAnswerFlow(pion, q, { advance: ADVANCE.cash, accepted: [q.bonne_reponse] });
    }));
  } else if (key === "cageot:enfant") {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — question plus facile`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir());
      const easier = drawEasier(pion, q.difficulte);
      if (easier) questionFlow(pion, easier);
    }));
  } else if (key === "duchesse:adulte") {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — lire l'anecdote maintenant`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir());
      hintZone.append(el("p", { class: "hint", text: `📜 ${q.anecdote}` }));
      zone.remove();
    }));
  } else if (key === "duchesse:enfant") {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — un indice !`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir());
      const answer = q.bonne_reponse ?? String(q.reponse_numerique ?? "");
      const first = answer.trim().charAt(0).toUpperCase();
      hintZone.append(el("p", { class: "hint", text: `💡 La réponse commence par « ${first} ».` }));
      zone.remove();
    }));
  }
  if (zone.children.length > 0) container.append(zone);
}

function ccdPicker(pion, q) {
  setPanel(
    el("div", { class: "question-block" },
      questionHeader(q),
      el("p", { class: "panel-text", text: "Choisissez votre niveau de risque avant de voir la question :" }),
      el("div", { class: "choices choices-3" },
        choiceButton(`💰 CASH — réponse libre (+${ADVANCE.cash} cases)`, () => questionFlow(pion, q, { cashMode: "cash" })),
        choiceButton(`🟦 CARRÉ — 4 choix (+${ADVANCE.carre} cases)`, () => questionFlow(pion, q, { cashMode: "carre" })),
        choiceButton(`🟨 DUO — 2 choix (+${ADVANCE.duo} case)`, () => questionFlow(pion, q, { cashMode: "duo" })),
      ),
    ),
  );
}

/**
 * Open answer, honor system (perfect for a shared-table game): the player
 * answers OUT LOUD, then the table validates against the revealed answer.
 */
function openAnswerFlow(pion, q, { advance, accepted, onResolve = null }) {
  const resolve = onResolve ?? ((correct) => resolveAnswer(pion, q, correct, advance));
  const container = el("div", { class: "question-block" });
  container.append(questionHeader(q), el("p", { class: "question-texte", text: q.texte }));
  const hintZone = el("div", { class: "hint-zone" });
  container.append(hintZone);
  container.append(el("p", { class: "help-note", text: "🗣️ Répondez à voix haute, puis révélez la réponse. La table est juge !" }));
  container.append(
    bigButton("Révéler la réponse", () => {
      setPanel(
        el("div", { class: "question-block" },
          el("p", { class: "question-texte", text: q.texte }),
          el("p", { class: "reveal-answer", html: `✅ Réponse${accepted.length > 1 ? "s acceptées" : ""} : <strong>${accepted.join(" · ")}</strong>` }),
          el("div", { class: "choices choices-2" },
            choiceButton("👍 Bonne réponse !", () => resolve(true)),
            choiceButton("👎 Raté…", () => resolve(false)),
          ),
        ),
      );
    }),
  );
  appendQuestionPowers(container, hintZone, pion, q, { cashMode: null });
  setPanel(container);
}

/** TTMC-style confidence bet on a classic QCM: bet 1-10 BEFORE seeing it. */
function confianceFlow(pion, q) {
  const intro = speakerIntro(pion);
  if (intro) heraldSays(intro);
  const bets = el("div", { class: "choices bet-grid", role: "group", "aria-label": "Mise de confiance" });
  for (let mise = 1; mise <= 10; mise++) {
    bets.append(choiceButton(String(mise), () => {
      const advance = Math.ceil(mise / 2);
      const penalty = mise >= 6 ? -1 : 0;
      openAnswerFlow(pion, q, {
        advance,
        accepted: [q.bonne_reponse],
        onResolve: (correct) => resolveAnswer(pion, q, correct, advance, { penalty }),
      });
    }));
  }
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🎯 Pari de confiance" }),
      questionHeader(q),
      el("p", { class: "panel-text", text: `Thème : ${q.categorie}. Tu te mets combien, de 1 à 10 ? Bonne réponse = avance de la moitié de ta mise. Mise ≥ 6 ratée = recul d'une case.` }),
      bets,
    ),
  );
}

/* ---------- answer resolution + anecdote (always) ---------- */

function resolveAnswer(pion, q, correct, advance, { penalty = 0 } = {}) {
  pion.stats.questions += 1;
  let moveDelta = 0;
  let coinGain = 0;
  if (correct) {
    pion.stats.bonnes += 1;
    moveDelta = advance;
    coinGain = addCoins(pion, 1);
  } else {
    moveDelta = penalty;
  }
  save();
  heraldSays(correct ? herald.bonne() : herald.mauvaise());
  showAnecdote(q, {
    verdictHtml: correct
      ? `✅ <strong>Bonne réponse !</strong> ${q.bonne_reponse ? `(${q.bonne_reponse})` : ""} +${advance} case${advance > 1 ? "s" : ""}${coinGain ? ` · +${coinGain} 🪙` : ""}`
      : `❌ <strong>Raté.</strong> La bonne réponse était : <strong>${q.bonne_reponse ?? q.reponse_numerique ?? (q.reponses_acceptees ?? []).join(" · ")}</strong>${penalty ? ` · recul de ${-penalty} case` : ""}`,
    onContinue: () => {
      if (moveDelta !== 0 && shift(pion, moveDelta)) return;
      finishTurn();
    },
  });
}

function showAnecdote(q, { verdictHtml, onContinue }) {
  const sources = (q.sources ?? []).slice(0, 3).map((src) => {
    let label = "source";
    try {
      label = new URL(src).hostname.replace(/^www\./, "");
    } catch {
      /* keep default label */
    }
    return el("a", { class: "source-link", href: src, target: "_blank", rel: "noopener noreferrer", text: label });
  });
  heraldSays(`${herald.anecdote()} ${q.anecdote}`, { speak: false });
  setPanel(
    el("div", { class: "question-block" },
      el("p", { class: "verdict", html: verdictHtml }),
      el("div", { class: "anecdote-card" },
        el("p", { class: "anecdote-title", text: "📜 L'anecdote du Héraut" }),
        el("p", { class: "anecdote-texte", text: q.anecdote }),
        sources.length > 0 ? el("div", { class: "sources" }, ...sources) : null,
      ),
      bigButton("Continuer", onContinue),
    ),
  );
}

/* ---------- special cases ---------- */

function doTrouNoir(pion) {
  const q = drawHardest(pion);
  if (!q) return endPanel("Le Trou Noir est vide. Il médite.");
  const advance = 3;
  const recul = -6;
  const container = el("div", { class: "question-block trou-noir" });
  container.append(
    el("h2", { class: "panel-title", text: "🕳️ LE TROU NOIR" }),
    el("p", { class: "panel-text", text: "La question la plus redoutable de votre rang. Réussite : +3 cases. Échec : recul de 6 cases. Jamais d'élimination — le Donjon est joueur, pas cruel." }),
    questionHeader(q),
    el("p", { class: "question-texte", text: q.texte }),
  );
  const hintZone = el("div", { class: "hint-zone" });
  container.append(hintZone);
  const grid = el("div", { class: `choices ${(q.choix ?? []).length === 2 ? "choices-2" : ""}` });
  (q.choix ?? []).forEach((choice) => {
    grid.append(choiceButton(choice, () => {
      const correct = choice === q.bonne_reponse;
      pion.stats.questions += 1;
      if (correct) pion.stats.bonnes += 1;
      heraldSays(correct ? herald.bonne() : herald.mauvaise());
      showAnecdote(q, {
        verdictHtml: correct
          ? `✅ <strong>Le Trou Noir s'incline !</strong> +${advance} cases`
          : `❌ <strong>Englouti…</strong> La bonne réponse était : <strong>${q.bonne_reponse}</strong> · recul de 6 cases`,
        onContinue: () => {
          if (shift(pion, correct ? advance : recul)) return;
          finishTurn();
        },
      });
    }));
  });
  container.append(grid);
  appendQuestionPowers(container, hintZone, pion, q, { cashMode: null });
  setPanel(container);
}

/** Gambit: numeric answer + the other pions bet "trop haut / trop bas / juste". */
function doGambit(pion) {
  const q = drawGambit(pion);
  if (!q) return endPanel("Plus de questions numériques en réserve — le Gambit tousse.");
  const others = getState().pions.filter((p) => p.id !== pion.id);
  const answer = Number(q.reponse_numerique);

  const input = el("input", {
    class: "num-input",
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    "aria-label": "Votre réponse numérique",
    placeholder: "Votre nombre…",
  });
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🎲 GAMBIT" }),
      questionHeader(q),
      el("p", { class: "question-texte", text: q.texte }),
      el("p", { class: "help-note", text: `${pion.nom} annonce un nombre — puis les autres parieront si la vraie réponse est plus haute, plus basse, ou si c'est juste.` }),
      input,
      bigButton("Valider mon nombre", () => {
        const guess = Number(String(input.value).replace(",", ".").replace(/\s+/g, ""));
        if (!Number.isFinite(guess)) {
          input.value = "";
          input.placeholder = "Il faut un nombre !";
          return;
        }
        if (others.length === 0) return gambitReveal(pion, q, guess, []);
        gambitBets(pion, q, guess, others);
      }),
    ),
  );
  input.focus();
}

function gambitBets(pion, q, guess, others) {
  const bets = new Map();
  const rows = others.map((p) => {
    const row = el("div", { class: "bet-row" }, el("strong", { class: "bet-name", text: p.nom }));
    const group = el("div", { class: "bet-buttons", role: "group", "aria-label": `Pari de ${p.nom}` });
    for (const [key, label] of [["bas", "⬇️ Trop bas"], ["juste", "🎯 Juste"], ["haut", "⬆️ Trop haut"]]) {
      const btn = choiceButton(label, () => {
        bets.set(p.id, key);
        group.querySelectorAll("button").forEach((b) => b.classList.remove("bet-selected"));
        btn.classList.add("bet-selected");
        if (bets.size === others.length) validateBtn.disabled = false;
      }, "btn-bet");
      group.append(btn);
    }
    row.append(group);
    return row;
  });
  const validateBtn = bigButton("Révéler la vraie réponse", () => gambitReveal(pion, q, guess, others.map((p) => ({ pion: p, bet: bets.get(p.id) }))));
  validateBtn.disabled = true;
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🎲 Les paris sont ouverts !" }),
      el("p", { class: "panel-text", html: `${pion.nom} annonce : <strong>${guess}</strong>. La vraie réponse est-elle plus haute, plus basse, ou est-ce juste ?` }),
      ...rows,
      validateBtn,
    ),
  );
}

function gambitReveal(pion, q, guess, bets) {
  const answer = Number(q.reponse_numerique);
  const diff = Math.abs(guess - answer);
  const yearLike = Number.isInteger(answer) && answer >= 1000 && answer <= 2100;
  let advance = 0;
  if (diff === 0) advance = 4;
  else if (yearLike ? diff <= 3 : diff / Math.max(1, Math.abs(answer)) <= 0.1) advance = 2;
  else if (yearLike ? diff <= 10 : diff / Math.max(1, Math.abs(answer)) <= 0.25) advance = 1;

  const truth = guess === answer ? "juste" : answer > guess ? "haut" : "bas";
  const betLines = bets.map(({ pion: p, bet }) => {
    const won = bet === truth;
    if (won) p.pieces += 2;
    return el("p", { class: "bet-result", text: `${won ? "✅" : "❌"} ${p.nom} a parié « ${bet === "haut" ? "trop haut" : bet === "bas" ? "trop bas" : "juste"} »${won ? " : +2 🪙" : ""}` });
  });
  pion.stats.questions += 1;
  if (advance > 0) pion.stats.bonnes += 1;
  save();
  heraldSays(advance > 0 ? herald.bonne() : herald.mauvaise());
  setPanel(
    el("div", { class: "question-block" },
      el("p", { class: "verdict", html: `La vraie réponse était <strong>${answer}</strong> — ${pion.nom} annonçait ${guess}. ${advance > 0 ? `<strong>+${advance} case${advance > 1 ? "s" : ""} !</strong>` : "<strong>Trop loin, pas de bonus.</strong>"}` }),
      ...betLines,
      el("div", { class: "anecdote-card" },
        el("p", { class: "anecdote-title", text: "📜 L'anecdote du Héraut" }),
        el("p", { class: "anecdote-texte", text: q.anecdote }),
      ),
      bigButton("Continuer", () => {
        if (advance !== 0 && shift(pion, advance)) return;
        finishTurn();
      }),
    ),
  );
}

/** Événement: everyone answers the same Vrai/Faux; each correct pion +2 🪙. */
function doEvent() {
  const q = drawEvent();
  if (!q) return endPanel("Pas d'événement disponible — le Donjon improvise une pause.");
  const pions = getState().pions;
  const answers = new Map();
  const rows = pions.map((p) => {
    const row = el("div", { class: "bet-row" }, el("strong", { class: "bet-name", text: p.nom }));
    const group = el("div", { class: "bet-buttons", role: "group", "aria-label": `Réponse de ${p.nom}` });
    for (const choice of q.choix ?? ["Vrai", "Faux"]) {
      const btn = choiceButton(choice, () => {
        answers.set(p.id, choice);
        group.querySelectorAll("button").forEach((b) => b.classList.remove("bet-selected"));
        btn.classList.add("bet-selected");
        if (answers.size === pions.length) validateBtn.disabled = false;
      }, "btn-bet");
      group.append(btn);
    }
    row.append(group);
    return row;
  });
  const validateBtn = bigButton("Révéler !", () => {
    const lines = pions.map((p) => {
      const good = answers.get(p.id) === q.bonne_reponse;
      if (good) p.pieces += 2;
      return el("p", { class: "bet-result", text: `${good ? "✅ +2 🪙" : "❌"} ${p.nom}` });
    });
    save();
    renderPlayersStrip();
    showAnecdoteEvent(q, lines);
  });
  validateBtn.disabled = true;
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🎪 Événement collectif !" }),
      questionHeader(q),
      el("p", { class: "question-texte", text: q.texte }),
      el("p", { class: "help-note", text: "Tout le monde répond ! +2 pièces par bonne réponse." }),
      ...rows,
      validateBtn,
    ),
  );
}

function showAnecdoteEvent(q, lines) {
  setPanel(
    el("div", { class: "question-block" },
      el("p", { class: "verdict", html: `La bonne réponse était : <strong>${q.bonne_reponse}</strong>` }),
      ...lines,
      el("div", { class: "anecdote-card" },
        el("p", { class: "anecdote-title", text: "📜 L'anecdote du Héraut" }),
        el("p", { class: "anecdote-texte", text: q.anecdote }),
      ),
      bigButton("Continuer", () => finishTurn()),
    ),
  );
}

/* ---------- turn end & victory ---------- */

function endPanel(message) {
  setPanel(
    el("p", { class: "panel-text panel-event", text: message }),
    bigButton("Continuer", () => finishTurn()),
  );
}

function finishTurn() {
  const state = getState();
  if (state.finished) return;
  const pion = currentPion();
  pion.doublePieces = false;
  nextTurn();
  startTurn();
}

function finishGame(winner) {
  const state = getState();
  state.finished = true;
  state.ranking = ranking().map((p) => ({
    nom: p.nom,
    characterId: p.characterId,
    position: p.position,
    pieces: p.pieces,
    bonnes: p.stats.bonnes,
    questions: p.stats.questions,
  }));
  save();
  heraldSays(herald.victoire(winner.nom));
  if (onVictory) onVictory(winner, state.ranking);
  return true;
}
