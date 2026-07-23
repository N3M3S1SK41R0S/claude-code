// Turn engine: dice, case effects, question formats, powers, victory.
// Design rules (documented in README):
//  - only DICE movement triggers case effects; rewards/penalties move the
//    pion without re-triggering, so a turn always terminates;
//  - nothing is ever timed (non-negotiable rule of the cahier des charges);
//  - anecdote after EVERY question, no exception.
import { commitQuestion, drawEasier, drawEvent, drawEventPair, drawGambit, drawHardest, drawInsolite, drawQuestion } from "./data.js";
import { boardById, renderBoard } from "./board.js";
import { herald } from "./herald.js";
import { canRecharge, POWERS, powerOf, recharge, RECHARGE_COST } from "./powers.js";
import { bumpNiveau, CHARACTERS, characterById, clearPendingCase, computeBonusStars, currentPion, getState, isEtoiles, isLast, LAP_BONUS, LAST_ROUND_BONUS, moveStar, nextTurn, porteParole, ranking, save, setPendingCase, starPrice } from "./state.js";
import { bigButton, choiceButton, el, heraldSays, onPanelRender, setPanel } from "./ui.js";
import { say } from "./tts.js";
import { heroLine, voiceOf } from "./voices.js";
import { botNumericGuess, botWantsCorrect } from "./bots.js";
import { playScene } from "./scene.js";
import { npcPortraitEl, portraitEl } from "./portraits.js";
import { addItem, BESASSE_COST, consumeItem, hasRoom, INV_BESASSE, inventoryCap, inventoryCount, ITEMS, ownedItems, SHOP_ORDER } from "./items.js";
import { HANGMAN_ALPHABET, hangmanHas, hangmanState, makeAnagram } from "./minigames.js";
import { drawDefi } from "./wordgames.js";
import { chipStyle, softStyle, THEME_META, THEME_ORDER, themeMeta, TYPE_META, TYPE_ORDER, typeMeta } from "./themes.js";
import { sfx } from "./sfx.js";

/** Seam de test déterministe (jamais posé en jeu réel) : force un mini-jeu
 *  précis, ou une question bonus, pour couvrir ces panneaux en E2E. */
function testFlag(name) {
  return typeof globalThis !== "undefined" ? globalThis[name] : undefined;
}

let onVictory = null;

/* ---------- pilote de bots : joue automatiquement le tour d'un joueur bot ---------- */

let botTimer = null;

/** Programme la prochaine action du bot (petit délai pour qu'on le voie jouer). */
function scheduleBot(delay = 800) {
  if (botTimer) { clearTimeout(botTimer); botTimer = null; }
  const st = getState();
  if (!st || st.finished) return;
  botTimer = window.setTimeout(botAct, testFlag("__DONJON_BOTFAST") ? 15 : delay);
}

function botClick(btn) {
  if (!btn) return;
  try { btn.click(); } catch { /* ignore */ }
  scheduleBot(); // enchaîne l'action suivante
}

/** Choisit une mauvaise réponse (pour un bot qui « rate »). */
function botPickWrong(choices, good) {
  const wrong = choices.filter((c) => c !== good);
  return (wrong.length ? wrong : choices)[Math.floor(Math.random() * (wrong.length || choices.length))];
}

/** Inspecte le panneau courant et joue à la place du bot dont c'est le tour.
 *  Toujours défensif : on trouve TOUJOURS un bouton pour avancer (anti-blocage). */
function botAct() {
  botTimer = null;
  const st = getState();
  if (!st || st.finished) return;
  const panel = document.getElementById("panel");
  if (!panel) return;
  const btns = [...panel.querySelectorAll("button:not([disabled])")].filter((b) => b.offsetParent !== null || true);
  const byText = (re) => btns.find((b) => re.test(b.textContent || ""));

  // (A) Groupe de paris/réponses appartenant à un bot (Gambit ou événement
  // collectif), même quand le lanceur est humain.
  const betGroup = [...panel.querySelectorAll(".bet-buttons[data-bot='1']")]
    .find((g) => g.querySelector(".bet-selected") === null);
  if (betGroup) {
    const opts = [...betGroup.querySelectorAll("button")];
    const good = betGroup.querySelector("button[data-good='1']");
    let pick;
    if (good) {
      // Question de connaissance (événement) : juste selon le niveau du bot.
      if (botWantsCorrect(betGroup.dataset.level)) pick = good;
      else { const wrong = opts.filter((b) => b !== good && b.textContent !== "🚫"); pick = wrong[Math.floor(Math.random() * wrong.length)] ?? opts[0]; }
    } else {
      // Pari du Gambit (mise) : au hasard parmi Plus / Égal / Moins.
      pick = opts[Math.floor(Math.random() * Math.max(1, Math.min(3, opts.length)))];
    }
    return botClick(pick);
  }

  const pion = currentPion();
  if (!pion || !pion.bot) return; // le reste ne concerne que le tour d'un bot

  // (B) Lancer le dé, (C) avancer.
  const roll = byText(/Lancer le dé/); if (roll) return botClick(roll);
  const adv = byText(/Avancer de \d/); if (adv) return botClick(adv);

  // (D) Question à choix : le bot vise le bon selon son niveau.
  const choices = [...panel.querySelectorAll(".choices .btn-choice:not([disabled])")];
  if (choices.length) {
    const good = choices.find((c) => c.dataset.good === "1");
    const pick = (good && botWantsCorrect(pion.botLevel)) ? good : botPickWrong(choices, good);
    return botClick(pick);
  }

  // (E) Gambit numérique : le bot saisit un nombre (juste selon son niveau).
  const num = panel.querySelector(".num-input");
  const valider = byText(/Valider mon nombre/);
  if (num && valider) {
    const target = Number(num.dataset.answer);
    num.value = String(Number.isFinite(target) ? botNumericGuess(target, pion.botLevel) : 1 + Math.floor(Math.random() * 100));
    return botClick(valider);
  }

  // (F) Boutique : un bot ne fait pas ses courses, il repart.
  const quitShop = byText(/Quitter la boutique/); if (quitShop) return botClick(quitShop);

  // (G) Boutons génériques (continuer, révéler, valider, subir, découvrir…).
  const gen = byText(/Découvrir|Continuer|Révéler|Valider les gagnants|Valider|Subir|Garder|Personne n'a trouvé|au meneur seul|J'abandonne|Quitter|Au hasard/);
  if (gen) return botClick(gen);

  // (H) Dernier recours : le premier bouton disponible (jamais de blocage).
  if (btns.length) return botClick(btns[0]);
}

/** Marque les boutons de choix d'une grille comme bon/mauvais (pour le pilote de
 *  bots), en comparant leur texte à la bonne réponse. */
function markGood(grid, answer) {
  grid.querySelectorAll(".btn-choice").forEach((b) => {
    b.dataset.good = b.textContent === answer ? "1" : "0";
  });
}

/** Branche le pilote de bots sur chaque rendu de panneau. */
onPanelRender(() => scheduleBot());

// Garantie « une question par tour, quelle que soit la case » : ce drapeau est
// remis à zéro au début de chaque tour, puis passe à true dès qu'une VRAIE
// question individuelle est posée au joueur qui a lancé le dé (case Question,
// Insolite, Gambit, Trou Noir, quiz de PNJ, esquive de malus, défi Expression).
// finishTurn() en pose une d'office si la case n'en a pas déjà donné.
let qPosedThisTurn = false;
function markQuestionPosed() { qPosedThisTurn = true; }

/** Réplique de personnage : petite bulle (portrait + texte) sous le Héraut, et
 *  voix propre au héros si le Héraut vocal est activé. Silencieux pour un
 *  personnage sans répliques (repli discret). */
function charSays(pion, moment) {
  const txt = heroLine(pion?.characterId, moment);
  if (!txt) return;
  const zone = document.getElementById("herald-zone");
  if (zone) {
    zone.append(
      el("div", { class: "char-bubble", role: "status", "aria-live": "polite" },
        portraitEl(pion.characterId, 40),
        el("p", { class: "char-text", text: `${pion.nom} : « ${txt} »` }),
      ),
    );
  }
  say(txt, { ...voiceOf(pion.characterId), queue: true });
}

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

/* ---------- aide-mémoire (consultable à tout moment) ---------- */

function refSection(title) {
  return el("h3", { class: "ref-section", text: title });
}

function legendChip(color, label, note = "") {
  return el("div", { class: "ref-chip" },
    el("span", { class: "ref-swatch badge", style: chipStyle(color), text: label }),
    note ? el("span", { class: "ref-note", text: note }) : null,
  );
}

