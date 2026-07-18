// Turn engine: dice, case effects, question formats, powers, victory.
// Design rules (documented in README):
//  - only DICE movement triggers case effects; rewards/penalties move the
//    pion without re-triggering, so a turn always terminates;
//  - nothing is ever timed (non-negotiable rule of the cahier des charges);
//  - anecdote after EVERY question, no exception.
import { drawEasier, drawEvent, drawGambit, drawHardest, drawQuestion } from "./data.js";
import { boardById, renderBoard } from "./board.js";
import { herald } from "./herald.js";
import { canRecharge, powerOf, recharge, RECHARGE_COST } from "./powers.js";
import { characterById, clearPendingCase, computeBonusStars, currentPion, getState, isEtoiles, isLast, LAP_BONUS, LAST_ROUND_BONUS, moveStar, nextTurn, porteParole, ranking, save, setPendingCase, starPrice } from "./state.js";
import { bigButton, choiceButton, el, heraldSays, setPanel } from "./ui.js";
import { portraitEl } from "./portraits.js";
import { addItem, BESASSE_COST, consumeItem, hasRoom, INV_BESASSE, inventoryCap, inventoryCount, ITEMS, ownedItems, SHOP_ORDER } from "./items.js";
import { HANGMAN_ALPHABET, hangmanHas, hangmanState, makeAnagram } from "./minigames.js";

/** Seam de test déterministe (jamais posé en jeu réel) : force un mini-jeu
 *  précis, ou une question bonus, pour couvrir ces panneaux en E2E. */
function testFlag(name) {
  return typeof globalThis !== "undefined" ? globalThis[name] : undefined;
}

let onVictory = null;

export function startGame(victoryCallback) {
  onVictory = victoryCallback;
  render();
  // Rituel d'ouverture : le Héraut désigne qui commence (toast loufoque).
  openingToast();
}

export function resumeGame(victoryCallback) {
  onVictory = victoryCallback;
  render();
  // A reload mid-turn resumes at the unresolved case: no free re-roll, no
  // dodging a malus or the Trou Noir by refreshing the page. A case already
  // resolved ("resolu") hands over to the next player instead of re-rolling.
  const pending = getState().pendingCase;
  if (pending === "resolu") {
    finishTurn();
    return;
  }
  if (pending) {
    heraldSays(herald.surCase(pending));
    resolveCase(pending);
    return;
  }
  startTurn({ silent: true });
}

/* ---------- rendering ---------- */

function pionView(p) {
  const c = characterById(p.characterId);
  return { ...p, emoji: c.emoji, couleur: c.couleur };
}

function boardLen() {
  return getState().board.length;
}

function render() {
  const state = getState();
  renderBoard(
    document.getElementById("board"),
    state.board,
    state.pions.map(pionView),
    currentPion().id,
    boardById(state.boardId),
    state.starPos,
  );
  renderPlayersStrip();
}

function renderPlayersStrip() {
  const state = getState();
  const strip = document.getElementById("players");
  strip.innerHTML = "";
  window.requestAnimationFrame(() => {
    strip.querySelector(".player-chip-actif")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  });
  // Bandeau « manche X/N » en mode Étoiles.
  if (isEtoiles()) {
    strip.append(
      el("div", { class: "player-chip round-chip" },
        el("span", { class: "player-emoji", "aria-hidden": "true", text: "⏳" }),
        el("div", { class: "player-info" },
          el("strong", { text: `Manche ${Math.min(state.tour, state.rounds)}/${state.rounds}` }),
          el("span", { class: "player-meta", text: "Le plus d'étoiles gagne" }),
        ),
      ),
    );
  }
  for (const p of ranking()) {
    const power = powerOf(p);
    const sac = inventoryCount(p) > 0 ? ` · 🎒${inventoryCount(p)}/${inventoryCap(p)}` : "";
    const bouclier = p.bouclier ? " · 🛡️" : "";
    const etoiles = isEtoiles() ? `⭐${p.etoiles ?? 0} · ` : "";
    strip.append(
      el("div", { class: "player-chip" + (p.id === currentPion().id ? " player-chip-actif" : "") },
        portraitEl(p.characterId, 34),
        el("div", { class: "player-info" },
          el("strong", { text: p.nom }),
          el("span", {
            class: "player-meta",
            text: `${etoiles}🪙${p.pieces} · 🃏${p.jokers}${sac}${bouclier} · ${power ? (p.pouvoirUtilise ? "pouvoir épuisé" : power.nom) : ""}`,
          }),
        ),
      ),
    );
  }
}

/* ---------- rituel d'ouverture (toast) ---------- */

const TOASTS = [
  "commence : celui qui a mangé le plus récemment.",
  "ouvre le bal : celui dont l'anniversaire est le plus proche d'aujourd'hui.",
  "débute : le plus petit de la table. Oui, on se lève pour comparer.",
  "s'élance : celui qui a les mains les plus froides. Touchez-vous, c'est réglementaire.",
  "commence : le dernier à avoir ri. Ça ne compte pas, ce rire-là.",
  "ouvre la marche : celui qui vit le plus loin du Donjon. À vol de dragon.",
  "démarre : celui qui porte le plus de boutons (vêtements, pas d'ascenseur).",
];

function openingToast() {
  const state = getState();
  const toast = TOASTS[Math.floor(Math.random() * TOASTS.length)];
  heraldSays(`Oyez ! Que ${toast}`);
  const start = (idx) => {
    state.currentIndex = idx;
    save();
    render();
    startTurn();
  };
  const buttons = state.pions.map((p, i) =>
    choiceButton(`${characterById(p.characterId).emoji} C'est ${p.nom} !`, () => start(i)),
  );
  setPanel(
    el("h2", { class: "panel-title", text: "🥂 Le toast du Héraut" }),
    el("p", { class: "panel-text", text: `« Que ${toast} »` }),
    el("p", { class: "help-note", text: "La table désigne l'élu·e — ou laissez le sort trancher." }),
    ...buttons,
    bigButton("🎲 Au hasard !", () => start(Math.floor(Math.random() * state.pions.length))),
  );
}

/* ---------- turn start ---------- */

