// Screens and wiring: home → setup → game → victory. Pass-and-play, 1-20
// players (individual) or teams sharing a pion with rotating spokesperson.
import { loadBank, bankSize, refreshCustom } from "./data.js";
import { addCustom, CUSTOM_CATEGORIES, loadCustom, removeCustom } from "./custom.js";
import { BOARDS, boardById, generateBoard } from "./board.js";
import { resumeGame, startGame } from "./game.js";
import { CHARACTERS, characterById, clearSave, loadSave, newGame } from "./state.js";
import { portraitEl } from "./portraits.js";
import { POWERS } from "./powers.js";
import { setVoice, voiceAvailable, voiceEnabled, warmVoices } from "./tts.js";
import { el } from "./ui.js";

const MAX_PLAYERS = 20;

const screens = ["home", "rules", "custom", "setup", "game", "victory"];
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
  zone.append(el("button", { class: "btn btn-big", type: "button", onclick: () => { renderRules(); show("rules"); } }, "📖 Les règles"));
  zone.append(el("button", { class: "btn btn-big", type: "button", onclick: () => { renderCustom(); show("custom"); } }, "✍️ Vos questions maison"));
  document.getElementById("bank-info").textContent = bankOk
    ? `${bankSize()} questions vérifiées et sourcées · 13 catégories · zéro chronomètre`
    : "⚠️ Impossible de charger les questions (data/questions.json). Rechargez la page une fois en ligne.";
}

/* ---------- rules ---------- */

function renderRules() {
  const cast = document.getElementById("rules-cast");
  cast.innerHTML = "";
  for (const c of CHARACTERS) {
    const p = POWERS[c.id];
    cast.append(
      el("div", { class: "rules-cast-item" },
        portraitEl(c.id, 44),
        el("div", {},
          el("strong", { text: `${c.nom} — ${c.titre}` }),
          el("p", { class: "rules-power", text: `🎩 ${p.adulte.nom} : ${p.adulte.desc}` }),
          el("p", { class: "rules-power", text: `👶 ${p.enfant.nom} : ${p.enfant.desc}` }),
        ),
      ),
    );
  }
}

/* ---------- questions maison ---------- */

let customDraft = { format: "qcm", niveau_age: "adulte", categorie: "Notre famille" };