/** Panneau superposé : règles, types & thèmes colorés, pouvoirs, objets.
 *  Ouvrable à tout moment depuis le plateau (bouton 📖 de la barre du haut). */
export function openReference() {
  document.querySelector(".ref-overlay")?.remove();
  const pions = getState()?.pions ?? [];
  const overlay = el("div", { class: "ref-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Aide-mémoire du Donjon" });
  const close = () => overlay.remove();
  const card = el("div", { class: "ref-card" });

  card.append(
    el("div", { class: "ref-head" },
      el("h2", { class: "ref-title", text: "📖 Aide-mémoire" }),
      el("button", { class: "btn btn-small", type: "button", "aria-label": "Fermer l'aide-mémoire", onclick: close }, "✕"),
    ),
    refSection("Comment on joue"),
    el("ul", { class: "ref-list" },
      el("li", { text: "🎲 À son tour : lancez le dé, avancez, subissez la case." }),
      el("li", { text: "🎒 Un seul objet par tour — la besace se grise une fois l'objet utilisé." }),
      el("li", { text: "🎯 Le thème est annoncé avant chaque question ; parfois, choisissez entre deux thèmes." }),
      el("li", { text: "📜 Une anecdote sourcée suit CHAQUE question. Jamais de chronomètre." }),
      el("li", { text: "🏁 Course : premier au Trésor. ⭐ Étoiles : le plus d'étoiles après les manches choisies." }),
    ),
    refSection("Types de questions"),
  );
  const tl = el("div", { class: "ref-legend" });
  for (const f of TYPE_ORDER) { const ty = TYPE_META[f]; tl.append(legendChip(ty.color, `${ty.emoji} ${ty.label}`, ty.regle)); }
  card.append(tl, refSection("Thèmes"));
  const thl = el("div", { class: "ref-legend ref-legend-themes" });
  for (const name of THEME_ORDER) { const t = THEME_META[name]; thl.append(legendChip(t.color, `${t.emoji} ${name}`)); }
  card.append(thl, refSection("Pouvoirs des joueurs"));
  if (pions.length) {
    for (const p of pions) {
      const pw = powerOf(p);
      const c = characterById(p.characterId);
      card.append(el("p", { class: "ref-line" },
        el("strong", { text: `${c.emoji} ${p.nom} — ${c.nom}` }),
        el("span", { text: pw ? ` : ${pw.nom} — ${pw.desc}${p.pouvoirUtilise ? " (épuisé)" : ""}` : "" }),
      ));
    }
  } else {
    for (const c of CHARACTERS) {
      const set = POWERS[c.id];
      card.append(el("p", { class: "ref-line" },
        el("strong", { text: `${c.emoji} ${c.nom}` }),
        el("span", { text: ` : 🎩 ${set.adulte.nom} · 👶 ${set.enfant.nom}` }),
      ));
    }
  }
  card.append(refSection("Objets de la boutique"));
  for (const id of SHOP_ORDER) {
    const it = ITEMS[id];
    if (!it) continue;
    card.append(el("p", { class: "ref-line" },
      el("strong", { text: `${it.emoji} ${it.nom}` }),
      el("span", { text: ` (${it.cout} 🪙) : ${it.desc}` }),
    ));
  }
  overlay.append(card);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  document.body.append(overlay);
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
  qPosedThisTurn = false; // nouveau tour : la question du tour reste à poser
  const pion = currentPion();
  render();
  if (!silent) { heraldSays(`${prefix}${herald.debutTour(pion.nom)}`); charSays(pion, "tour"); }

  const actions = [bigButton("🎲 Lancer le dé", () => rollDie())];

  // Besace : UN seul objet par tour ; on peut ensuite quand même lancer le dé.
  if (inventoryCount(pion) > 0 && !pion.objetUtilise) {
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

/** Icône d'objet : image 3D peinte, repli sur l'emoji si elle manque. */
function itemIconEl(it) {
  const span = el("span", { class: "item-icon" });
  span.innerHTML = `<span class="item-emoji">${it.emoji}</span>`;
  if (it.art) {
    const img = document.createElement("img");
    img.className = "item-art";
    img.alt = "";
    img.decoding = "async";
    img.src = it.art;
    img.onerror = () => img.remove(); // repli : l'emoji reste
    span.appendChild(img);
  }
  return span;
}

/** Bouton d'objet (boutique / besace) : icône 3D + libellé. */
function itemButton(it, labelHtml, onclick) {
  return el("button", { class: "btn btn-choice btn-item", type: "button", onclick },
    itemIconEl(it),
    el("span", { class: "btn-item-text", html: labelHtml }),
  );
}

function openBag(pion) {
  const items = ownedItems(pion);
  setPanel(
    el("h2", { class: "panel-title", text: "🎒 Votre besace" }),
    el("p", { class: "help-note", text: "Utilisez un objet, ou refermez pour lancer le dé." }),
    ...items.map((it) =>
      itemButton(it, `<strong>${it.nom}</strong>${it.qte > 1 ? ` ×${it.qte}` : ""} — ${it.desc}`, () => useItem(pion, it.id)),
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

/** Après un objet « de soutien » (bouclier, aimant, malus, échange) : on REND la
 *  main au joueur pour qu'il puisse encore lancer le dé ce tour-ci (la besace est
 *  désormais fermée : un seul objet par tour). */
function afterItem(message) {
  setPanel(
    el("p", { class: "panel-text panel-event", text: message }),
    bigButton("🎲 Continuer mon tour", () => startTurn({ silent: true })),
  );
}

function applyItem(pion, id, target) {
  const item = ITEMS[id];
  consumeItem(pion, id);
  pion.objetUtilise = true; // un seul objet par tour ; la besace se referme
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
      return afterItem(`🔄 Places échangées avec ${target ? target.nom : "personne"} ! À vous de lancer le dé.`);
    case "bouclier":
      pion.bouclier = true;
      save();
      renderPlayersStrip();
      return afterItem("🛡️ Bouclier en main : le prochain malus ou vol sera paré. À vous de lancer le dé.");
    case "aimant_or":
      pion.aimantOr = true;
      save();
      return afterItem("🧲 Aimant à Or actif : l'or gagné ce tour est doublé. À vous de lancer le dé.");
    case "relance":
      pion.relanceBonus = true;
      save();
      return rollDie();
    case "sabotage":
      if (target) { applyMalusTo(target, () => { target.position = Math.max(0, target.position - 3); render(); }); }
      return afterItem(`💣 ${target ? target.nom : "La cible"} recule de 3 cases ! À vous de lancer le dé.`);
    case "racket":
      if (target) { applyMalusTo(target, () => { const stolen = Math.min(5, target.pieces); target.pieces -= stolen; pion.pieces += stolen; renderPlayersStrip(); }); }
      return afterItem(`🪙 Racket sur ${target ? target.nom : "la cible"} ! À vous de lancer le dé.`);
    case "sceptre_larcin": {
      if (!target) return afterItem("👑 Le Sceptre du Larcin n'a trouvé personne à détrousser. À vous de lancer le dé.");
      const pare = target.bouclier;
      applyMalusTo(target, () => { if ((target.etoiles ?? 0) > 0) { target.etoiles -= 1; pion.etoiles = (pion.etoiles ?? 0) + 1; renderPlayersStrip(); } });
      return afterItem(pare
        ? `👑🛡️ Le bouclier de ${target.nom} a protégé son étoile ! À vous de lancer le dé.`
        : `👑 Le Sceptre du Larcin dérobe une ⭐ à ${target.nom} pour ${pion.nom} ! À vous de lancer le dé.`);
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
  sfx("dice");
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
        heraldSays(herald.pouvoir()); sfx("power");
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
    // Course : on compte les cases réellement avancées (bornées à l'arrivée).
    pion.casesParcourues = (pion.casesParcourues ?? 0) + Math.max(0, after - before);
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
  if (!pion.bot) playScene("etoile", pion.characterId); // saynète du marchand d'étoiles
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
      sfx("star");
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
      sfx("coin");
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
    case "expression":
      return doExpression(pion);
    default:
      setPendingCase("resolu");
      return endPanel("Case tranquille. Le Donjon vous laisse souffler.");
  }
}

/* ---------- boutique : dépenser son or en objets ---------- */

function doBoutique(pion, onDone = null) {
  const done = onDone ?? (() => finishTurn());
  setPendingCase("resolu");
  // Bot : il ne fait pas ses courses, il salue le marchand et repart.
  if (pion.bot) { heraldSays(`🛒 ${pion.nom} jette un œil à la boutique et poursuit sa route.`); return done(); }
  sfx("chest");
  playScene("boutique", pion.characterId); // saynète d'arrivée à l'échoppe

  // Le Sceptre du Larcin (vol d'étoile) n'a de sens qu'en mode Étoiles : on ne
  // le propose donc qu'ici, tout en bas et hors de prix, comme un coup d'éclat.
  const shopIds = isEtoiles() ? [...SHOP_ORDER, "sceptre_larcin"] : SHOP_ORDER;
  const render$ = () => {
    const rows = [];
    for (const id of shopIds) {
      const it = ITEMS[id];
      const abordable = pion.pieces >= it.cout && hasRoom(pion);
      const btn = itemButton(
        it,
        `<strong>${it.nom}</strong> — ${it.cout} 🪙 · ${it.desc}`,
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
  // Bot : question à choix jouable en automatique (on garde la saveur insolite
  // pour les humains).
  if (pion.bot) {
    const bq = drawQuestion(pion, { formats: ["qcm", "vrai_faux"] });
    if (!bq) { setPendingCase("resolu"); const g = addCoins(pion, 2); return endPanel(`🦩 +${g} 🪙 pour la curiosité.`); }
    heraldSays("🦩 Savoir insolite : une question pour le bot !");
    return questionFlow(pion, bq);
  }
  playScene("insolite", pion.characterId); // saynète du savoir insolite
  // Case 🦩 : une VRAIE question, un brin farfelue (catégorie « Insolite » de
  // préférence), posée et récompensée comme une question normale.
  const q = drawInsolite(pion);
  if (!q) {
    setPendingCase("resolu");
    const gain = addCoins(pion, 2);
    return endPanel(`🦩 Le Donjon a épuisé ses pépites insolites… +${gain} 🪙 pour la curiosité.`);
  }
  heraldSays("🦩 Savoir insolite : une vraie question, un brin farfelue !");
  themeRevealGate(pion, q);
}

/* ---------- défi d'expression : Tabou / Password / Mime, à la tablée ---------- */

const EXPRESSION_KIND = {
  tabou: {
    titre: "🚫 Tabou",
    passerelle: "Faites deviner ce mot… SANS prononcer les mots interdits !",
    consigne: (d) => `Faites deviner « ${d.mot} » sans jamais dire : ${(d.interdits ?? []).join(", ")}.`,
    cible: (d) => d.mot,
  },
  password: {
    titre: "🔑 Password",
    passerelle: "Un seul mot d'indice à la fois — jamais le mot lui-même, ni un mot de la même famille.",
    consigne: (d) => `Faites deviner « ${d.mot} » en lançant des indices d'UN SEUL mot, chacun son tour.`,
    cible: (d) => d.mot,
  },
  mime: {
    titre: "🤫 Mime",
    passerelle: "En silence, tout est dans le geste : mimez, ne dites pas un mot !",
    consigne: (d) => `Mimez « ${d.expression} » — sans parler, sans bruitage.`,
    cible: (d) => d.expression,
  },
  pictionary: {
    titre: "✏️ Pictionary",
    passerelle: "Prenez une feuille et un crayon : dessinez le mot, sans écrire ni parler !",
    consigne: (d) => `Dessinez « ${d.mot} » pour le faire deviner. Interdit : écrire une lettre ou un chiffre, et parler.`,
    cible: (d) => d.mot,
  },
};

/**
 * Case 🎭 : le pion actif est le MENEUR, la tablée devine (Tabou/Password/Mime).
 * Aucun chronomètre — la table déclare qui a trouvé. Réussite : le meneur avance
 * (+2 cases, +3 🪙) et celui qui a deviné empoche +3 🪙. Solo : petit entraînement.
 */
function doExpression(pion) {
  setPendingCase("resolu");
  // Bot meneur : il ne peut ni mimer ni dessiner — on résout d'office (petit
  // gain), le jeu continue sans bloquer.
  if (pion.bot) {
    markQuestionPosed();
    const g = addCoins(pion, 2);
    return endPanel(`🎭 ${pion.nom} tente un défi d'expression… et empoche +${g} 🪙 pour l'effort.`);
  }
  playScene("expression", pion.characterId); // saynète du défi d'expression
  const hasChild = getState().pions.some((p) => p.profil === "enfant");
  const forceType = testFlag("__DONJON_PICTIONARY") ? "pictionary" : null;
  const d = drawDefi({ hasChild, type: forceType });
  if (!d) { addCoins(pion, 2); return endPanel("🎭 La malle aux défis est vide pour l'instant. +2 🪙 pour la peine."); }
  markQuestionPosed(); // le défi d'expression tient lieu de challenge du tour
  const kind = EXPRESSION_KIND[d.type] ?? EXPRESSION_KIND.mime;
  const meneur = speakerName(pion);
  const others = getState().pions.filter((p) => p.id !== pion.id);
  heraldSays(`🎭 Défi d'expression : ${kind.titre.replace(/^\S+\s/, "")} ! À ${meneur} de faire deviner.`); sfx("defi");

  // Solo : personne à qui faire deviner — un tour d'entraînement récompensé.
  if (others.length === 0) {
    const gain = addCoins(pion, 2);
    return setPanel(
      el("div", { class: "question-block" },
        el("h2", { class: "panel-title", text: `🎭 ${kind.titre}` }),
        el("p", { class: "question-texte", text: kind.cible(d) }),
        el("p", { class: "help-note", text: `Entraînez-vous à le faire deviner. +${gain} 🪙 pour l'artiste !` }),
        bigButton("Continuer", () => finishTurn()),
      ),
    );
  }

  // 1) Écran passé au meneur seul (les autres ne regardent pas).
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: `🎭 ${kind.titre}` }),
      el("p", { class: "panel-text", text: `${meneur} prend l'appareil et le garde face à soi. Les autres, on ne triche pas 🙈` }),
      el("p", { class: "help-note", text: kind.passerelle }),
      bigButton("🙈 Révéler le défi (au meneur seul)", () => revealExpression(pion, d, kind, others)),
    ),
  );
}

function revealExpression(pion, d, kind, others) {
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: `🎭 ${kind.titre}` }),
      el("p", { class: "question-texte", text: kind.cible(d) }),
      d.type === "tabou"
        ? el("p", { class: "help-note", text: `Interdits : ${(d.interdits ?? []).join(" · ")}` })
        : el("p", { class: "help-note", text: kind.consigne(d) }),
      el("p", { class: "badge badge-cat", text: d.theme }),
      bigButton("Continuer : je fais deviner à la tablée", () => resolveExpression(pion, d, kind, others)),
    ),
  );
}