function startTurn({ silent = false, prefix = "" } = {}) {
  const state = getState();
  if (state.finished) return;
  const pion = currentPion();
  render();
  if (!silent) heraldSays(`${prefix}${herald.debutTour(pion.nom)}`);

  const actions = [bigButton("🎲 Lancer le dé", () => rollDie())];

  // Besace : objets utilisables quand on veut (dés spéciaux, jokers, malus).
  if (inventoryCount(pion) > 0) {
    actions.push(choiceButton(`🎒 Ma besace (${inventoryCount(pion)}/${inventoryCap(pion)})`, () => openBag(pion)));
  }

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

/* ---------- besace : usage d'objets ---------- */

function openBag(pion) {
  const items = ownedItems(pion);
  setPanel(
    el("h2", { class: "panel-title", text: "🎒 Votre besace" }),
    el("p", { class: "help-note", text: "Utilisez un objet, ou refermez pour lancer le dé." }),
    ...items.map((it) =>
      choiceButton(`${it.emoji} ${it.nom}${it.qte > 1 ? ` ×${it.qte}` : ""} — ${it.desc}`, () => useItem(pion, it.id)),
    ),
    bigButton("↩︎ Refermer", () => startTurn({ silent: true })),
  );
}

function useItem(pion, id) {
  const item = ITEMS[id];
  if (!item) return startTurn({ silent: true });
  const others = getState().pions.filter((p) => p.id !== pion.id);

  // Sceptre du Larcin : on ne peut voler qu'un pion QUI a une étoile — sinon on
  // le garde plutôt que de le gaspiller.
  if (id === "sceptre_larcin") {
    const cibles = others.filter((p) => (p.etoiles ?? 0) > 0);
    if (cibles.length === 0) {
      return setPanel(
        el("h2", { class: "panel-title", text: "👑 Sceptre du Larcin" }),
        el("p", { class: "panel-text", text: "Personne n'a d'étoile à dérober pour l'instant. Gardez le sceptre pour un meilleur moment !" }),
        bigButton("↩︎ Retour à la besace", () => openBag(pion)),
      );
    }
    return setPanel(
      el("h2", { class: "panel-title", text: "👑 Voler une étoile — à qui ?" }),
      ...cibles.map((t) => choiceButton(`${characterById(t.characterId).emoji} ${t.nom} (⭐${t.etoiles ?? 0})`, () => applyItem(pion, id, t))),
      bigButton("↩︎ Annuler", () => openBag(pion)),
    );
  }

  // Malus/échange visant autrui : choisir la cible d'abord.
  if (item.cible === "autre") {
    if (others.length === 0) return openBag(pion);
    return setPanel(
      el("h2", { class: "panel-title", text: `${item.emoji} ${item.nom} — sur qui ?` }),
      ...others.map((t) => choiceButton(`${characterById(t.characterId).emoji} ${t.nom}`, () => applyItem(pion, id, t))),
      bigButton("↩︎ Annuler", () => openBag(pion)),
    );
  }
  applyItem(pion, id, null);
}

function rollN(n) {
  let s = 0;
  for (let i = 0; i < n; i++) s += 1 + Math.floor(Math.random() * 6);
  return s;
}

function applyItem(pion, id, target) {
  const item = ITEMS[id];
  consumeItem(pion, id);
  save();
  heraldSays(`${item.emoji} ${item.nom} !`);
  switch (id) {
    case "de_double":
      return showItemDie(rollN(2), "Dé Double");
    case "de_triple":
      return showItemDie(rollN(3), "Dé Triple");
    case "de_choisi":
      return setPanel(
        el("h2", { class: "panel-title", text: "🎯 Dé Choisi — quelle valeur ?" }),
        el("div", { class: "choices bet-grid" },
          ...[1, 2, 3, 4, 5, 6].map((v) => choiceButton(String(v), () => moveAndResolve(v))),
        ),
      );
    case "de_teleport": {
      const dest = 1 + Math.floor(Math.random() * (boardLen() - 2));
      pion.position = dest;
      save();
      render();
      setPendingCase("resolu");
      return endPanel(`🌫️ Le Dé Mirage vous dépose case ${dest}…`, () => landAfterTeleport(pion, dest));
    }
    case "tuyau_or": {
      // Mode Étoiles : droit devant le marchand d'étoile. Course : grand bond
      // vers le Trésor.
      const dest = isEtoiles()
        ? getState().starPos
        : Math.min(boardLen() - 2, pion.position + Math.max(4, Math.floor((boardLen() - pion.position) * 0.6)));
      pion.position = dest;
      save();
      render();
      setPendingCase("resolu");
      return endPanel(`🌀 Le Tuyau d'Or vous propulse case ${dest} !`, () => landAfterTeleport(pion, dest));
    }
    case "de_echange":
      if (target) { [pion.position, target.position] = [target.position, pion.position]; render(); }
      return endPanel(`🔄 Places échangées avec ${target ? target.nom : "personne"} !`);
    case "bouclier":
      pion.bouclier = true;
      save();
      renderPlayersStrip();
      return openBag(pion);
    case "aimant_or":
      pion.aimantOr = true;
      save();
      return openBag(pion);
    case "relance":
      pion.relanceBonus = true;
      save();
      return rollDie();
    case "sabotage":
      if (target) { applyMalusTo(target, () => { target.position = Math.max(0, target.position - 3); render(); }); }
      return endPanel(`💣 ${target ? target.nom : "La cible"} recule de 3 cases !`);
    case "racket":
      if (target) { applyMalusTo(target, () => { const stolen = Math.min(5, target.pieces); target.pieces -= stolen; pion.pieces += stolen; renderPlayersStrip(); }); }
      return endPanel(`🪙 Racket sur ${target ? target.nom : "la cible"} !`);
    case "sceptre_larcin": {
      if (!target) return endPanel("👑 Le Sceptre du Larcin n'a trouvé personne à détrousser.");
      const pare = target.bouclier;
      applyMalusTo(target, () => { if ((target.etoiles ?? 0) > 0) { target.etoiles -= 1; pion.etoiles = (pion.etoiles ?? 0) + 1; renderPlayersStrip(); } });
      return endPanel(pare
        ? `👑🛡️ Le bouclier de ${target.nom} a protégé son étoile ! Le sceptre repart bredouille.`
        : `👑 Le Sceptre du Larcin dérobe une ⭐ à ${target.nom} pour ${pion.nom} !`);
    }
    default:
      return openBag(pion);
  }
}

/** Un malus subi est paré par un bouclier (garde-fou anti-grief). */
function applyMalusTo(target, effect) {
  if (target.bouclier) {
    target.bouclier = false;
    save();
    renderPlayersStrip();
    heraldSays(`🛡️ Le bouclier de ${target.nom} encaisse le coup !`);
    return;
  }
  effect();
  target.malusSubis = (target.malusSubis ?? 0) + 1;
  save();
}

/** Après une téléportation par objet : marchand d'étoile si on tombe dessus, sinon la case. */
function landAfterTeleport(pion, dest) {
  if (isEtoiles() && dest === getState().starPos) return doStar(pion);
  const type = getState().board[dest];
  setPendingCase(type);
  heraldSays(herald.surCase(type));
  resolveCase(type);
}

function showItemDie(value, label) {
  setPanel(
    el("h2", { class: "panel-title", text: `${label} : ${value}` }),
    el("div", { class: "die", "aria-label": `Total : ${value}` }, String(value)),
    bigButton(`Avancer de ${value}`, () => moveAndResolve(value)),
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
  // Fiole de Relance (objet) : une relance, sans toucher au pouvoir.
  if (rerollAvailable && pion.relanceBonus) {
    actions.push(
      choiceButton("🔁 Fiole de Relance — relancer le dé", () => {
        pion.relanceBonus = false;
        save();
        showDieResult(1 + Math.floor(Math.random() * 6), { rerollAvailable: false });
      }),
    );
  }
  setPanel(
    el("div", { class: "die", role: "img", "aria-label": `Dé : ${value}` }, ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value]),
    ...actions,
  );
}

/** Move without triggering the landing case (rewards/penalties).
 *  Returns true if this ended the game (course mode only). */
function shift(pion, delta) {
  const L = boardLen();
  if (isEtoiles()) {
    pion.position = ((pion.position + delta) % L + L) % L; // wrap, no win
    save();
    render();
    return false;
  }
  pion.position = Math.max(0, Math.min(L - 1, pion.position + delta));
  save();
  render();
  if (pion.position >= L - 1) return finishGame(pion);
  return false;
}

function moveAndResolve(steps) {
  const pion = currentPion();
  const L = boardLen();
  const before = pion.position;

  // Position d'arrivée (avec boucle + prime de tour en mode Étoiles).
  let after, laps = 0;
  if (isEtoiles()) {
    const raw = before + steps;
    laps = Math.floor(raw / L);
    after = ((raw % L) + L) % L;
    pion.casesParcourues = (pion.casesParcourues ?? 0) + steps;
  } else {
    after = Math.max(0, Math.min(L - 1, before + steps));
  }
  pion.position = after;
  if (isEtoiles() && laps > 0) addCoins(pion, LAP_BONUS * laps); // prime de tour
  save();
  render();
  // Empêche l'exploit du rechargement en plein déplacement (position déjà
  // sauvegardée ; un reload rendra la main sans relancer le dé).
  setPendingCase("resolu");

  // Course : atteindre le Trésor gagne.
  if (!isEtoiles() && after >= L - 1) return finishGame(pion);

  // Cases TRAVERSÉES depuis le départ (façon Mario Party) : on passe DEVANT la
  // boutique et l'étoile, pas besoin de s'arrêter pile dessus.
  const passed = [];
  if (isEtoiles()) {
    for (let k = 1; k <= steps; k++) passed.push((before + k) % L);
  } else {
    for (let p = before + 1; p <= after; p++) passed.push(p);
  }
  const board = getState().board;
  const stops = [];
  let starSeen = false;
  for (const p of passed) {
    if (isEtoiles() && p === getState().starPos && !starSeen) { stops.push("star"); starSeen = true; }
    if (board[p] === "boutique") stops.push("shop");
  }
  const landingType = board[after];
  const landingIsStop = (isEtoiles() && after === getState().starPos) || landingType === "boutique";

  const resolveLanding = () => {
    if (landingIsStop) return finishTurn(); // déjà proposé comme point de passage
    setPendingCase(landingType);
    heraldSays(laps > 0 ? `Un tour de plateau bouclé, +${LAP_BONUS} 🪙 ! ${herald.surCase(landingType)}` : herald.surCase(landingType));
    resolveCase(landingType);
  };
  // Enchaîne les points de passage, puis résout la case d'arrivée.
  const step = (i) => {
    if (i >= stops.length) return resolveLanding();
    if (stops[i] === "star") return doStar(pion, () => step(i + 1));
    return doBoutique(pion, () => step(i + 1));
  };
  step(0);
}

/* ---------- étoile : l'acheter au marchand itinérant (au passage) ---------- */

function doStar(pion, onDone = null) {
  const done = onDone ?? (() => finishTurn());
  setPendingCase("resolu");
  const prix = starPrice(pion);
  const abordable = pion.pieces >= prix;
  heraldSays(abordable
    ? "Vous passez devant le marchand d'étoile ! Une étoile vous tend les bras."
    : "Le marchand d'étoile vous salue… mais votre bourse pleure. Revenez plus riche.");
  const actions = [];
  if (abordable) {
    actions.push(bigButton(`⭐ Acheter l'étoile (${prix} 🪙)`, () => {
      pion.pieces -= prix;
      pion.etoiles = (pion.etoiles ?? 0) + 1;
      moveStar(); // l'étoile file s'installer ailleurs, au hasard
      save();
      render();
      heraldSays(`Une étoile pour ${pion.nom} ! Le marchand file s'installer ailleurs.`);
      endPanel(`⭐ ${pion.nom} possède maintenant ${pion.etoiles} étoile${pion.etoiles > 1 ? "s" : ""} !`, done);
    }));
  }
  actions.push(bigButton(abordable ? "Garder mon or" : "Continuer", done));
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "⭐ Le Marchand d'Étoile" }),
      el("p", { class: "panel-text", text: `Prix pour vous : ${prix} 🪙 (il grimpe de 5 à chaque étoile déjà obtenue). Votre or : ${pion.pieces} 🪙.` }),
      ...actions,
    ),
  );
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
      setPendingCase("resolu");
      const gain = 6 + Math.floor(Math.random() * 5);
      addCoins(pion, gain);
      return endPanel(`Vous ramassez ${gain} pièces d'or ! 🪙`);
    }
    case "joker":
      setPendingCase("resolu");
      pion.jokers += 1;
      save();
      return endPanel("Vous gagnez une carte Joker ! 🃏 Elle recharge un pouvoir déjà utilisé.");
    case "gambit":
      return doGambit(pion);
    case "trounoir":
      return doTrouNoir(pion);
    case "boutique":
      return doBoutique(pion);
    case "insolite":
      return doInsolite(pion);
    default:
      setPendingCase("resolu");
      return endPanel("Case tranquille. Le Donjon vous laisse souffler.");
  }
}

