// Screens and wiring: home → setup → game → victory. Pass-and-play, 1-20
// players (individual) or teams sharing a pion with rotating spokesperson.
import { loadBank, bankSize } from "./data.js";
import { BOARDS, boardById, generateBoard } from "./board.js";
import { resumeGame, startGame } from "./game.js";
import { CHARACTERS, characterById, clearSave, loadSave, newGame } from "./state.js";
import { portraitEl } from "./portraits.js";
import { setVoice, voiceAvailable, voiceEnabled, warmVoices } from "./tts.js";
import { el } from "./ui.js";

const MAX_PLAYERS = 20;

const screens = ["home", "setup", "game", "victory"];
function show(name) {
  for (const s of screens) {
    document.getElementById(`screen-${s}`).hidden = s !== name;
  }
}

/* ---------- home ---------- */

function renderHome() {
  const zone = document.getElementById("home-actions");
  zone.innerHTML = "";
  const bankOk = bankSize() > 0;
  const save = loadSave();
  if (bankOk && save && !save.finished) {
    zone.append(
      el("button", {
        class: "btn btn-big",
        type: "button",
        onclick: () => {
          show("game");
          resumeGame(showVictory);
        },
      }, "▶️ Reprendre la partie en cours"),
    );
  }
  const newBtn = el("button", { class: "btn btn-big btn-gold", type: "button", onclick: () => { renderSetup(); show("setup"); } }, "⚔️ Nouvelle partie");
  if (!bankOk) newBtn.disabled = true;
  zone.append(newBtn);
  document.getElementById("bank-info").textContent = bankOk
    ? `${bankSize()} questions vérifiées et sourcées · 13 catégories · zéro chronomètre`
    : "⚠️ Impossible de charger les questions (data/questions.json). Rechargez la page une fois en ligne.";
}

/* ---------- setup ---------- */

let setupMode = "individuel";
let selectedBoardId = "grand-donjon";
let players = [{ nom: "", profil: "adulte", characterId: "cageot" }, { nom: "", profil: "adulte", characterId: "etincelle" }];
let teams = [
  { nom: "Les Dragons", characterId: "cageot", membres: [{ nom: "", profil: "adulte" }] },
  { nom: "Les Licornes", characterId: "etincelle", membres: [{ nom: "", profil: "adulte" }] },
];

function cycleCharacter(currentId) {
  const idx = CHARACTERS.findIndex((c) => c.id === currentId);
  return CHARACTERS[(idx + 1) % CHARACTERS.length].id;
}

function profilToggle(obj, rerender) {
  const isChild = obj.profil === "enfant";
  return el("button", {
    class: "btn btn-toggle" + (isChild ? " btn-toggle-enfant" : ""),
    type: "button",
    "aria-label": `Profil : ${obj.profil} (toucher pour changer)`,
    onclick: () => {
      obj.profil = isChild ? "adulte" : "enfant";
      rerender();
    },
  }, isChild ? "👶 enfant" : "🎩 adulte");
}

function characterButton(obj, rerender) {
  const c = characterById(obj.characterId);
  return el("button", {
    class: "btn btn-toggle btn-character",
    type: "button",
    title: `${c.nom} — ${c.titre}`,
    "aria-label": `Personnage : ${c.nom} (toucher pour changer)`,
    onclick: () => {
      obj.characterId = cycleCharacter(obj.characterId);
      rerender();
    },
  }, portraitEl(obj.characterId, 34), c.nom);
}

function nameInput(obj, placeholder) {
  return el("input", {
    class: "name-input",
    value: obj.nom,
    placeholder,
    maxlength: "16",
    "aria-label": placeholder,
    oninput: (e) => {
      obj.nom = e.target.value;
    },
  });
}