function resolveExpression(pion, d, kind, others) {
  const REWARD_MENEUR_CASES = 2;
  const REWARD_MENEUR_OR = 3;
  const REWARD_DEVINEUR = 3;
  const onFound = (guesser) => {
    setPendingCase("resolu");
    const gOr = addCoins(pion, REWARD_MENEUR_OR);
    const gDev = addCoins(guesser, REWARD_DEVINEUR);
    heraldSays(`Trouvé par ${guesser.nom} ! ${pion.nom} +${gOr} 🪙 et +${REWARD_MENEUR_CASES} cases, ${guesser.nom} +${gDev} 🪙.`);
    setPanel(
      el("div", { class: "question-block" },
        el("p", { class: "verdict", html: `🎉 <strong>${guesser.nom}</strong> a deviné « ${kind.cible(d)} » !` }),
        el("p", { class: "panel-text", text: `Communication réussie : tout le monde y gagne.` }),
        bigButton("Continuer", () => { if (shift(pion, REWARD_MENEUR_CASES)) return; finishTurn(); }),
      ),
    );
  };
  const onMiss = () => {
    setPendingCase("resolu");
    const g = addCoins(pion, 1);
    heraldSays("Pas trouvé cette fois — mais l'important, c'est de participer !");
    endPanel(`🎭 La réponse était « ${kind.cible(d)} ». +${g} 🪙 au meneur pour l'effort.`);
  };
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: `🎭 ${kind.titre}` }),
      el("p", { class: "panel-text", text: "Qui a trouvé ? (aucun chronomètre — la table est juge)" }),
      el("div", { class: "choices" },
        ...others.map((o) => choiceButton(`${characterById(o.characterId).emoji} ${o.nom}`, () => onFound(o))),
      ),
      bigButton("Personne n'a trouvé", onMiss),
    ),
  );
}