/* ---------- boutique : dépenser son or en objets ---------- */

function doBoutique(pion, onDone = null) {
  const done = onDone ?? (() => finishTurn());
  setPendingCase("resolu");
  // Le Sceptre du Larcin (vol d'étoile) n'a de sens qu'en mode Étoiles : on ne
  // le propose donc qu'ici, tout en bas et hors de prix, comme un coup d'éclat.
  const shopIds = isEtoiles() ? [...SHOP_ORDER, "sceptre_larcin"] : SHOP_ORDER;
  const render$ = () => {
    const rows = [];
    for (const id of shopIds) {
      const it = ITEMS[id];
      const abordable = pion.pieces >= it.cout && hasRoom(pion);
      const btn = choiceButton(
        `${it.emoji} ${it.nom} — ${it.cout} 🪙 · ${it.desc}`,
        () => {
          if (pion.pieces < it.cout || !hasRoom(pion)) return;
          pion.pieces -= it.cout;
          addItem(pion, id);
          save();
          heraldSays(`Vendu ! ${it.nom} rejoint la besace.`);
          render$();
        },
      );
      if (!abordable) btn.disabled = true;
      rows.push(btn);
    }
    // Besasse Badass : capacité 3 → 6.
    if (!pion.besasse) {
      const b = choiceButton(
        `🧳 Besasse Badass — ${BESASSE_COST} 🪙 · porte jusqu'à ${INV_BESASSE} objets`,
        () => {
          if (pion.pieces < BESASSE_COST) return;
          pion.pieces -= BESASSE_COST;
          pion.besasse = true;
          save();
          heraldSays("La Besasse Badass ! Vos poches deviennent légendaires.");
          render$();
        },
      );
      if (pion.pieces < BESASSE_COST) b.disabled = true;
      rows.push(b);
    }
    setPanel(
      el("h2", { class: "panel-title", text: "🛒 La Boutique du Donjon" }),
      el("p", { class: "help-note", text: `Votre or : ${pion.pieces} 🪙 · besace ${inventoryCount(pion)}/${inventoryCap(pion)}` }),
      ...rows,
      bigButton("Quitter la boutique", done),
    );
  };
  render$();
}