function renderSetup() {
  const zone = document.getElementById("setup-zone");
  zone.innerHTML = "";

  zone.append(
    el("div", { class: "mode-switch", role: "radiogroup", "aria-label": "Mode de jeu" },
      el("button", {
        class: "btn btn-toggle" + (setupMode === "individuel" ? " btn-toggle-on" : ""),
        type: "button", role: "radio", "aria-checked": String(setupMode === "individuel"),
        onclick: () => { setupMode = "individuel"; renderSetup(); },
      }, "🙋 Chacun pour soi"),
      el("button", {
        class: "btn btn-toggle" + (setupMode === "equipes" ? " btn-toggle-on" : ""),
        type: "button", role: "radio", "aria-checked": String(setupMode === "equipes"),
        onclick: () => { setupMode = "equipes"; renderSetup(); },
      }, "🤝 Par équipes"),
    ),
  );

  if (setupMode === "individuel") {
    const list = el("div", { class: "setup-list" });
    players.forEach((p, i) => {
      list.append(
        el("div", { class: "setup-row" },
          nameInput(p, `Joueur ${i + 1}`),
          profilToggle(p, renderSetup),
          characterButton(p, renderSetup),
          players.length > 1
            ? el("button", { class: "btn btn-x", type: "button", "aria-label": `Retirer le joueur ${i + 1}`, onclick: () => { players.splice(i, 1); renderSetup(); } }, "✕")
            : null,
        ),
      );
    });
    zone.append(list);
    if (players.length < MAX_PLAYERS) {
      zone.append(el("button", {
        class: "btn", type: "button",
        onclick: () => {
          players.push({ nom: "", profil: "adulte", characterId: CHARACTERS[players.length % CHARACTERS.length].id });
          renderSetup();
        },
      }, "＋ Ajouter un joueur"));
    }
  } else {
    const list = el("div", { class: "setup-list" });
    teams.forEach((t, ti) => {
      const block = el("div", { class: "team-block" },
        el("div", { class: "setup-row" },
          nameInput(t, `Équipe ${ti + 1}`),
          characterButton(t, renderSetup),
          teams.length > 2
            ? el("button", { class: "btn btn-x", type: "button", "aria-label": `Retirer l'équipe`, onclick: () => { teams.splice(ti, 1); renderSetup(); } }, "✕")
            : null,
        ),
      );
      t.membres.forEach((m, mi) => {
        block.append(
          el("div", { class: "setup-row setup-row-membre" },
            nameInput(m, `Membre ${mi + 1}`),
            profilToggle(m, renderSetup),
            t.membres.length > 1
              ? el("button", { class: "btn btn-x", type: "button", "aria-label": "Retirer le membre", onclick: () => { t.membres.splice(mi, 1); renderSetup(); } }, "✕")
              : null,
          ),
        );
      });
      if (totalMembers() < MAX_PLAYERS) {
        block.append(el("button", { class: "btn btn-small", type: "button", onclick: () => { t.membres.push({ nom: "", profil: "adulte" }); renderSetup(); } }, "＋ Membre"));
      }
      list.append(block);
    });
    zone.append(list);
    if (teams.length < 6) {
      zone.append(el("button", {
        class: "btn", type: "button",
        onclick: () => {
          teams.push({ nom: `Équipe ${teams.length + 1}`, characterId: CHARACTERS[teams.length % CHARACTERS.length].id, membres: [{ nom: "", profil: "adulte" }] });
          renderSetup();
        },
      }, "＋ Ajouter une équipe"));
    }
  }

  // Board picker: five dungeons, five moods.
  zone.append(
    el("h2", { class: "setup-subtitle", text: "Choisissez votre donjon" }),
    el("div", { class: "board-picker", role: "radiogroup", "aria-label": "Choix du plateau" },
      ...BOARDS.map((b) =>
        el("button", {
          class: "board-card" + (selectedBoardId === b.id ? " board-card-on" : ""),
          type: "button", role: "radio", "aria-checked": String(selectedBoardId === b.id),
          onclick: () => { selectedBoardId = b.id; renderSetup(); },
        },
          el("span", { class: "board-card-emoji", "aria-hidden": "true", text: b.emoji }),
          el("strong", { class: "board-card-nom", text: b.nom }),
          el("span", { class: "board-card-meta", text: `${b.length} cases · ${b.gambits.length} gambit${b.gambits.length > 1 ? "s" : ""} · ${b.trounoirs.length === 0 ? "sans trou noir" : `${b.trounoirs.length} trou${b.trounoirs.length > 1 ? "s" : ""} noir${b.trounoirs.length > 1 ? "s" : ""}`}` }),
          el("span", { class: "board-card-desc", text: b.desc }),
        ),
      ),
    ),
  );

  zone.append(
    el("p", { class: "help-note", text: "Les questions « enfant » conviennent à tout le monde ; le profil ne sert qu'à adapter la difficulté. En équipe, un porte-parole différent répond à chaque question." }),
    el("button", { class: "btn btn-big btn-gold", type: "button", onclick: launchGame }, "🏰 Entrer dans le Donjon"),
    el("button", { class: "btn", type: "button", onclick: () => { renderHome(); show("home"); } }, "← Retour"),
  );
}