/** Nom à afficher pour le meneur (porte-parole tournant en équipe). */
function speakerName(pion) {
  const membre = porteParole(pion);
  return membre ? `${membre.nom} (équipe ${pion.nom})` : pion.nom;
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
  { texte: "Un lutin farceur vous pousse… vers l'avant ! +2 cases.", apply: (p) => shift(p, 2) },
  { texte: "Un trèfle à quatre feuilles pousse à vos pieds : +1 Joker.", apply: (p) => void (p.jokers += 1) },
  { texte: "Une chauve-souris laisse tomber une pièce en plein vol : +2 pièces.", apply: (p) => void addCoins(p, 2) },
  { texte: "Un marchand généreux vide sa besace pour vous : +4 pièces.", apply: (p) => void addCoins(p, 4) },
  { texte: "Vous glissez sur une peau de banane… enchantée : +2 cases vers l'avant !", apply: (p) => shift(p, 2) },
  { texte: "Le Héraut vous applaudit et vous ouvre un passage : +3 cases.", apply: (p) => shift(p, 3) },
  { texte: "Une luciole vous éclaire un sentier caché : +1 case et +1 pièce.", apply: (p) => { addCoins(p, 1); return shift(p, 1); } },
  { texte: "Un écureuil vous offre sa réserve de noisettes dorées : +3 pièces.", apply: (p) => void addCoins(p, 3) },
  { texte: "Le vent de la chance gonfle votre cape : +2 cases.", apply: (p) => shift(p, 2) },
  { texte: "Une fontaine magique déborde de piécettes : +4 pièces.", apply: (p) => void addCoins(p, 4) },
];

const MALUS_EFFECTS = [
  { texte: "Une dalle piégée ! Reculez de 2 cases.", apply: (p) => shift(p, -2) },
  { texte: "Un escalier glissant ! Reculez de 3 cases.", apply: (p) => shift(p, -3) },
  { texte: "Un péage de gobelins : −3 pièces.", apply: (p) => void (p.pieces = Math.max(0, p.pieces - 3)) },
  { texte: "Une sieste involontaire : vous passez votre prochain tour.", apply: (p) => void (p.tourASauter = true) },
  { texte: "Petite chute : reculez d'1 case.", apply: (p) => shift(p, -1) },
  { texte: "Un nuage grognon vous trempe : −2 pièces pour vous sécher.", apply: (p) => void (p.pieces = Math.max(0, p.pieces - 2)) },
  { texte: "Des corbeaux chapardeurs raflent votre goûter : −2 pièces.", apply: (p) => void (p.pieces = Math.max(0, p.pieces - 2)) },
  { texte: "Un pont-levis capricieux se referme : reculez de 2 cases.", apply: (p) => shift(p, -2) },
  { texte: "Une flaque de boue collante : reculez d'1 case (et vos chaussettes puent).", apply: (p) => shift(p, -1) },
  { texte: "Un feu follet taquin vous fait tourner en rond : reculez de 2 cases.", apply: (p) => shift(p, -2) },
  { texte: "Un lutin péagiste réclame son dû : −3 pièces.", apply: (p) => void (p.pieces = Math.max(0, p.pieces - 3)) },
  { texte: "Une toile d'araignée géante vous colle sur place : reculez d'1 case.", apply: (p) => shift(p, -1) },
  { texte: "Un troll grincheux vous chipe votre goûter : −2 pièces.", apply: (p) => void (p.pieces = Math.max(0, p.pieces - 2)) },
];

/* ---------- rencontres de PNJ (drôles) : parfois une vraie question ---------- */
const NPCS = [
  { emoji: "🧙", nom: "Merlinouche l'Étourdi", slug: "merlinouche", quiz: true,
    intro: "« Aaah, un aventurier ! J'ai encore raté ma potion… réponds juste et je te change un caillou en or ! »",
    demande: "Bonne réponse = le magot. Sinon, ça sentira le chou.",
    reward: { texte: "+4 🪙", apply: (p) => void addCoins(p, 4) },
    rate: "La potion fait « splotch » et sent le chou bouilli. Rien de grave." },
  { emoji: "🐲", nom: "Biscornu le Dragonnet", slug: "biscornu", quiz: true,
    intro: "« Grrr… enfin, miaou. Réponds à mon énigme et je te souffle un p'tit trésor (pas de feu, promis). »",
    demande: "Bonne réponse : le dragonnet crache 3 pièces.",
    reward: { texte: "+3 🪙", apply: (p) => void addCoins(p, 3) },
    rate: "Le dragonnet boude et recrache une chaussette calcinée." },
  { emoji: "🦉", nom: "Maître Hibou de Passage", slug: "hibou-passage", quiz: true,
    intro: "« Hou hou ! Une petite colle pour un esprit bien affûté ? »",
    demande: "Réussite : le hibou vous glisse un Joker.",
    reward: { texte: "+1 Joker", apply: (p) => void (p.jokers += 1) },
    rate: "Le hibou hoche la tête, déçu mais bienveillant." },
  { emoji: "🎪", nom: "Barnabé le Bateleur", slug: "barnabe", quiz: true,
    intro: "« Approchez, approchez ! Une devinette, un cadeau ! »",
    demande: "Bonne réponse : +2 cases vers la gloire.",
    reward: { texte: "+2 cases", apply: (p) => shift(p, 2) },
    rate: "Barnabé sort un lapin de son chapeau… non, une carotte. Dommage." },
  { emoji: "🐭", nom: "Roquefort le Mulot Marchand", slug: "roquefort", plain: true,
    intro: "« Psst ! Un raccourci sous les racines, ça t'dit ? Suis-moi ! »",
    effet: { texte: "+2 cases", apply: (p) => shift(p, 2) } },
  { emoji: "🧚", nom: "Fée Bricole", slug: "fee-bricole", plain: true,
    intro: "« Tiens, un petit sort de chance — je l'avais en double ! »",
    effet: { texte: "+1 Joker", apply: (p) => void (p.jokers += 1) } },
  { emoji: "👻", nom: "Boubou le Fantôme Timide", slug: "boubou", plain: true,
    intro: "« Bouh… oh pardon, j'voulais pas faire peur. Tiens, un bonbon-pièce. »",
    effet: { texte: "+2 🪙", apply: (p) => void addCoins(p, 2) } },
  { emoji: "🧟", nom: "Gérard le Squelette Poli", slug: "gerard", plain: true,
    intro: "« Auriez-vous deux pièces pour un os de rechange ? Merci infiniment, très aimable. »",
    effet: { texte: "−2 🪙", apply: (p) => void (p.pieces = Math.max(0, p.pieces - 2)) } },
  { emoji: "🐌", nom: "Turbo l'Escargot", slug: "turbo", plain: true,
    intro: "« Suis-moi, je connais un raccourci ! …enfin, dès que j'y arrive. »",
    effet: { texte: "−1 case (Turbo n'est pas si rapide)", apply: (p) => shift(p, -1) } },
  { emoji: "🧌", nom: "Groumf le Troll Gentil", slug: "groumf", quiz: true,
    intro: "« Moi Groumf. Moi pas manger toi si toi réponds bien. Marché ? »",
    demande: "Bonne réponse : Groumf partage son casse-croûte (+3 🪙).",
    reward: { texte: "+3 🪙", apply: (p) => void addCoins(p, 3) },
    rate: "Groumf hausse les épaules et croque un caillou. Rien pour vous." },
  { emoji: "🦝", nom: "Ratichon le Chapardeur Repenti", slug: "ratichon", quiz: true,
    intro: "« J'ai arrêté de voler ! Enfin… presque. Une devinette et je te rends ton or ! »",
    demande: "Bonne réponse : +2 cases (il vous montre un passage).",
    reward: { texte: "+2 cases", apply: (p) => shift(p, 2) },
    rate: "Ratichon disparaît dans un buisson en sifflotant. Suspect." },
  { emoji: "🧝", nom: "Sylvette la Sylphide", slug: "sylvette", quiz: true,
    intro: "« Une énigme des bois, voyageur ? La forêt récompense les curieux. »",
    demande: "Réussite : +1 Joker soufflé par le vent.",
    reward: { texte: "+1 Joker", apply: (p) => void (p.jokers += 1) },
    rate: "Sylvette sourit et s'évapore en pétales. Ce sera pour une autre fois." },
  { emoji: "🐸", nom: "Coassin le Crapaud Bavard", slug: "coassin", plain: true,
    intro: "« Coa ! Un bisou ? Non ? Tant pis, tiens quand même une piécette. »",
    effet: { texte: "+2 🪙", apply: (p) => void addCoins(p, 2) } },
  { emoji: "🦔", nom: "Piquot le Hérisson Pressé", slug: "piquot", plain: true,
    intro: "« Poussez-vous, poussez-vous ! Oh, pardon — filez donc devant moi. »",
    effet: { texte: "+1 case", apply: (p) => shift(p, 1) } },
  { emoji: "🧞", nom: "Zébulon le Génie Distrait", slug: "zebulon", plain: true,
    intro: "« Ton vœu est exaucé ! …c'était quoi déjà ? Bon, tiens de l'or. »",
    effet: { texte: "+4 🪙", apply: (p) => void addCoins(p, 4) } },
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
  // Rencontre de PNJ drôle (~45 %) — souvent une vraie question individuelle.
  if (!forced && !onDone && (testFlag("__DONJON_NPC") || (!testFlag("__DONJON_TEST") && Math.random() < 0.45))) {
    return doNPC(pion);
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
  // Parfois (~40 %), on peut ESQUIVER le coup dur en répondant à une question
  // individuelle : bonne réponse = piège évité, mauvaise = piège subi.
  if (testFlag("__DONJON_MALUSQUIZ") || (!testFlag("__DONJON_TEST") && Math.random() < 0.4)) {
    return malusQuiz(pion, effect);
  }
  const power = powerOf(pion);
  const apply = () => {
    setPendingCase("resolu");
    effect.apply(pion);
    pion.malusSubis = (pion.malusSubis ?? 0) + 1; // compte pour le prix « Souffre-Douleur »
    save();
    sfx("malus");
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
        heraldSays(herald.pouvoir()); sfx("power");
        endPanel("🫧 Le malus éclate comme une bulle de savon. Il ne s'est rien passé.");
      }),
      bigButton("Subir son destin", apply),
    );
    return;
  }
  apply();
}