function renderCustom() {
  const zone = document.getElementById("custom-zone");
  zone.innerHTML = "";
  const d = customDraft;

  const texte = el("input", { class: "name-input", placeholder: "La question…", maxlength: "180", "aria-label": "Texte de la question", value: d.texte ?? "" , oninput: (e) => { d.texte = e.target.value; } });

  const catSel = el("select", { class: "name-input", "aria-label": "Catégorie", onchange: (e) => { d.categorie = e.target.value; } },
    ...CUSTOM_CATEGORIES.map((c) => {
      const o = el("option", { value: c, text: c });
      if (c === d.categorie) o.selected = true;
      return o;
    }));

  const levelRow = el("div", { class: "mode-switch", role: "radiogroup", "aria-label": "Niveau" },
    ...["enfant", "ado", "adulte"].map((lvl) =>
      el("button", {
        class: "btn btn-toggle" + (d.niveau_age === lvl ? " btn-toggle-on" : ""),
        type: "button", role: "radio", "aria-checked": String(d.niveau_age === lvl),
        onclick: () => { d.niveau_age = lvl; renderCustom(); },
      }, lvl === "enfant" ? "👶 enfant" : lvl === "ado" ? "🧢 ado" : "🎩 adulte")));

  const formatRow = el("div", { class: "mode-switch", role: "radiogroup", "aria-label": "Format" },
    ...[["qcm", "❓ QCM (4 choix)"], ["vrai_faux", "⚖️ Vrai / Faux"]].map(([f, label]) =>
      el("button", {
        class: "btn btn-toggle" + (d.format === f ? " btn-toggle-on" : ""),
        type: "button", role: "radio", "aria-checked": String(d.format === f),
        onclick: () => { d.format = f; d.bonneIndex = 0; renderCustom(); },
      }, label)));

  const choixInputs = [];
  const choicesZone = el("div", { class: "setup-list" });
  const n = d.format === "qcm" ? 4 : 2;
  if (!Array.isArray(d.choix) || d.choix.length !== n) d.choix = d.format === "vrai_faux" ? ["Vrai", "Faux"] : ["", "", "", ""];
  if (typeof d.bonneIndex !== "number" || d.bonneIndex >= n) d.bonneIndex = 0;
  for (let i = 0; i < n; i++) {
    const input = el("input", {
      class: "name-input", maxlength: "80",
      placeholder: `Choix ${i + 1}`,
      "aria-label": `Choix ${i + 1}`,
      value: d.choix[i] ?? "",
      oninput: (e) => { d.choix[i] = e.target.value; },
    });
    if (d.format === "vrai_faux") input.readOnly = true;
    choixInputs.push(input);
    choicesZone.append(
      el("div", { class: "setup-row" },
        el("button", {
          class: "btn btn-toggle" + (d.bonneIndex === i ? " btn-toggle-on" : ""),
          type: "button",
          "aria-label": `Marquer le choix ${i + 1} comme bonne réponse`,
          onclick: () => { d.bonneIndex = i; renderCustom(); },
        }, d.bonneIndex === i ? "✅" : "⬜"),
        input,
      ),
    );
  }

  const anecdote = el("input", { class: "name-input", placeholder: "Anecdote après la réponse (facultatif)", maxlength: "220", "aria-label": "Anecdote", value: d.anecdote ?? "", oninput: (e) => { d.anecdote = e.target.value; } });
  const auteur = el("input", { class: "name-input", placeholder: "Signée par… (facultatif)", maxlength: "24", "aria-label": "Auteur", value: d.auteur ?? "", oninput: (e) => { d.auteur = e.target.value; } });
  const feedback = el("p", { class: "help-note", text: "" });

  zone.append(
    el("div", { class: "team-block" },
      texte,
      el("div", { class: "setup-row" }, catSel, levelRow),
      formatRow,
      choicesZone,
      anecdote,
      auteur,
      el("button", {
        class: "btn btn-big btn-gold", type: "button",
        onclick: () => {
          const entry = addCustom({
            texte: d.texte ?? "",
            format: d.format,
            niveau_age: d.niveau_age,
            categorie: d.categorie,
            choix: d.choix,
            bonne_reponse: d.choix[d.bonneIndex] ?? "",
            anecdote: d.anecdote,
            auteur: d.auteur,
          });
          if (!entry) {
            feedback.textContent = "⚠️ Il manque la question, un choix, ou la bonne réponse.";
            return;
          }
          refreshCustom();
          customDraft = { format: d.format, niveau_age: d.niveau_age, categorie: d.categorie };
          renderCustom();
        },
      }, "＋ Ajouter à la banque"),
      feedback,
    ),
  );

  const list = loadCustom();
  if (list.length > 0) {
    zone.append(el("h2", { class: "setup-subtitle", text: `${list.length} question${list.length > 1 ? "s" : ""} maison sur cet appareil` }));
    for (const q of [...list].reverse()) {
      zone.append(
        el("div", { class: "setup-row custom-item" },
          el("div", { class: "custom-item-body" },
            el("strong", { text: q.texte }),
            el("span", { class: "player-meta", text: `🏠 ${q.categorie} · ${q.niveau_age} · ${q.format === "qcm" ? "QCM" : "Vrai/Faux"} · réponse : ${q.bonne_reponse}${q.auteur ? ` · par ${q.auteur}` : ""}` }),
          ),
          el("button", {
            class: "btn btn-x", type: "button", "aria-label": "Supprimer cette question",
            onclick: () => { removeCustom(q.id); refreshCustom(); renderCustom(); },
          }, "✕"),
        ),
      );
    }
  }
}

/* ---------- setup ---------- */