/* ---------- savoir insolite : pure culture, +2 or garantis ---------- */

function doInsolite(pion) {
  setPendingCase("resolu");
  const q = drawQuestion(pion, { formats: ["qcm", "vrai_faux", "gambit_numerique"] });
  const gain = addCoins(pion, 2);
  heraldSays("Savoir insolite ! Nul risque, juste une pépite à ranger dans un coin du crâne.");
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🦩 Savoir insolite" }),
      q ? el("div", { class: "anecdote-card" },
        el("p", { class: "anecdote-title", text: "📜 Le saviez-vous ?" }),
        el("p", { class: "anecdote-texte", text: q.anecdote }),
        (q.sources ?? []).length ? el("div", { class: "sources" }, ...(q.sources ?? []).slice(0, 2).map((s) => {
          let label = "source"; try { label = new URL(s).hostname.replace(/^www\./, ""); } catch { /* */ }
          return el("a", { class: "source-link", href: s, target: "_blank", rel: "noopener noreferrer", text: label });
        })) : null,
      ) : el("p", { class: "panel-text", text: "Le Donjon a épuisé ses pépites… pour l'instant." }),
      el("p", { class: "verdict", html: `+${gain} 🪙 pour votre curiosité.` }),
      bigButton("Continuer", () => finishTurn()),
    ),
  );
}