/* ---------- rencontres de PNJ (case 🍀) : parfois une vraie question ---------- */

/** Carte de présentation d'un PNJ : son portrait peint + son nom. */
function npcCard(npc) {
  return el("div", { class: "npc-card" },
    npcPortraitEl(npc.slug, npc.emoji, 112),
    el("div", { class: "npc-nom", text: `${npc.emoji} ${npc.nom}` }),
  );
}

function doNPC(pion) {
  setPendingCase("resolu");
  const pool = testFlag("__DONJON_NPC") ? NPCS.filter((n) => n.quiz) : NPCS;
  const npc = pool[Math.floor(Math.random() * pool.length)] ?? NPCS[0];
  heraldSays(`✨ Une rencontre ! ${npc.emoji} ${npc.nom} surgit sur le chemin.`); sfx("npc");
  say(npc.intro, { ...voiceOf(npc.slug), queue: true }); // le PNJ parle de sa propre voix
  if (npc.quiz) return npcQuiz(pion, npc);
  const won = npc.effet.apply(pion) === true; // shift() peut déclencher la victoire
  save();
  render();
  if (won) return;
  setPanel(
    el("div", { class: "question-block" },
      npcCard(npc),
      el("p", { class: "panel-text", text: npc.intro }),
      el("p", { class: "panel-text panel-event", text: `→ ${npc.effet.texte}` }),
      bigButton("Continuer", () => finishTurn()),
    ),
  );
}

function npcQuiz(pion, npc) {
  const q = drawQuestion(pion, { formats: ["qcm", "vrai_faux"] });
  if (!q) { addCoins(pion, 2); return endPanel(`${npc.emoji} ${npc.nom} a perdu sa devinette… +2 🪙 pour la peine.`); }
  markQuestionPosed(); // la devinette du PNJ est la question du tour
  const choices = q.choix ?? ["Vrai", "Faux"];
  const grid = el("div", { class: `choices ${choices.length === 2 ? "choices-2" : ""}`, role: "group", "aria-label": "Choix de réponse" });
  choices.forEach((choice) => {
    grid.append(choiceButton(choice, () => {
      const correct = choice === q.bonne_reponse;
      pion.stats.questions += 1;
      if (correct) pion.stats.bonnes += 1;
      bumpNiveau(pion, correct);
      sfx(correct ? "good" : "bad");
      const won = correct && npc.reward.apply(pion) === true;
      save();
      render();
      if (won) return;
      showAnecdote(q, {
        verdictHtml: correct
          ? `✅ Bien vu ! ${npc.emoji} ${npc.reward.texte}`
          : `❌ Raté — la réponse était « ${q.bonne_reponse} ». ${npc.rate}`,
        onContinue: () => finishTurn(),
      });
    }));
  });
  markGood(grid, q.bonne_reponse);
  setPanel(
    el("div", { class: "question-block" },
      npcCard(npc),
      el("p", { class: "panel-text", text: npc.intro }),
      el("p", { class: "help-note", text: npc.demande }),
      questionHeader(q, pion),
      el("p", { class: "question-texte", text: q.texte }),
      grid,
    ),
  );
}

/** Coup dur « à esquiver » : répondez juste pour éviter le malus. */
function malusQuiz(pion, effect) {
  const q = drawQuestion(pion, { formats: ["qcm", "vrai_faux"] });
  if (!q) {
    setPendingCase("resolu");
    effect.apply(pion);
    save();
    sfx("malus");
    render();
    return endPanel(`💀 ${effect.texte}`);
  }
  markQuestionPosed(); // l'esquive de malus est la question du tour
  const choices = q.choix ?? ["Vrai", "Faux"];
  const grid = el("div", { class: `choices ${choices.length === 2 ? "choices-2" : ""}`, role: "group", "aria-label": "Choix de réponse" });
  choices.forEach((choice) => {
    grid.append(choiceButton(choice, () => {
      const correct = choice === q.bonne_reponse;
      pion.stats.questions += 1;
      if (correct) pion.stats.bonnes += 1;
      bumpNiveau(pion, correct);
      setPendingCase("resolu");
      if (correct) { sfx("good"); } else { effect.apply(pion); pion.malusSubis = (pion.malusSubis ?? 0) + 1; sfx("malus"); }
      save();
      render();
      showAnecdote(q, {
        verdictHtml: correct
          ? `✅ Esquive réussie ! Vous évitez : « ${effect.texte} »`
          : `❌ Raté — la réponse était « ${q.bonne_reponse} ». Vous subissez : ${effect.texte}`,
        onContinue: () => finishTurn(),
      });
    }));
  });
  markGood(grid, q.bonne_reponse);
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "💀 Coup dur… ou pas !" }),
      el("p", { class: "panel-text", text: `Un piège se profile : ${effect.texte}` }),
      el("p", { class: "help-note", text: "Répondez juste pour l'ESQUIVER !" }),
      questionHeader(q, pion),
      el("p", { class: "question-texte", text: q.texte }),
      grid,
    ),
  );
}

/* ---------- turn-timed powers ---------- */

function useTurnPower(pion) {
  const power = powerOf(pion);
  const others = getState().pions.filter((p) => p.id !== pion.id);
  const done = () => {
    pion.pouvoirUtilise = true;
    save();
    heraldSays(herald.pouvoir()); sfx("power"); charSays(pion, "pouvoir");
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
        heraldSays(herald.pouvoir()); sfx("power");
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
      heraldSays(herald.pouvoir()); sfx("power");
      if (shift(pion, 2)) return;
      return startTurn({ silent: true });
    case "flaque:adulte": {
      // Abordage : on pille le plus riche des adversaires (jusqu'à 3 🪙).
      const rich = others.filter((p) => p.pieces > 0).sort((a, b) => b.pieces - a.pieces)[0];
      if (rich) {
        const loot = Math.min(3, rich.pieces);
        rich.pieces -= loot;
        addCoins(pion, loot);
        render();
        heraldSays(`🏴‍☠️ Abordage ! ${pion.nom} déleste ${rich.nom} de ${loot} 🪙.`);
      } else {
        addCoins(pion, 2); // personne à piller : un maigre butin de consolation
        render();
      }
      return done();
    }
    case "pelote:adulte":
      // Maille Solide : un bouclier tricoté, comme l'objet Bouclier.
      pion.bouclier = true;
      render();
      return done();
    case "kribouille:adulte": {
      // Aspiration farceuse : chipe 2 🪙 à un adversaire choisi.
      const cibles = others.filter((p) => p.pieces > 0);
      if (cibles.length === 0) { addCoins(pion, 1); render(); return done(); }
      setPanel(
        el("h2", { class: "panel-title", text: "Aspiration farceuse — à qui chiper 2 🪙 ?" }),
        ...cibles.map((t) => choiceButton(`${t.nom} (🪙 ${t.pieces})`, () => {
          const loot = Math.min(2, t.pieces);
          t.pieces -= loot;
          addCoins(pion, loot);
          render();
          done();
        })),
        choiceButton("Annuler", () => startTurn({ silent: true })),
      );
      return;
    }
    case "plomberoy:adulte":
      // Super Bond : un grand bond de 3 cases.
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir()); sfx("power");
      if (shift(pion, 3)) return;
      return startTurn({ silent: true });
    default:
      return startTurn({ silent: true });
  }
}