let setupMode = "individuel";
let selectedBoardId = "grand-donjon";
let variant = "course";
let rounds = 10;
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

  // Variante de jeu : Course (arriver 1er) ou Étoiles (façon Mario Party).
  zone.append(
    el("h2", { class: "setup-subtitle", text: "Choisissez votre mode" }),
    el("div", { class: "board-picker", role: "radiogroup", "aria-label": "Mode de jeu" },
      el("button", {
        class: "board-card" + (variant === "course" ? " board-card-on" : ""),
        type: "button", role: "radio", "aria-checked": String(variant === "course"),
        onclick: () => { variant = "course"; renderSetup(); },
      },
        el("span", { class: "board-card-emoji", "aria-hidden": "true", text: "🏁" }),
        el("strong", { class: "board-card-nom", text: "Course" }),
        el("span", { class: "board-card-desc", text: "Le premier au Trésor gagne. Rapide et direct." }),
      ),
      el("button", {
        class: "board-card" + (variant === "etoiles" ? " board-card-on" : ""),
        type: "button", role: "radio", "aria-checked": String(variant === "etoiles"),
        onclick: () => { variant = "etoiles"; renderSetup(); },
      },
        el("span", { class: "board-card-emoji", "aria-hidden": "true", text: "⭐" }),
        el("strong", { class: "board-card-nom", text: "Étoiles" }),
        el("span", { class: "board-card-desc", text: "Façon Mario Party : achetez des étoiles au marchand, le plus d'étoiles gagne en fin de manches." }),
      ),
    ),
  );
  if (variant === "etoiles") {
    zone.append(
      el("div", { class: "mode-switch", role: "radiogroup", "aria-label": "Nombre de manches" },
        ...[["Courte", 6], ["Normale", 10], ["Épique", 15]].map(([label, n]) =>
          el("button", {
            class: "btn btn-toggle" + (rounds === n ? " btn-toggle-on" : ""),
            type: "button", role: "radio", "aria-checked": String(rounds === n),
            onclick: () => { rounds = n; renderSetup(); },
          }, `${label} · ${n} manches`),
        ),
      ),
    );
  }

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
  newGame({ mode: setupMode, pions, boardId: def.id, variant, rounds }, generateBoard(def));
  show("game");
  startGame(showVictory);
}

/* ---------- victory ---------- */

function showVictory(winner, rankingData, extras = {}) {
  show("victory");
  const zone = document.getElementById("victory-zone");
  zone.innerHTML = "";
  const etoilesMode = rankingData.some((p) => p.etoiles !== undefined);
  const bonusStars = extras.bonusStars ?? [];
  zone.append(
    el("h2", { class: "victory-title", text: etoilesMode
      ? `🏆 ${winner.nom} remporte le Donjon avec ${winner.etoiles ?? 0} ⭐ !`
      : `🏆 ${winner.nom} remporte le Trésor du Savoir !` }),
  );
  if (bonusStars.length > 0) {
    zone.append(
      el("div", { class: "bonus-stars" },
        el("h3", { class: "bonus-stars-title", text: "✨ Étoiles bonus de fin de partie" }),
        ...bonusStars.map((b) =>
          el("p", { class: "bonus-star-line", text: `${b.emoji} ${b.titre} : ${b.nom} ${b.desc} — +1 ⭐` }),
        ),
      ),
    );
  }
  zone.append(
    el("ol", { class: "victory-list" },
      ...rankingData.map((p, i) =>
        el("li", { class: "victory-item" + (i === 0 ? " victory-item-first" : "") },
          el("span", { class: "victory-who" },
            el("span", { "aria-hidden": "true", text: i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎓" }),
            portraitEl(p.characterId, 40),
            el("span", { text: p.nom }),
          ),
          el("span", { class: "victory-meta", text: etoilesMode
            ? `⭐${p.etoiles ?? 0} · 🪙${p.pieces} · ${p.bonnes}/${p.questions} bonnes réponses`
            : `case ${p.position} · 🪙${p.pieces} · ${p.bonnes}/${p.questions} bonnes réponses` }),
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

  document.getElementById("rules-back").addEventListener("click", () => {
    renderHome();
    show("home");
  });

  document.getElementById("custom-back").addEventListener("click", () => {
    renderHome();
    show("home");
  });

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

  // navigator.serviceWorker exists on the prototype but reads back undefined on
  // insecure/file:// origins (and some sandboxes) — guard the value, not just
  // the key, so registration never throws before its .catch.
  if ("serviceWorker" in navigator && navigator.serviceWorker && typeof navigator.serviceWorker.register === "function") {
    try {
      navigator.serviceWorker.register("sw.js").catch(() => { /* offline dev */ });
    } catch { /* SW unavailable in this context */ }
  }
}

boot();