function totalMembers() {
  return teams.reduce((n, t) => n + t.membres.length, 0);
}

function launchGame() {
  if (bankSize() === 0) {
    renderHome();
    show("home");
    return;
  }
  let pions;
  if (setupMode === "individuel") {
    pions = players
      .map((p, i) => ({ ...p, nom: p.nom.trim() || `Joueur ${i + 1}` }))
      .slice(0, MAX_PLAYERS);
    if (pions.length < 1) return;
  } else {
    pions = teams.map((t, i) => {
      const membres = t.membres.map((m, mi) => ({ nom: m.nom.trim() || `Membre ${mi + 1}`, profil: m.profil }));
      return {
        nom: t.nom.trim() || `Équipe ${i + 1}`,
        characterId: t.characterId,
        // A team plays at child level as soon as one child is aboard.
        profil: membres.some((m) => m.profil === "enfant") ? "enfant" : "adulte",
        membres,
      };
    });
    if (pions.length < 2) return;
  }
  clearSave();
  const def = boardById(selectedBoardId);
  newGame({ mode: setupMode, pions, boardId: def.id }, generateBoard(def));
  show("game");
  startGame(showVictory);
}

/* ---------- victory ---------- */

function showVictory(winner, rankingData) {
  show("victory");
  const zone = document.getElementById("victory-zone");
  zone.innerHTML = "";
  zone.append(
    el("h2", { class: "victory-title", text: `🏆 ${winner.nom} remporte le Trésor du Savoir !` }),
    el("ol", { class: "victory-list" },
      ...rankingData.map((p, i) =>
        el("li", { class: "victory-item" + (i === 0 ? " victory-item-first" : "") },
          el("span", { class: "victory-who" },
            el("span", { "aria-hidden": "true", text: i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎓" }),
            portraitEl(p.characterId, 40),
            el("span", { text: p.nom }),
          ),
          el("span", { class: "victory-meta", text: `case ${p.position} · 🪙${p.pieces} · ${p.bonnes}/${p.questions} bonnes réponses` }),
        ),
      ),
    ),
    el("button", { class: "btn btn-big btn-gold", type: "button", onclick: () => { clearSave(); renderSetup(); show("setup"); } }, "⚔️ Revanche"),
    el("button", { class: "btn", type: "button", onclick: () => { clearSave(); renderHome(); show("home"); } }, "🏠 Accueil"),
  );
}

/* ---------- header controls ---------- */

function wireHeader() {
  const voiceBtn = document.getElementById("voice-toggle");
  if (!voiceAvailable()) voiceBtn.hidden = true;
  const refresh = () => {
    voiceBtn.textContent = voiceEnabled() ? "🔊 Héraut vocal" : "🔇 Héraut muet";
    voiceBtn.setAttribute("aria-pressed", String(voiceEnabled()));
  };
  voiceBtn.addEventListener("click", () => {
    setVoice(!voiceEnabled());
    try {
      localStorage.setItem("donjon-voice", voiceEnabled() ? "1" : "0");
    } catch { /* ignore */ }
    refresh();
  });
  try {
    if (localStorage.getItem("donjon-voice") === "1") setVoice(true);
  } catch { /* ignore */ }
  refresh();

  document.getElementById("quit-btn").addEventListener("click", () => {
    const gameVisible = !document.getElementById("screen-game").hidden;
    if (!gameVisible) {
      renderHome();
      show("home");
      return;
    }
    if (window.confirm("Quitter la partie ? Elle reste sauvegardée pour être reprise plus tard.")) {
      renderHome();
      show("home");
    }
  });
}

/* ---------- boot ---------- */

async function boot() {
  wireHeader();
  warmVoices();
  try {
    await loadBank();
  } catch {
    // renderHome() shows the warning and disables new games (bankSize() === 0).
  }
  renderHome();
  show("home");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline dev */ });
  }
}

boot();