/* ---------- questions (all formats, never timed) ---------- */

const ADVANCE = { qcm: 2, vrai_faux: 1, equipe: 2, duo: 1, carre: 2, cash: 4 };

// Règle affichée clairement en tête de CHAQUE type de question : comment on
// répond, et ce qu'on gagne. (Format → texte explicite.)
const REGLES = {
  qcm: "QCM — 4 propositions, une seule est correcte. Touchez la bonne : +2 cases et +1 🪙.",
  vrai_faux: "Vrai ou Faux — une seule des deux réponses est juste. Bonne réponse : +1 case et +1 🪙.",
  cash: "CASH — pas de choix affichés : annoncez la réponse À VOIX HAUTE, puis révélez. Réussi : +4 cases.",
  carre: "CARRÉ — 4 propositions à l'écran. Bonne réponse : +2 cases.",
  duo: "DUO — il ne reste que 2 propositions. Bonne réponse : +1 case.",
  equipe: "Réponse ouverte — répondez À VOIX HAUTE, la table valide (système d'honneur). Réussi : +2 cases.",
  confiance: "Pari de confiance — misez de 1 à 10 AVANT de voir la question. Réussi : avancez de la moitié de la mise ; une mise de 6+ ratée fait reculer d'1 case.",
  gambit: "Gambit — annoncez le nombre le plus proche de la vraie réponse. Exact : +4 cases ; proche : +2 ou +1. Les autres parient Plus / Égal / Moins (la vraie réponse par rapport à votre nombre — bon pari : +2 🪙).",
  anagram: "Anagramme — retrouvez la réponse en réarrangeant les lettres, à voix haute. Trouvé : +2 cases.",
  hangman: "Pendu — devinez les lettres une à une (6 erreurs maximum). Mot reconstitué : +2 cases.",
};

/** Bandeau « règle » clair en tête d'une question. Renvoie toujours un nœud
 *  (nœud texte vide si le format est inconnu) : plusieurs appelants l'ajoutent
 *  via un Element.append() brut, où un null s'afficherait en « null ». */
function regleBanner(kind) {
  const t = REGLES[kind];
  return t ? el("p", { class: "regle-banner", text: `📏 ${t}` }) : document.createTextNode("");
}

function speakerIntro(pion) {
  const membre = porteParole(pion);
  return membre ? `C'est ${membre.nom} qui répond pour l'équipe ${pion.nom} !` : null;
}

const QUESTION_FORMATS = ["qcm", "vrai_faux", "cash_carre_duo", "equipe", "pari_confiance"];

function doQuestion() {
  if (testFlag("__DONJON_EXPRESSION")) return doExpression(currentPion());
  const pion = currentPion();
  // Bot : question à choix (jouable en automatique), sans choix de thème.
  if (pion.bot) {
    const bq = drawQuestion(pion, { formats: ["qcm", "vrai_faux"], commit: false });
    if (!bq) return endPanel("La banque de questions est épuisée. Le Donjon est impressionné.");
    return posePicked(pion, bq);
  }
  // On SÉLECTIONNE sans consommer : seule la question réellement posée sera
  // marquée « vue » (sinon le choix de thème brûlerait 2 questions par tour et
  // les redites reviendraient vite).
  const q = drawQuestion(pion, { formats: QUESTION_FORMATS, commit: false });
  if (!q) return endPanel("La banque de questions est épuisée. Le Donjon est impressionné.");
  // On laisse SOUVENT le choix entre deux thèmes (≈ 2 tours sur 3).
  if (!testFlag("__DONJON_TEST") && Math.random() < 0.7) {
    const q2 = drawDistinctTheme(pion, q);
    if (q2) return themeChoiceGate(pion, q, q2);
  }
  themeRevealGate(pion, q);
}

/** Sélectionne (sans consommer) une seconde question d'un thème DIFFÉRENT. */
function drawDistinctTheme(pion, q) {
  const seen = new Set([q.id]);
  for (let i = 0; i < 5; i++) {
    const alt = drawQuestion(pion, { formats: QUESTION_FORMATS, commit: false, exclude: seen });
    if (!alt) return null;
    if (alt.categorie !== q.categorie) return alt;
    seen.add(alt.id);
  }
  return null;
}

/** Petit bandeau coloré du thème d'une question (icône + nom + couleur). */
function themeBanner(q) {
  const t = themeMeta(q.categorie);
  return el("div", { class: "theme-banner", style: softStyle(t.color) },
    el("span", { class: "theme-banner-emoji", text: t.emoji }),
    el("span", { class: "theme-banner-nom", text: q.categorie }),
  );
}

/** Annonce le thème AVANT de dévoiler la question. */
function themeRevealGate(pion, q) {
  const t = themeMeta(q.categorie);
  const ty = typeMeta(q.format);
  setPanel(
    el("div", { class: "question-block theme-gate" },
      el("p", { class: "panel-text", text: `À ${speakerName(pion)} de jouer. Voici le thème :` }),
      themeBanner(q),
      el("p", { class: "help-note", text: `${ty.emoji} ${ty.label} — ${ty.regle}` }),
      bigButton("Découvrir la question", () => posePicked(pion, q)),
    ),
  );
}

/** Laisse le joueur choisir entre deux thèmes avant de voir la question. */
function themeChoiceGate(pion, qA, qB) {
  const btn = (q) => {
    const t = themeMeta(q.categorie);
    const ty = typeMeta(q.format);
    return el("button", { class: "btn btn-choice theme-choice", type: "button",
      style: softStyle(t.color), onclick: () => posePicked(pion, q) },
      el("span", { class: "theme-banner-emoji", text: t.emoji }),
      el("span", {}, el("strong", { text: q.categorie }), el("span", { class: "theme-choice-type", text: ` · ${ty.emoji} ${ty.label}` })),
    );
  };
  setPanel(
    el("div", { class: "question-block theme-gate" },
      el("p", { class: "panel-text", text: `À ${speakerName(pion)} de choisir son thème :` }),
      el("div", { class: "choices choices-2" }, btn(qA), btn(qB)),
    ),
  );
}

/**
 * Poser la question choisie avec la même variété qu'avant : certains QCM
 * deviennent un pari de confiance, un CASH/CARRÉ/DUO, ou un mini-jeu de mots.
 */