function addCoins(pion, n) {
  let gain = n;
  if (pion.doublePieces) gain *= 2; // Bonus Comptable (pouvoir Gobelin)
  if (pion.aimantOr) gain *= 2; // Aimant à Or (objet)
  // Filet anti-dernier (esprit 99 %) : le dernier gagne +50 % sur ses gains.
  if (isLast(pion) && n > 0) gain = Math.round(gain * 1.5);
  pion.pieces += gain;
  pion.orGagne = (pion.orGagne ?? 0) + Math.max(0, gain);
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

/** Larcin fortuné : un vol d'étoile GRATUIT (~4 %) offert par la pure chance,
 *  toujours dirigé sur le meneur en étoiles — parable par un bouclier. */
function larcinFortune(voleur, cible) {
  setPendingCase("resolu");
  heraldSays("Un renversement de fortune ! La chance glisse une étoile dans votre besace…");
  const pare = cible.bouclier;
  applyMalusTo(cible, () => {
    if ((cible.etoiles ?? 0) > 0) { cible.etoiles -= 1; voleur.etoiles = (voleur.etoiles ?? 0) + 1; }
  });
  render();
  endPanel(pare
    ? `🍀🛡️ Larcin fortuné ! Mais le bouclier de ${cible.nom} a sauvé son étoile.`
    : `🍀 Larcin fortuné ! ${voleur.nom} subtilise une ⭐ à ${cible.nom} par pure chance !`);
}

function doChance(pion, { forced = null, onDone = null } = {}) {
  setPendingCase("resolu");
  // ~4 % (mode Étoiles, case Chance naturelle) : vol d'étoile gratuit au meneur.
  if (!forced && isEtoiles() && Math.random() < 0.04) {
    const cibles = getState().pions
      .filter((p) => p.id !== pion.id && (p.etoiles ?? 0) > 0)
      .sort((a, b) => (b.etoiles ?? 0) - (a.etoiles ?? 0));
    if (cibles.length > 0) return larcinFortune(pion, cibles[0]);
  }
  const effect = forced ?? CHANCE_EFFECTS[Math.floor(Math.random() * CHANCE_EFFECTS.length)];
  const won = effect.apply(pion) === true; // shift() returns true on victory
  save();
  render();
  if (won) return;
  if (onDone) {
    setPanel(
      el("p", { class: "panel-text panel-event", text: `🍀 ${effect.texte}` }),
      bigButton("Continuer", onDone),
    );
    return;
  }
  endPanel(`🍀 ${effect.texte}`);
}

function doMalus(pion) {
  const effect = MALUS_EFFECTS[Math.floor(Math.random() * MALUS_EFFECTS.length)];
  const power = powerOf(pion);
  const apply = () => {
    setPendingCase("resolu");
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
        setPendingCase("resolu");
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
      // The chosen card resolves, then the turn CONTINUES: the die roll is
      // never sacrificed to the power (same contract as the other powers).
      const useCard = (card) => {
        pion.pouvoirUtilise = true;
        save();
        heraldSays(herald.pouvoir());
        doChance(pion, { forced: card, onDone: () => startTurn({ silent: true }) });
      };
      setPanel(
        el("h2", { class: "panel-title", text: "Petit Trésor — choisissez votre carte Chance !" }),
        choiceButton(`🍀 ${a.texte}`, () => useCard(a)),
        choiceButton(`🍀 ${b.texte}`, () => useCard(b)),
        choiceButton("Annuler", () => startTurn({ silent: true })),
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
  // Variety on classic QCM draws: some become a TTMC-style confidence bet, some
  // a CASH/CARRÉ/DUO risk pick, some a word mini-game DERIVED from the correct
  // answer (anagramme / pendu) — the same verified bank plays many ways.
  if (q.format === "qcm") {
    const forced = testFlag("__DONJON_MINIGAME");
    const eligible = miniGameAnswer(q); // réponse convenant à un anagramme/pendu
    if (eligible && forced === "anagram") return anagramFlow(pion, q);
    if (eligible && forced === "hangman") return hangmanFlow(pion, q);
    const r = Math.random();
    if (r < 0.12) return confianceFlow(pion, q);
    if (r < 0.28) return ccdPicker(pion, q);
    // Mini-jeux désactivés en mode test déterministe (sauf forçage ci-dessus).
    if (!testFlag("__DONJON_TEST") && eligible) {
      if (r < 0.37) return anagramFlow(pion, q);
      if (r < 0.45) return hangmanFlow(pion, q);
    }
  }
  questionFlow(pion, q);
}

/** La bonne réponse d'un QCM convient-elle à un anagramme/pendu ? On veut un
 *  terme ni trop court (trivial) ni trop long (fastidieux), en peu de mots. */
function miniGameAnswer(q) {
  const ans = (q.bonne_reponse ?? "").trim();
  if (!ans) return null;
  const letters = [...ans].filter((c) => /\p{L}/u.test(c)).length;
  if (letters < 4 || letters > 18) return null;
  if (ans.split(/\s+/).length > 3) return null;
  return ans;
}

/** Anagramme (façon Motus/Time's Up) : les lettres de la réponse mélangées ;
 *  on la retrouve à voix haute, la table valide. Récompense d'un QCM. */
function anagramFlow(pion, q) {
  const intro = speakerIntro(pion);
  if (intro) heraldSays(intro);
  heraldSays("Mini-jeu : l'Anagramme ! Ces lettres cachent la réponse — remettez-les dans l'ordre.");
  const { scrambled } = makeAnagram(q.bonne_reponse);
  const container = el("div", { class: "question-block" });
  container.append(
    questionHeader(q, pion),
    el("p", { class: "question-texte", text: q.texte }),
    el("p", { class: "help-note", text: "🔤 Anagramme : réarrangez ces lettres pour trouver la réponse, à voix haute." }),
    el("p", { class: "anagram-letters", "aria-label": `Lettres mélangées : ${scrambled}`, text: scrambled }),
    bigButton("Révéler la réponse", () => setPanel(
      el("div", { class: "question-block" },
        el("p", { class: "reveal-answer", html: `✅ Réponse : <strong>${q.bonne_reponse}</strong>` }),
        el("div", { class: "choices choices-2" },
          choiceButton("👍 Trouvé !", () => resolveAnswer(pion, q, true, ADVANCE.qcm)),
          choiceButton("👎 Raté…", () => resolveAnswer(pion, q, false, ADVANCE.qcm)),
        ),
      ),
    )),
  );
  setPanel(container);
}

/** Pendu (façon Motus) : on devine les lettres de la réponse, 6 erreurs max.
 *  Mot trouvé = bonne réponse ; sinon on peut abandonner. Récompense d'un QCM. */
function hangmanFlow(pion, q) {
  const intro = speakerIntro(pion);
  if (intro) heraldSays(intro);
  heraldSays("Mini-jeu : le Pendu ! Devinez les lettres pour reconstituer la réponse.");
  const answer = q.bonne_reponse;
  const MAX_ERR = 6;
  const guessed = new Set();
  let errors = 0;

  const rerender = () => {
    const { display, revealed } = hangmanState(answer, [...guessed]);
    if (revealed) {
      return setPanel(
        el("div", { class: "question-block" },
          el("p", { class: "hangman-word", text: display }),
          el("p", { class: "reveal-answer", html: `👏 Bravo ! La réponse était bien <strong>${answer}</strong>.` }),
          bigButton("Continuer", () => resolveAnswer(pion, q, true, ADVANCE.qcm)),
        ),
      );
    }
    if (errors >= MAX_ERR) {
      return setPanel(
        el("div", { class: "question-block" },
          el("p", { class: "hangman-word", text: display }),
          el("p", { class: "reveal-answer", html: `❌ Plus d'essais… La réponse était : <strong>${answer}</strong>` }),
          bigButton("Continuer", () => resolveAnswer(pion, q, false, ADVANCE.qcm)),
        ),
      );
    }
    const container = el("div", { class: "question-block" });
    container.append(
      questionHeader(q, pion),
      el("p", { class: "question-texte", text: q.texte }),
      el("p", { class: "hangman-word", "aria-label": `Mot à trouver : ${display}`, text: display }),
      el("p", { class: "help-note", text: `Erreurs : ${errors} / ${MAX_ERR}` }),
    );
    const grid = el("div", { class: "choices hangman-alpha", role: "group", "aria-label": "Lettres à proposer" });
    for (const letter of HANGMAN_ALPHABET) {
      const used = guessed.has(letter);
      const btn = choiceButton(letter, () => {
        if (guessed.has(letter)) return;
        guessed.add(letter);
        if (!hangmanHas(answer, letter)) errors += 1;
        rerender();
      });
      if (used) {
        btn.disabled = true;
        btn.classList.add(hangmanHas(answer, letter) ? "letter-hit" : "letter-miss");
      }
      grid.append(btn);
    }
    container.append(grid, bigButton("J'abandonne — révéler la réponse", () => { errors = MAX_ERR; rerender(); }));
    setPanel(container);
  };
  rerender();
}

function questionFlow(pion, q, { advanceOverride = null, cashMode = null } = {}) {
  // Risk picker first — the spokesperson is announced once, after the pick.
  if (q.format === "cash_carre_duo" && cashMode === null) return ccdPicker(pion, q);

  const intro = speakerIntro(pion);
  if (intro) heraldSays(intro);
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

function questionHeader(q, pion = null) {
  // The answering pion is always named — essential at a 20-player table.
  const who = pion ?? currentPion();
  const c = characterById(who.characterId);
  return el("div", { class: "question-head" },
    el("span", { class: "badge badge-joueur", text: `${c.emoji} ${who.nom}` }),
    el("span", { class: "badge badge-cat", text: q.categorie }),
    el("span", { class: "badge", text: q.niveau_age === "enfant" ? "👶 enfant" : q.niveau_age === "ado" ? "🧢 ado" : "🎩 adulte" }),
    el("span", { class: "badge", text: "★".repeat(q.difficulte ?? 3) }),
  );
}

/** Anecdote block with its source links — served after EVERY question.
 *  Home-made questions show a 🏠 tag instead of sources. */
function anecdoteCardEl(q) {
  if (q.maison) {
    return el("div", { class: "anecdote-card" },
      el("p", { class: "anecdote-title", text: "📜 L'anecdote du Héraut" }),
      el("p", { class: "anecdote-texte", text: q.anecdote }),
      el("p", { class: "help-note", text: "🏠 Question maison — non vérifiée par le Donjon, la table est seule juge !" }),
    );
  }
  const sources = (q.sources ?? []).slice(0, 3).map((src) => {
    let label = "source";
    try {
      label = new URL(src).hostname.replace(/^www\./, "");
    } catch {
      /* keep default label */
    }
    return el("a", { class: "source-link", href: src, target: "_blank", rel: "noopener noreferrer", text: label });
  });
  return el("div", { class: "anecdote-card" },
    el("p", { class: "anecdote-title", text: "📜 L'anecdote du Héraut" }),
    el("p", { class: "anecdote-texte", text: q.anecdote }),
    sources.length > 0 ? el("div", { class: "sources" }, ...sources) : null,
  );
}

/** Powers usable while a question is displayed (Cageot & Duchesse).
 *  `blockCageot` protects special stakes (Trou Noir) from being bypassed. */
function appendQuestionPowers(container, hintZone, pion, q, { cashMode, blockCageot = false }) {
  const power = powerOf(pion);
  if (!power || pion.pouvoirUtilise || power.quand !== "question") return;
  const c = characterById(pion.characterId);
  const zone = el("div", { class: "power-zone" });

  const key = `${pion.characterId}:${pion.profil}`;
  if (blockCageot && (key === "cageot:adulte" || key === "cageot:enfant")) {
    // The Trou Noir keeps its stakes: no CASH shortcut, no easier question.
  } else if (key === "cageot:adulte" && (q.format === "qcm" || (q.format === "cash_carre_duo" && cashMode === "carre"))) {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — répondre CASH (+${ADVANCE.cash} cases)`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir());
      openAnswerFlow(pion, q, { advance: ADVANCE.cash, accepted: [q.bonne_reponse] });
    }));
  } else if (key === "cageot:enfant") {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — question plus facile`, () => {
      // Draw BEFORE consuming: if nothing easier exists, the power is kept.
      const easier = drawEasier(pion, q.difficulte);
      if (!easier) {
        hintZone.append(el("p", { class: "hint", text: "🛡️ Aucune question plus facile en réserve — le pouvoir est conservé." }));
        return;
      }
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir());
      questionFlow(pion, easier);
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

/** Confidence bet on a classic QCM: self-evaluate 1-10 BEFORE seeing it. */
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
      questionHeader(q, pion),
      el("p", { class: "panel-text", text: `Thème : ${q.categorie}. Évaluez votre confiance de 1 à 10 avant de voir la question. Bonne réponse : avancez de la moitié de votre mise. Mise de 6 ou plus ratée : reculez d'une case.` }),
      bets,
    ),
  );
}

/* ---------- answer resolution + anecdote (always) ---------- */

function resolveAnswer(pion, q, correct, advance, { penalty = 0 } = {}) {
  setPendingCase("resolu");
  pion.stats.questions += 1;
  let moveDelta = 0;
  let coinGain = 0;
  if (correct) {
    pion.stats.bonnes += 1;
    moveDelta = advance;
    coinGain = addCoins(pion, 3);
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
  heraldSays(`${herald.anecdote()} ${q.anecdote}`, { speak: false });
  setPanel(
    el("div", { class: "question-block" },
      el("p", { class: "verdict", html: verdictHtml }),
      anecdoteCardEl(q),
      bigButton("Continuer", onContinue),
    ),
  );
}

/* ---------- special cases ---------- */

function doTrouNoir(pion) {
  const q = drawHardest(pion);
  const advance = 3;
  const recul = -6;
  const resolveTrouNoir = (correct) => {
    setPendingCase("resolu");
    pion.stats.questions += 1;
    if (correct) pion.stats.bonnes += 1;
    save();
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
  };
  if (!q) {
    setPendingCase("resolu");
    return endPanel("Le Trou Noir est vide. Il médite.");
  }
  const container = el("div", { class: "question-block trou-noir" });
  container.append(
    el("h2", { class: "panel-title", text: "🕳️ LE TROU NOIR" }),
    el("p", { class: "panel-text", text: "La question la plus redoutable de votre rang. Réussite : +3 cases. Échec : recul de 6 cases. Jamais d'élimination — le Donjon est joueur, pas cruel." }),
    questionHeader(q, pion),
    el("p", { class: "question-texte", text: q.texte }),
  );
  const hintZone = el("div", { class: "hint-zone" });
  container.append(hintZone);
  const choices = q.choix ?? [];
  if (choices.length === 0) {
    // Belt and braces: drawHardest only returns choice questions, but a
    // choix-less one must still never soft-lock the table.
    container.append(
      el("p", { class: "help-note", text: "🗣️ Répondez à voix haute, puis révélez — la table est juge." }),
      bigButton("Révéler la réponse", () => {
        const accepted = q.bonne_reponse ?? String(q.reponse_numerique ?? (q.reponses_acceptees ?? []).join(" · "));
        setPanel(
          el("div", { class: "question-block" },
            el("p", { class: "reveal-answer", html: `✅ Réponse : <strong>${accepted}</strong>` }),
            el("div", { class: "choices choices-2" },
              choiceButton("👍 Bonne réponse !", () => resolveTrouNoir(true)),
              choiceButton("👎 Raté…", () => resolveTrouNoir(false)),
            ),
          ),
        );
      }),
    );
  } else {
    const grid = el("div", { class: `choices ${choices.length === 2 ? "choices-2" : ""}` });
    choices.forEach((choice) => {
      grid.append(choiceButton(choice, () => resolveTrouNoir(choice === q.bonne_reponse)));
    });
    container.append(grid);
  }
  // Hints allowed, but no power may rewrite the Trou Noir's stakes.
  appendQuestionPowers(container, hintZone, pion, q, { cashMode: null, blockCageot: true });
  setPanel(container);
}

/** Gambit: numeric answer + the other pions bet "trop haut / trop bas / juste". */
function doGambit(pion) {
  const q = drawGambit(pion);
  if (!q) {
    // No numeric question fits this pion's age bracket: the case falls back
    // to a classic question rather than serving an adult one to a child.
    heraldSays("Le Gambit se transforme… en question classique ! Le Donjon a ses mystères.");
    return doQuestion();
  }
  const others = getState().pions.filter((p) => p.id !== pion.id);

  const input = el("input", {
    class: "num-input",
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    "aria-label": "Votre réponse numérique",
    placeholder: "Votre nombre…",
  });
  const form = el("form", { class: "question-block" },
    el("h2", { class: "panel-title", text: "🎲 GAMBIT" }),
    questionHeader(q, pion),
    el("p", { class: "question-texte", text: q.texte }),
    el("p", { class: "help-note", text: `${pion.nom} annonce un nombre — puis les autres parieront si la vraie réponse est plus haute, plus basse, ou si c'est juste.` }),
    input,
    el("button", { class: "btn btn-big", type: "submit" }, "Valider mon nombre"),
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = String(input.value).trim();
    const guess = Number(raw.replace(",", ".").replace(/\s+/g, ""));
    if (raw === "" || !Number.isFinite(guess)) {
      input.value = "";
      input.placeholder = "Il faut un nombre !";
      input.focus();
      return;
    }
    if (others.length === 0) return gambitReveal(pion, q, guess, []);
    gambitBets(pion, q, guess, others);
  });
  setPanel(form);
  input.focus();
}

function gambitBets(pion, q, guess, others) {
  const bets = new Map();
  const rows = others.map((p) => {
    const row = el("div", { class: "bet-row" }, el("strong", { class: "bet-name", text: p.nom }));
    const group = el("div", { class: "bet-buttons", role: "group", "aria-label": `Pari de ${p.nom}` });
    for (const [key, label] of [["bas", "⬇️ Trop bas"], ["juste", "🎯 Juste"], ["haut", "⬆️ Trop haut"], ["absent", "🚫"]]) {
      const btn = choiceButton(label, () => {
        bets.set(p.id, key);
        group.querySelectorAll("button").forEach((b) => b.classList.remove("bet-selected"));
        btn.classList.add("bet-selected");
        if (bets.size === others.length) validateBtn.disabled = false;
      }, "btn-bet");
      if (key === "absent") btn.setAttribute("aria-label", `${p.nom} ne parie pas (absent)`);
      group.append(btn);
    }
    row.append(group);
    return row;
  });
  const validateBtn = bigButton("Révéler la vraie réponse", () =>
    gambitReveal(pion, q, guess, others.filter((p) => bets.get(p.id) !== "absent").map((p) => ({ pion: p, bet: bets.get(p.id) }))));
  validateBtn.disabled = true;
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🎲 Les paris sont ouverts !" }),
      el("p", { class: "panel-text", html: `${pion.nom} annonce : <strong>${guess}</strong>. La vraie réponse est-elle plus haute, plus basse, ou est-ce juste ?` }),
      el("p", { class: "help-note", text: "Chaque aventurier place son pari (🚫 pour un joueur absent), puis on révèle." }),
      ...rows,
      validateBtn,
    ),
  );
}

function gambitReveal(pion, q, guess, bets) {
  setPendingCase("resolu");
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
      anecdoteCardEl(q),
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
  if (!q) {
    setPendingCase("resolu");
    return endPanel("Pas d'événement disponible — le Donjon improvise une pause.");
  }
  const pions = getState().pions;
  const answers = new Map();
  const rows = pions.map((p) => {
    const row = el("div", { class: "bet-row" }, el("strong", { class: "bet-name", text: p.nom }));
    const group = el("div", { class: "bet-buttons", role: "group", "aria-label": `Réponse de ${p.nom}` });
    for (const choice of [...(q.choix ?? ["Vrai", "Faux"]), "🚫"]) {
      const btn = choiceButton(choice, () => {
        answers.set(p.id, choice);
        group.querySelectorAll("button").forEach((b) => b.classList.remove("bet-selected"));
        btn.classList.add("bet-selected");
        if (answers.size === pions.length) validateBtn.disabled = false;
      }, "btn-bet");
      if (choice === "🚫") btn.setAttribute("aria-label", `${p.nom} ne répond pas (absent)`);
      group.append(btn);
    }
    row.append(group);
    return row;
  });
  const validateBtn = bigButton("Révéler !", () => {
    setPendingCase("resolu");
    const current = currentPion();
    const lines = pions.map((p) => {
      if (answers.get(p.id) === "🚫") {
        return el("p", { class: "bet-result", text: `🚫 ${p.nom} (absent)` });
      }
      const good = answers.get(p.id) === q.bonne_reponse;
      // addCoins routes through Bonus Comptable for the pion whose turn it is.
      if (good) {
        if (p.id === current.id) addCoins(p, 2);
        else p.pieces += 2;
      }
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
      el("p", { class: "help-note", text: "Tout le monde répond (🚫 pour un joueur absent), puis on révèle — +2 pièces par bonne réponse." }),
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
      anecdoteCardEl(q),
      bigButton("Continuer", () => finishTurn()),
    ),
  );
}

/* ---------- turn end & victory ---------- */

function endPanel(message, onContinue = null) {
  setPanel(
    el("p", { class: "panel-text panel-event", text: message }),
    bigButton("Continuer", onContinue ?? (() => finishTurn())),
  );
}

function finishTurn() {
  const state = getState();
  if (state.finished) return;
  clearPendingCase(); // the turn is truly over — next reload starts fresh
  const pion = currentPion();
  pion.doublePieces = false;
  pion.aimantOr = false; // l'Aimant à Or ne dure qu'un tour
  pion.relanceBonus = false; // relance non utilisée : perdue en fin de tour
  const { skipped } = nextTurn();

  // Mode Étoiles : fin après le nombre de manches fixé.
  if (isEtoiles() && state.tour > state.rounds) {
    return endStarGame();
  }

  let prefix = skipped.length > 0 ? `💤 ${skipped.join(" et ")} passe${skipped.length > 1 ? "nt" : ""} son tour (sieste involontaire) ! ` : "";

  // Coup de pouce de la dernière manche (esprit 99 %) : tout le monde +15 or.
  if (isEtoiles() && state.currentIndex === 0 && state.tour === state.rounds && !state.lastRoundBoost) {
    state.lastRoundBoost = true;
    for (const p of state.pions) p.pieces += LAST_ROUND_BONUS;
    save();
    prefix = `🔔 DERNIÈRE MANCHE ! Chacun reçoit +${LAST_ROUND_BONUS} 🪙 pour un ultime coup d'éclat. ${prefix}`;
  }

  // Question bonus de la tablée (~1 tour sur 7, jamais au tout premier) : tout le
  // monde joue, la première bonne réponse criée rafle l'or. Zéro chronomètre.
  const forceBonus = testFlag("__DONJON_BONUS");
  if (forceBonus || (!testFlag("__DONJON_TEST") && state.tour >= 2 && Math.random() < 0.15)) {
    return teamBonusFlow(() => startTurn({ prefix }));
  }
  startTurn({ prefix });
}

/** Question bonus posée à TOUTE la tablée entre deux tours (esprit Une Famille
 *  en Or / Burger Quiz) : réponse à voix haute, la table désigne le gagnant. */
function teamBonusFlow(onDone) {
  const q = drawEvent(); // question accessible à tous (respecte la règle enfant)
  if (!q) return onDone();
  heraldSays("🔔 QUESTION BONUS ! Toute la tablée joue : la première bonne réponse criée rafle l'or.");
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🔔 Question bonus de la tablée" }),
      el("div", { class: "question-head" }, el("span", { class: "badge badge-cat", text: q.categorie })),
      el("p", { class: "question-texte", text: q.texte }),
      el("p", { class: "help-note", text: "🗣️ Tout le monde peut répondre à voix haute — aucun chronomètre, mais la première bonne réponse l'emporte." }),
      bigButton("Révéler la réponse", () => revealTableBonus(q, onDone)),
    ),
  );
}

function revealTableBonus(q, onDone) {
  const REWARD = 5;
  const accepted = q.bonne_reponse ?? String(q.reponse_numerique ?? (q.reponses_acceptees ?? []).join(" · "));
  const grid = el("div", { class: "choices" });
  for (const p of getState().pions) {
    grid.append(choiceButton(`${characterById(p.characterId).emoji} ${p.nom}`, () => {
      const gained = addCoins(p, REWARD);
      heraldSays(`+${gained} 🪙 pour ${p.nom} ! Le savoir paie toujours.`);
      onDone();
    }));
  }
  setPanel(
    el("div", { class: "question-block" },
      el("p", { class: "reveal-answer", html: `✅ Réponse : <strong>${accepted}</strong>` }),
      anecdoteCardEl(q),
      el("p", { class: "panel-text", text: `Qui a trouvé en premier ? Cette personne (ou son équipe) empoche +${REWARD} 🪙.` }),
      grid,
      bigButton("Personne n'a trouvé", onDone),
    ),
  );
}

function endStarGame() {
  const state = getState();
  state.finished = true;
  clearPendingCase();
  // 3 étoiles bonus de fin (façon Mario Party) : tirées sur des exploits chiffrés,
  // appliquées AVANT le classement final — elles peuvent tout renverser.
  const bonus = computeBonusStars(state.pions, { count: 3 });
  for (const b of bonus) {
    const p = state.pions.find((x) => x.id === b.pionId);
    if (p) p.etoiles = (p.etoiles ?? 0) + 1;
  }
  state.bonusStars = bonus;
  const classement = ranking();
  state.ranking = classement.map((p) => ({
    nom: p.nom,
    characterId: p.characterId,
    etoiles: p.etoiles ?? 0,
    pieces: p.pieces,
    position: p.position,
    bonnes: p.stats.bonnes,
    questions: p.stats.questions,
  }));
  save();
  const winner = classement[0];
  const primes = bonus.length
    ? ` Étoiles bonus : ${bonus.map((b) => `${b.emoji} ${b.nom}`).join(", ")}.`
    : "";
  heraldSays(`Rideau ! ${winner.nom} règne sur le Donjon avec ${winner.etoiles ?? 0} étoile${(winner.etoiles ?? 0) > 1 ? "s" : ""} !${primes}`);
  if (onVictory) onVictory(winner, state.ranking, { bonusStars: bonus });
}

function finishGame(winner) {
  const state = getState();
  clearPendingCase();
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