function posePicked(pion, q) {
  commitQuestion(q); // la question RÉELLEMENT posée est marquée vue/posée ici
  markQuestionPosed(); // le tour a eu sa question individuelle
  if (pion.bot) return questionFlow(pion, q); // bot : QCM simple, joué en automatique
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
    regleBanner("anagram"),
    el("p", { class: "question-texte", text: q.texte }),
    el("p", { class: "help-note", text: "🔤 Réarrangez ces lettres pour trouver la réponse, à voix haute." }),
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
      regleBanner("hangman"),
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
  if (cashMode === "cash") return openAnswerFlow(pion, q, { advance: ADVANCE.cash, accepted: [q.bonne_reponse], kind: "cash" });

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
  container.append(questionHeader(q), regleBanner(cashMode ?? q.format), el("p", { class: "question-texte", text: q.texte }));
  const hintZone = el("div", { class: "hint-zone" });
  container.append(hintZone);

  const grid = el("div", { class: `choices ${choices.length === 2 ? "choices-2" : ""}`, role: "group", "aria-label": "Choix de réponse" });
  choices.forEach((choice) => {
    const btn = choiceButton(choice, () => resolveAnswer(pion, q, choice === q.bonne_reponse, advance));
    btn.dataset.good = choice === q.bonne_reponse ? "1" : "0"; // repère pour le pilote de bots
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
  const t = themeMeta(q.categorie);
  const ty = typeMeta(q.format);
  const ageLabel = q.niveau_age === "tout_petit" ? "🍼 tout-petit"
    : q.niveau_age === "enfant" ? "👶 enfant"
    : q.niveau_age === "ado" ? "🧢 ado" : "🎩 adulte";
  return el("div", { class: "question-head" },
    el("span", { class: "badge badge-joueur", text: `${c.emoji} ${who.nom}` }),
    el("span", { class: "badge badge-theme", style: chipStyle(t.color), text: `${t.emoji} ${q.categorie}` }),
    el("span", { class: "badge badge-type", style: chipStyle(ty.color), text: `${ty.emoji} ${ty.label}` }),
    el("span", { class: "badge", text: ageLabel }),
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
  if (blockCageot && (key === "cageot:adulte" || key === "cageot:enfant" || key === "hibou:adulte")) {
    // The Trou Noir keeps its stakes: no CASH shortcut, no easier question,
    // no 50/50.
  } else if (key === "cageot:adulte" && (q.format === "qcm" || (q.format === "cash_carre_duo" && cashMode === "carre"))) {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — répondre CASH (+${ADVANCE.cash} cases)`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir()); sfx("power");
      openAnswerFlow(pion, q, { advance: ADVANCE.cash, accepted: [q.bonne_reponse], kind: "cash" });
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
      heraldSays(herald.pouvoir()); sfx("power");
      questionFlow(pion, easier);
    }));
  } else if (key === "duchesse:adulte") {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — lire l'anecdote maintenant`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir()); sfx("power");
      hintZone.append(el("p", { class: "hint", text: `📜 ${q.anecdote}` }));
      zone.remove();
    }));
  } else if (key === "duchesse:enfant") {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — un indice !`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir()); sfx("power");
      const answer = q.bonne_reponse ?? String(q.reponse_numerique ?? "");
      const first = answer.trim().charAt(0).toUpperCase();
      hintZone.append(el("p", { class: "hint", text: `💡 La réponse commence par « ${first} ».` }));
      zone.remove();
    }));
  } else if (key === "hibou:adulte" && q.format === "qcm" && container.querySelector(".choices .btn-choice")) {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — retirer 2 mauvaises réponses`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir()); sfx("power");
      const wrong = [...container.querySelectorAll(".choices .btn-choice")]
        .filter((b) => !b.disabled && b.textContent.trim() !== String(q.bonne_reponse).trim());
      for (const b of wrong.sort(() => Math.random() - 0.5).slice(0, 2)) {
        b.classList.add("choice-struck");
        b.disabled = true;
        b.setAttribute("aria-label", `${b.textContent} (éliminée par le Professeur Hibou)`);
      }
      zone.remove();
    }));
  } else if (key === "hibou:enfant") {
    zone.append(choiceButton(`${c.emoji} ${power.nom} — un petit indice`, () => {
      pion.pouvoirUtilise = true;
      save();
      heraldSays(herald.pouvoir()); sfx("power");
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
      el("p", { class: "regle-banner", text: "📏 CASH / CARRÉ / DUO — choisissez votre risque AVANT de voir la question : plus vous avez de choix, moins ça rapporte. Vous ne verrez la question qu'après." }),
      el("p", { class: "panel-text", text: "Choisissez votre niveau de risque :" }),
      el("div", { class: "choices choices-3" },
        choiceButton(`💰 CASH — aucune proposition, réponse à voix haute (+${ADVANCE.cash} cases)`, () => questionFlow(pion, q, { cashMode: "cash" })),
        choiceButton(`🟦 CARRÉ — 4 propositions (+${ADVANCE.carre} cases)`, () => questionFlow(pion, q, { cashMode: "carre" })),
        choiceButton(`🟨 DUO — 2 propositions (+${ADVANCE.duo} case)`, () => questionFlow(pion, q, { cashMode: "duo" })),
      ),
    ),
  );
}

/**
 * Open answer, honor system (perfect for a shared-table game): the player
 * answers OUT LOUD, then the table validates against the revealed answer.
 */
function openAnswerFlow(pion, q, { advance, accepted, onResolve = null, kind = "equipe" }) {
  const resolve = onResolve ?? ((correct) => resolveAnswer(pion, q, correct, advance));
  const container = el("div", { class: "question-block" });
  container.append(questionHeader(q), regleBanner(kind), el("p", { class: "question-texte", text: q.texte }));
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
        kind: "confiance",
        onResolve: (correct) => resolveAnswer(pion, q, correct, advance, { penalty }),
      });
    }));
  }
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🎯 Pari de confiance" }),
      questionHeader(q, pion),
      regleBanner("confiance"),
      el("p", { class: "panel-text", text: `Thème : ${q.categorie}. Misez votre confiance de 1 à 10 ci-dessous, AVANT de voir la question.` }),
      bets,
    ),
  );
}

/* ---------- answer resolution + anecdote (always) ---------- */

function resolveAnswer(pion, q, correct, advance, { penalty = 0 } = {}) {
  setPendingCase("resolu");
  pion.stats.questions += 1;
  // Difficulté adaptative : plus dur si le joueur gagne, plus doux sinon.
  bumpNiveau(pion, correct);
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
  sfx(correct ? "good" : "bad");
  heraldSays(correct ? herald.bonne() : herald.mauvaise());
  charSays(pion, correct ? "bonne" : "mauvaise");
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
  if (!pion.bot) playScene("trounoir", pion.characterId); // saynète du Trou Noir
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
  markQuestionPosed(); // la question redoutable du Trou Noir compte pour le tour
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
    markGood(grid, q.bonne_reponse);
    container.append(grid);
  }
  // Hints allowed, but no power may rewrite the Trou Noir's stakes.
  appendQuestionPowers(container, hintZone, pion, q, { cashMode: null, blockCageot: true });
  setPanel(container);
}

/** Gambit: numeric answer + the other pions bet "trop haut / trop bas / juste". */
function doGambit(pion) {
  if (!pion.bot) playScene("gambit", pion.characterId); // saynète de la table des paris
  const q = drawGambit(pion);
  if (!q) {
    // No numeric question fits this pion's age bracket: the case falls back
    // to a classic question rather than serving an adult one to a child.
    heraldSays("Le Gambit se transforme… en question classique ! Le Donjon a ses mystères.");
    return doQuestion();
  }
  markQuestionPosed(); // le Gambit est la question numérique du tour
  const others = getState().pions.filter((p) => p.id !== pion.id);

  const input = el("input", {
    class: "num-input",
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    "aria-label": "Votre réponse numérique",
    placeholder: "Votre nombre…",
    "data-answer": String(q.reponse_numerique), // indice pour le pilote de bots
  });
  const form = el("form", { class: "question-block" },
    el("h2", { class: "panel-title", text: "🎲 GAMBIT" }),
    questionHeader(q, pion),
    regleBanner("gambit"),
    el("p", { class: "question-texte", text: q.texte }),
    el("p", { class: "help-note", text: `${pion.nom} annonce un nombre — puis les autres parient : la vraie réponse est-elle Plus, Égale, ou Moins que ce nombre ?` }),
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
    if (p.bot) group.dataset.bot = "1"; // le pilote de bots pariera pour lui
    for (const [key, label] of [["haut", "⬆️ Plus"], ["juste", "🎯 Égal"], ["bas", "⬇️ Moins"], ["absent", "🚫"]]) {
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
      el("p", { class: "panel-text", html: `${pion.nom} annonce : <strong>${guess}</strong>. La vraie réponse est-elle <strong>Plus</strong>, <strong>Égale</strong>, ou <strong>Moins</strong> que ce nombre ?` }),
      el("p", { class: "help-note", text: "⬆️ Plus = la vraie réponse est plus grande · 🎯 Égal = pile ce nombre · ⬇️ Moins = plus petite. (🚫 pour un joueur absent.)" }),
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
    // Passe par addCoins : suit l'or gagné (étoile bonus « Magnat »), applique
    // le filet anti-dernier et rafraîchit le bandeau — comme tout autre gain.
    const g = won ? addCoins(p, 2) : 0;
    const label = bet === "haut" ? "plus" : bet === "bas" ? "moins" : "égal";
    return el("p", { class: "bet-result", text: `${won ? "✅" : "❌"} ${p.nom} a parié « ${label} »${won ? ` : +${g} 🪙` : ""}` });
  });
  pion.stats.questions += 1;
  if (advance > 0) pion.stats.bonnes += 1;
  bumpNiveau(pion, advance > 0);
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
  playScene("evenement", currentPion().characterId); // saynète de l'événement collectif
  const pions = getState().pions;
  const answers = new Map();
  const rows = pions.map((p) => {
    const row = el("div", { class: "bet-row" }, el("strong", { class: "bet-name", text: p.nom }));
    const group = el("div", { class: "bet-buttons", role: "group", "aria-label": `Réponse de ${p.nom}` });
    if (p.bot) { group.dataset.bot = "1"; group.dataset.level = p.botLevel ?? "intermediaire"; } // pilote de bots
    for (const choice of [...(q.choix ?? ["Vrai", "Faux"]), "🚫"]) {
      const btn = choiceButton(choice, () => {
        answers.set(p.id, choice);
        group.querySelectorAll("button").forEach((b) => b.classList.remove("bet-selected"));
        btn.classList.add("bet-selected");
        if (answers.size === pions.length) validateBtn.disabled = false;
      }, "btn-bet");
      if (choice === q.bonne_reponse) btn.dataset.good = "1"; // repère bonne réponse pour les bots
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
  // Panneau de saisie : chacun reporte sur l'écran ce qu'il a écrit sur sa feuille.
  const entryPanel = el("div", { class: "question-block" },
    el("h2", { class: "panel-title", text: "🎪 Événement collectif !" }),
    questionHeader(q),
    el("p", { class: "question-texte", text: q.texte }),
    el("p", { class: "help-note", text: "Chacun reporte la réponse écrite sur sa feuille (🚫 pour un joueur absent), puis on révèle — +2 pièces par bonne réponse." }),
    ...rows,
    validateBtn,
  );
  // Étape « feuille de papier » : tout le monde écrit AU SECRET avant de saisir
  // et de valider — personne ne copie, personne ne se presse (esprit du cahier).
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: "🎪 Événement collectif !" }),
      questionHeader(q),
      el("p", { class: "question-texte", text: q.texte }),
      el("p", { class: "help-note paper-note", text: "✍️ Chacun écrit sa réponse sur SA feuille de papier, en secret et sans se presser. On ne saisit et on ne valide qu'ensuite." }),
      bigButton("Tout le monde a écrit ✍️", () => setPanel(entryPanel)),
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

  // Garantie « une question par tour, quelle que soit la case » : si la case
  // n'a pas déjà posé de question au joueur qui a lancé le dé (pièces, joker,
  // boutique, événement, chance ou malus sans devinette…), on lui en pose une
  // maintenant, de son âge, avant de passer la main. La réponse rappellera
  // finishTurn — cette fois le drapeau est levé, on enchaîne normalement.
  // (Neutralisé dans les smokes déterministes, sauf forçage __DONJON_TURNQ.)
  if (!qPosedThisTurn && (!testFlag("__DONJON_TEST") || testFlag("__DONJON_TURNQ"))) {
    const joueur = currentPion();
    const q = drawQuestion(joueur, { formats: ["qcm", "vrai_faux"] });
    if (q) {
      qPosedThisTurn = true;
      heraldSays(`📜 Chaque tour a sa question ! Une dernière pour ${speakerName(joueur)}.`);
      return questionFlow(joueur, q, { advanceOverride: 0 });
    }
  }

  clearPendingCase(); // the turn is truly over — next reload starts fresh
  const pion = currentPion();
  pion.doublePieces = false;
  pion.aimantOr = false; // l'Aimant à Or ne dure qu'un tour
  pion.relanceBonus = false; // relance non utilisée : perdue en fin de tour
  pion.objetUtilise = false; // nouvel objet autorisé au prochain tour
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

  // Question bonus de la tablée (~1 tour sur 7, jamais au tout premier) : tout
  // le monde réfléchit SANS course — chacun qui a trouvé empoche l'or. Zéro
  // chronomètre, aucune notion de rapidité (règle du cahier).
  const forceBonus = testFlag("__DONJON_BONUS");
  if (forceBonus || (!testFlag("__DONJON_TEST") && state.tour >= 2 && Math.random() < 0.15)) {
    return teamBonusFlow(() => startTurn({ prefix }));
  }
  startTurn({ prefix });
}

/** Question bonus posée à TOUTE la tablée entre deux tours : réponse à voix
 *  haute, SANS course — la table désigne TOUS ceux qui avaient bon. Si la table
 *  réunit des enfants ET des adultes, on enchaîne DEUX niveaux (enfants puis
 *  adultes) pour que chacun brille au sien. */
function teamBonusFlow(onDone) {
  const pair = drawEventPair(); // deux difficultés si l'écart d'âge le justifie
  if (pair) {
    heraldSays("🔔 QUESTION BONUS à deux niveaux ! Une manche pour les plus jeunes, une pour les adultes.");
    return poseTableQuestion(pair.enfant, "🧒 Version enfants",
      () => poseTableQuestion(pair.adulte, "🎩 Version adultes", onDone));
  }
  const q = drawEvent(); // sinon une seule question, à l'âge le plus jeune (accessible à tous)
  if (!q) return onDone();
  heraldSays("🔔 QUESTION BONUS ! Toute la tablée réfléchit — pas de course, chacun a le temps de trouver.");
  poseTableQuestion(q, null, onDone);
}

/** Un tour de question collective (annonce → révélation → récompenses). */
function poseTableQuestion(q, label, next) {
  if (!q) return next();
  setPanel(
    el("div", { class: "question-block" },
      el("h2", { class: "panel-title", text: label ? `🔔 Question bonus — ${label}` : "🔔 Question bonus de la tablée" }),
      el("div", { class: "question-head" },
        el("span", { class: "badge badge-cat", text: q.categorie }),
        el("span", { class: "badge", text: "★".repeat(q.difficulte ?? 3) }),
      ),
      el("p", { class: "question-texte", text: q.texte }),
      el("p", { class: "help-note paper-note", text: "✍️ Chacun écrit sa réponse sur SA feuille de papier — en secret, sans se presser. On ne révèle qu'une fois que tout le monde a écrit : impossible de dire « je le savais » après coup !" }),
      bigButton("Tout le monde a écrit → Révéler la réponse", () => revealTableBonus(q, next)),
    ),
  );
}

function revealTableBonus(q, onDone) {
  const REWARD = 3;
  const accepted = q.bonne_reponse ?? String(q.reponse_numerique ?? (q.reponses_acceptees ?? []).join(" · "));
  const found = new Set();
  const grid = el("div", { class: "choices" });
  for (const p of getState().pions) {
    const btn = choiceButton(`${characterById(p.characterId).emoji} ${p.nom}`, () => {
      if (found.has(p.id)) { found.delete(p.id); btn.classList.remove("bet-selected"); }
      else { found.add(p.id); btn.classList.add("bet-selected"); }
    });
    // Bot : pré-sélectionné comme gagnant selon son niveau (l'humain ajuste avant de valider).
    if (p.bot && botWantsCorrect(p.botLevel)) { found.add(p.id); btn.classList.add("bet-selected"); }
    grid.append(btn);
  }
  const done = () => {
    let any = false;
    for (const p of getState().pions) if (found.has(p.id)) { addCoins(p, REWARD); any = true; }
    if (any) heraldSays(`+${REWARD} 🪙 pour chaque bonne réponse ! Le savoir paie, sans se presser.`);
    onDone();
  };
  setPanel(
    el("div", { class: "question-block" },
      el("p", { class: "reveal-answer", html: `✅ Réponse : <strong>${accepted}</strong>` }),
      anecdoteCardEl(q),
      el("p", { class: "panel-text", text: `Qui avait la bonne réponse ? Touchez chaque personne (ou équipe) qui a trouvé : chacune empoche +${REWARD} 🪙. La table est juge, aucune course.` }),
      grid,
      bigButton("Valider les gagnants", done),
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
    orGagne: p.orGagne ?? 0,
    malusSubis: p.malusSubis ?? 0,
    casesParcourues: p.casesParcourues ?? 0,
    bot: p.bot ?? false,
    botLevel: p.botLevel ?? null,
  }));
  save();
  const winner = classement[0];
  const primes = bonus.length
    ? ` Étoiles bonus : ${bonus.map((b) => `${b.emoji} ${b.nom}`).join(", ")}.`
    : "";
  sfx("win");
  heraldSays(`Rideau ! ${winner.nom} règne sur le Donjon avec ${winner.etoiles ?? 0} étoile${(winner.etoiles ?? 0) > 1 ? "s" : ""} !${primes}`);
  charSays(winner, "victoire");
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
    orGagne: p.orGagne ?? 0,
    malusSubis: p.malusSubis ?? 0,
    casesParcourues: p.casesParcourues ?? 0,
    bot: p.bot ?? false,
    botLevel: p.botLevel ?? null,
  }));
  save();
  sfx("win");
  heraldSays(herald.victoire(winner.nom));
  charSays(winner, "victoire");
  if (onVictory) onVictory(winner, state.ranking);
  return true;
}
