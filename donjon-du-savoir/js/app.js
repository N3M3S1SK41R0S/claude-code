// Screens and wiring: home → setup → game → victory. Pass-and-play, 1-20
// players (individual) or teams sharing a pion with rotating spokesperson.
import { dailyPool, loadBank, bankSize, refreshCustom } from "./data.js";
import { loadWordgames } from "./wordgames.js";
import { addCustom, CUSTOM_CATEGORIES, loadCustom, removeCustom } from "./custom.js";
import { BOARDS, boardById, deleteCustomBoard, generateBoard, loadCustomBoards, makeCustomBoard, saveCustomBoard } from "./board.js";
import { openReference, resumeGame, startGame } from "./game.js";
import { AGE_BRACKETS, archiveCurrent, bracketById, bracketProfil, CHARACTERS, characterById, clearSave, deleteArchive, getState, listArchives, loadSave, newGame, restoreArchive, youngestBracket } from "./state.js";
import { portraitEl } from "./portraits.js";
import { POWERS } from "./powers.js";
import { setVoice, voiceAvailable, voiceEnabled, warmVoices } from "./tts.js";
import { setSfx, sfx, sfxAvailable, sfxEnabled } from "./sfx.js";
import { setMusic, musicAvailable, musicEnabled } from "./music.js";
import { BOT_LEVELS, BOT_LEVEL_ORDER, botLevelMeta } from "./bots.js";
import { getPrefs, loadPrefs, setPref } from "./prefs.js";
import { langueList } from "./langues.js";
import { getPalmares, loadPalmares, recordGame, SKINS, skinById, skinUnlocked, SUCCES, unlockedSkins } from "./palmares.js";
import { grimoireEntries, grimoireSize } from "./grimoire.js";
import { souvenirSection } from "./souvenir.js";
import { el } from "./ui.js";

const MAX_PLAYERS = 20;

const screens = ["home", "rules", "custom", "grimoire", "palmares", "reglages", "setup", "game", "victory"];
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
  // Parties en pause NOMMÉES : reprise en un clic (la reprise redevient la
  // partie active), suppression possible.
  for (const [i, arc] of listArchives().entries()) {
    zone.append(el("div", { class: "setup-row" },
      el("button", {
        class: "btn", style: "flex:1", type: "button",
        onclick: () => { if (restoreArchive(i)) { show("game"); resumeGame(showVictory); } },
      }, `⏸ ${arc.nom} — ${arc.resume}`),
      el("button", { class: "btn btn-x", type: "button", "aria-label": `Supprimer ${arc.nom}`, onclick: () => { deleteArchive(i); renderHome(); } }, "✕"),
    ));
  }
  const newBtn = el("button", { class: "btn btn-big btn-gold", type: "button", onclick: () => { renderSetup(); show("setup"); } }, "⚔️ Nouvelle partie");
  if (!bankOk) newBtn.disabled = true;
  zone.append(newBtn);
  zone.append(el("button", { class: "btn btn-big", type: "button", onclick: () => { renderRules(); show("rules"); } }, "📖 Les règles"));
  zone.append(el("button", { class: "btn btn-big", type: "button", onclick: () => { renderCustom(); show("custom"); } }, "✍️ Vos questions maison"));
  zone.append(el("button", { class: "btn btn-big", type: "button", onclick: () => { renderPalmares(); show("palmares"); } }, "🏅 Palmarès & succès"));
  zone.append(el("button", { class: "btn btn-big", type: "button", onclick: () => { renderGrimoire(); show("grimoire"); } }, `📖 Le Grimoire (${grimoireSize()} anecdotes)`));
  zone.append(el("button", { class: "btn btn-big", type: "button", onclick: () => { renderReglages(); show("reglages"); } }, "⚙️ Réglages & accessibilité"));
  if (bankOk) zone.append(questionDuJour());
  // 🎩 La perle du Héraut : un faux conseil très sérieux, qui change chaque jour.
  if (bankOk && (getPrefs().humour ?? "complice") !== "sobre") {
    const perle = el("p", { class: "perle-note" });
    perle.append(artImg("perle-parchemin", "assets/parchemin-sponsor.png"), document.createTextNode(` ${perleDuJour()}`));
    zone.append(perle);
  }
  document.getElementById("bank-info").textContent = bankOk
    ? `${bankSize()} questions vérifiées et sourcées · 18 catégories · zéro chronomètre`
    : "⚠️ Impossible de charger les questions (data/questions.json). Rechargez la page une fois en ligne.";
}

/** Image décorative avec repli : l'élément se retire si l'asset manque. */
function artImg(className, src) {
  const im = document.createElement("img");
  im.className = className;
  im.src = src;
  im.alt = "";
  im.setAttribute("aria-hidden", "true");
  im.onerror = () => im.remove();
  return im;
}

/* ---------- humour d'accueil et de victoire ---------- */

// Faux conseils très sérieux du Héraut (une perle par jour, au premier degré assumé).
const PERLES = [
  "Astuce : les bonnes réponses rapportent plus que les mauvaises.",
  "Ce jeu ne contient aucun chronomètre. Prenez le temps de vérifier.",
  "Le Trou Noir n'aspire que les joueurs qui marchent dessus. Statistiquement prouvé.",
  "En cas de doute, réfléchissez. En cas de certitude, aussi.",
  "Le Héraut ne se trompe jamais. Voir l'article 12 des conditions générales.",
  "Rappel : le dé ne vous en veut pas personnellement. Il improvise.",
  "Jouer en famille augmente de 100 % le nombre de joueurs.",
  "Les anecdotes de ce jeu sont vraies. Les excuses de vos adversaires, moins.",
  "Aucune gargouille n'a été blessée pendant la fabrication de ce donjon.",
  "Conseil du Héraut : visez la case Arrivée. Les autres cases sont des étapes.",
  "La chance sourit aux audacieux. Elle sourit aussi aux autres, par politesse.",
  "Les pièces d'or ne font pas le bonheur. Elles font des étoiles, c'est mieux.",
];

function perleDuJour() {
  const iso = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (const ch of iso) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERLES[h % PERLES.length];
}

// 🎤 Interview d'après-match : le Héraut tend un micro imaginaire au champion.
const INTERVIEW_Q = [
  "Alors, ce triomphe ?",
  "Un mot pour vos adversaires ?",
  "Comment aviez-vous préparé cette partie ?",
];
const INTERVIEW_R = [
  "Case après case.",
  "Je remercie mon dé. On n'a pas toujours été d'accord, mais on a su se parler.",
  "Le talent, l'humilité. Surtout le talent.",
  "J'aimerais dire que c'était dur. J'aimerais.",
  "Mes adversaires ont été formidables. La preuve : je gagne.",
];

function interviewBlock(winner) {
  const q = INTERVIEW_Q[Math.floor(Math.random() * INTERVIEW_Q.length)];
  const r = INTERVIEW_R[Math.floor(Math.random() * INTERVIEW_R.length)];
  return el("div", { class: "succes-unlock itw-block" },
    artImg("itw-micro", "assets/micro-heraut.png"),
    el("h3", { class: "succes-unlock-title", text: "🎤 L'interview d'après-match" }),
    el("p", { class: "succes-unlock-line", text: `Le Héraut : « ${q} »` }),
    el("p", { class: "succes-unlock-line", text: `👑 ${winner.nom} : « ${r} »` }),
  );
}

/** Prix absurdes mais calculés sur les VRAIES statistiques de la partie —
 *  toujours bienveillants, 3 maximum pour rester légers. */
function prixDecernes(rankingData) {
  const prix = [];
  const humains = rankingData.filter((p) => !p.bot);
  const source = humains.length ? humains : rankingData;
  const orMax = [...source].sort((a, b) => (b.orGagne ?? 0) - (a.orGagne ?? 0))[0];
  if ((orMax?.orGagne ?? 0) >= 10) prix.push({ art: "assets/medaille-argentier.png", texte: `Grand Argentier du Donjon : ${orMax.nom} — ${orMax.orGagne} pièces amassées, comptées deux fois.` });
  const dur = [...source].sort((a, b) => (b.malusSubis ?? 0) - (a.malusSubis ?? 0))[0];
  if ((dur?.malusSubis ?? 0) >= 2) prix.push({ art: "assets/medaille-sangfroid.png", texte: `Prix du Sang-Froid : ${dur.nom} — ${dur.malusSubis} coups durs encaissés avec une dignité remarquée.` });
  let bestTheme = null;
  for (const p of source) {
    for (const [cat, n] of Object.entries(p.bonnesParTheme ?? {})) {
      if (n >= 3 && (!bestTheme || n > bestTheme.n)) bestTheme = { nom: p.nom, cat, n };
    }
  }
  if (bestTheme) prix.push({ art: "assets/medaille-espoir.png", texte: `Meilleur Espoir catégorie ${bestTheme.cat} : ${bestTheme.nom} — ${bestTheme.n} bonnes réponses, le Comité s'incline.` });
  const erreurs = [...source].sort((a, b) => ((b.questions ?? 0) - (b.bonnes ?? 0)) - ((a.questions ?? 0) - (a.bonnes ?? 0)))[0];
  if (erreurs && (erreurs.questions ?? 0) - (erreurs.bonnes ?? 0) >= 4) prix.push({ art: "assets/medaille-constance.png", texte: `Prix de la Constance dans l'Erreur : ${erreurs.nom} — l'important, c'est la régularité.` });
  return prix.slice(0, 3);
}

/* ---------- question du jour ---------- */

/** Une question inédite chaque jour (choisie par un hachage de la date dans la
 *  banque — même question pour tous, sans réseau) + série de jours réussis. */
function questionDuJour() {
  const today = new Date().toISOString().slice(0, 10);
  let dj = {};
  try { dj = JSON.parse(localStorage.getItem("donjon-qdj")) ?? {}; } catch { /* mode privé */ }
  const wrap = el("div", { class: "team-block qdj" });
  if (dj.date === today && dj.repondu) {
    wrap.append(el("p", { class: "help-note", text: `📅 Question du jour : ${dj.gagne ? "réussie ✅" : "ratée ❌"} — série : ${dj.serie ?? 0} 🔥. À demain !` }));
    return wrap;
  }
  const bank = getDailyQuestion(today);
  if (!bank) return wrap;
  wrap.append(
    el("p", { class: "qdj-titre", text: `📅 Question du jour — série : ${dj.serie ?? 0} 🔥` }),
    el("p", { class: "panel-text", text: bank.texte }),
    el("div", { class: "qdj-choices" }, ...(bank.choix ?? []).map((c) =>
      el("button", { class: "btn qdj-btn", type: "button", onclick: () => {
        const gagne = c === bank.bonne_reponse;
        const serie = gagne ? (dj.date === prevDay(today) || dj.serie ? (dj.gagne ? (dj.serie ?? 0) : 0) : 0) + 1 : 0;
        try { localStorage.setItem("donjon-qdj", JSON.stringify({ date: today, repondu: true, gagne, serie })); } catch { /* privé */ }
        wrap.innerHTML = "";
        wrap.append(
          el("p", { class: "help-note", text: gagne ? `✅ Bien joué ! Série : ${serie} 🔥` : `❌ C'était « ${bank.bonne_reponse} ». La série repart à zéro !` }),
          el("p", { class: "help-note", text: `💡 ${bank.anecdote}` }),
        );
      } }, c))),
  );
  return wrap;
}

function prevDay(iso) {
  const d = new Date(iso); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Hachage stable de la date → une question QCM « ado » de la banque. */
function getDailyQuestion(iso) {
  const pool = dailyPool();
  if (!pool.length) return null;
  let h = 0;
  for (const ch of iso) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
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
  // 📜 Conditions générales parodiques : easter egg d'un sérieux notarial.
  if ((getPrefs().humour ?? "complice") !== "sobre") {
    cast.append(el("details", { class: "house-rules" },
      el("summary", { text: "📜 Conditions générales du Donjon (personne ne les lit, elles le savent)" }),
      ...[
        "Article 1 — Le savoir est gratuit. Les anecdotes sont offertes par la maison.",
        "Article 2 — Toute victoire est définitive jusqu'à la revanche.",
        "Article 7 — Le dé est réputé équitable, y compris quand il fait un 1. Surtout quand il fait un 1.",
        "Article 9 — Les réponses données « à voix haute mais dans sa tête » ne sont pas recevables.",
        "Article 12 — Le Héraut a toujours raison. Voir article 12.",
        "Article 13 — En cas de litige, la table tranche. En cas d'égalité, le goûter tranche.",
        "Article 42 — La lecture des présentes vaut anecdote.",
      ].map((t) => el("p", { class: "rules-power", text: t })),
    ));
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
// Règles maison : Trou Noir activable et difficulté (adaptative par défaut).
let houseTrouNoir = true;
let houseDifficulte = "adaptative";
let housePlaidoirie = false; // 🎭 plaider sa mauvaise foi après une erreur
const DEFAULT_BRACKET = "18+";
let players = [{ nom: "", bracket: DEFAULT_BRACKET, characterId: "cageot" }, { nom: "", bracket: DEFAULT_BRACKET, characterId: "etincelle" }];
let teams = [
  { nom: "Les Dragons", characterId: "cageot", membres: [{ nom: "", bracket: DEFAULT_BRACKET }] },
  { nom: "Les Licornes", characterId: "etincelle", membres: [{ nom: "", bracket: DEFAULT_BRACKET }] },
];

function cycleCharacter(currentId) {
  const idx = CHARACTERS.findIndex((c) => c.id === currentId);
  return CHARACTERS[(idx + 1) % CHARACTERS.length].id;
}

/** Sélecteur de tranche d'âge (7 tranches) — adapte la difficulté des questions. */
function ageSelect(obj, rerender) {
  if (!obj.bracket) obj.bracket = DEFAULT_BRACKET;
  const sel = el("select", {
    class: "name-input age-select",
    "aria-label": "Tranche d'âge du joueur",
    onchange: (e) => { obj.bracket = e.target.value; if (rerender) rerender(); },
  }, ...AGE_BRACKETS.map((b) => {
    const o = el("option", { value: b.id, text: `${b.emoji} ${b.label}` });
    if (b.id === obj.bracket) o.selected = true;
    return o;
  }));
  return sel;
}

/** Sélecteur de niveau d'un bot (Facile → Génie). */
function botLevelSelect(obj, rerender) {
  if (!obj.botLevel) obj.botLevel = "intermediaire";
  return el("select", {
    class: "name-input age-select bot-level",
    "aria-label": "Niveau du bot",
    onchange: (e) => { obj.botLevel = e.target.value; if (rerender) rerender(); },
  }, ...BOT_LEVEL_ORDER.map((id) => {
    const m = BOT_LEVELS[id];
    const o = el("option", { value: id, text: `${m.emoji} ${m.nom}` });
    if (id === obj.botLevel) o.selected = true;
    return o;
  }));
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
        el("div", { class: "setup-row" + (p.bot ? " setup-row-bot" : "") },
          nameInput(p, p.bot ? `Bot ${i + 1}` : `Joueur ${i + 1}`),
          // Un bot montre son niveau (probabilité de bonne réponse) ; un humain,
          // sa tranche d'âge (difficulté des questions).
          p.bot ? botLevelSelect(p, renderSetup) : ageSelect(p, renderSetup),
          // 🍀 Coup de pouce discret : +1 case par bonne réponse (équilibre
          // 7 ans / 47 ans sans que ça se voie en jeu).
          p.bot ? null : el("button", {
            class: "btn btn-toggle" + (p.boost ? " btn-toggle-on" : ""),
            type: "button", title: "Coup de pouce discret : +1 case par bonne réponse",
            "aria-pressed": String(!!p.boost),
            onclick: () => { p.boost = !p.boost; renderSetup(); },
          }, "🍀"),
          // ✨ Tenue du héros : les succès du palmarès en débloquent ; le bouton
          // fait défiler les tenues disponibles (masqué tant que rien n'est ouvert).
          p.bot ? null : (() => {
            const libres = unlockedSkins();
            if (libres.length <= 1) return null;
            const cur = skinById(p.skin);
            return el("button", {
              class: "btn btn-toggle" + (cur.succes ? " btn-toggle-on" : ""),
              type: "button", title: `Tenue : ${cur.nom} (appuyez pour changer)`,
              onclick: () => {
                const i = libres.findIndex((s) => s.id === cur.id);
                p.skin = libres[(i + 1) % libres.length].id;
                renderSetup();
              },
            }, cur.emoji);
          })(),
          characterButton(p, renderSetup),
          players.length > 1
            ? el("button", { class: "btn btn-x", type: "button", "aria-label": `Retirer ${p.bot ? "le bot" : "le joueur"} ${i + 1}`, onclick: () => { players.splice(i, 1); renderSetup(); } }, "✕")
            : null,
        ),
      );
    });
    zone.append(list);
    const addRow = el("div", { class: "setup-add-row" });
    if (players.length < MAX_PLAYERS) {
      addRow.append(
        el("button", {
          class: "btn", type: "button",
          onclick: () => {
            players.push({ nom: "", bracket: DEFAULT_BRACKET, characterId: CHARACTERS[players.length % CHARACTERS.length].id });
            renderSetup();
          },
        }, "＋ Ajouter un joueur"),
        el("button", {
          class: "btn", type: "button",
          title: "Un joueur automatique pour compléter la partie",
          onclick: () => {
            players.push({ nom: "", bracket: "18+", characterId: CHARACTERS[players.length % CHARACTERS.length].id, bot: true, botLevel: "intermediaire" });
            renderSetup();
          },
        }, "🤖 Ajouter un bot"),
      );
    }
    zone.append(addRow);
    zone.append(el("p", { class: "help-note", text: "🤖 Pas assez de joueurs ? Ajoutez des bots (Facile, Intermédiaire, Difficile ou Génie) : ils jouent tout seuls leur tour." }));
  } else {
    const list = el("div", { class: "setup-list" });
    teams.forEach((t, ti) => {
      // Équipe automatique (bot) : un adversaire piloté par l'IA, sans membres
      // humains — un seul niveau à choisir, elle joue son tour toute seule.
      if (t.bot) {
        list.append(
          el("div", { class: "team-block team-block-bot" },
            el("div", { class: "setup-row setup-row-bot" },
              nameInput(t, `Équipe bot ${ti + 1}`),
              botLevelSelect(t, renderSetup),
              characterButton(t, renderSetup),
              teams.length > 2
                ? el("button", { class: "btn btn-x", type: "button", "aria-label": "Retirer l'équipe de bots", onclick: () => { teams.splice(ti, 1); renderSetup(); } }, "✕")
                : null,
            ),
            el("p", { class: "help-note team-bot-note", text: "🤖 Équipe automatique — elle joue son tour toute seule." }),
          ),
        );
        return;
      }
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
            ageSelect(m, renderSetup),
            t.membres.length > 1
              ? el("button", { class: "btn btn-x", type: "button", "aria-label": "Retirer le membre", onclick: () => { t.membres.splice(mi, 1); renderSetup(); } }, "✕")
              : null,
          ),
        );
      });
      if (totalMembers() < MAX_PLAYERS) {
        block.append(el("button", { class: "btn btn-small", type: "button", onclick: () => { t.membres.push({ nom: "", bracket: DEFAULT_BRACKET }); renderSetup(); } }, "＋ Membre"));
      }
      list.append(block);
    });
    zone.append(list);
    const teamAdd = el("div", { class: "setup-add-row" });
    if (teams.length < 6) {
      teamAdd.append(
        el("button", {
          class: "btn", type: "button",
          onclick: () => {
            teams.push({ nom: `Équipe ${teams.length + 1}`, characterId: CHARACTERS[teams.length % CHARACTERS.length].id, membres: [{ nom: "", bracket: DEFAULT_BRACKET }] });
            renderSetup();
          },
        }, "＋ Ajouter une équipe"),
        el("button", {
          class: "btn", type: "button",
          title: "Une équipe automatique pour compléter la partie",
          onclick: () => {
            teams.push({ nom: "", characterId: CHARACTERS[teams.length % CHARACTERS.length].id, bot: true, botLevel: "intermediaire" });
            renderSetup();
          },
        }, "🤖 Ajouter une équipe de bots"),
      );
    }
    zone.append(teamAdd);
    zone.append(el("p", { class: "help-note", text: "🤖 Pas assez de monde ? Ajoutez une équipe de bots : elle joue toute seule, au niveau choisi." }));
  }

  // Board picker: five dungeons, five moods.
  zone.append(
    el("h2", { class: "setup-subtitle", text: "Choisissez votre donjon" }),
    el("div", { class: "board-picker", role: "radiogroup", "aria-label": "Choix du plateau" },
      ...[...BOARDS, ...loadCustomBoards()].map((b) =>
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

  // Éditeur de plateau maison : créer, modifier ou supprimer ses donjons.
  const editorRow = el("div", { class: "setup-add-row" },
    el("button", { class: "btn", type: "button", onclick: () => showBoardEditor(null) }, "🛠️ Créer votre plateau maison"),
  );
  for (const b of loadCustomBoards()) {
    editorRow.append(
      el("button", { class: "btn btn-small", type: "button", onclick: () => showBoardEditor(b) }, `✏️ ${b.nom}`),
      el("button", {
        class: "btn btn-x", type: "button", "aria-label": `Supprimer le plateau ${b.nom}`,
        onclick: () => {
          deleteCustomBoard(b.id);
          if (selectedBoardId === b.id) selectedBoardId = "grand-donjon";
          renderSetup();
        },
      }, "✕"),
    );
  }
  zone.append(editorRow);

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
    const roundsInput = el("input", {
      class: "rounds-input", type: "number", min: "5", max: "200", step: "1",
      value: String(rounds), inputmode: "numeric",
      "aria-label": "Nombre de manches (de 5 à 200)",
      oninput: (e) => {
        const v = parseInt(e.target.value, 10);
        if (Number.isFinite(v)) rounds = Math.max(5, Math.min(200, v));
      },
    });
    zone.append(
      el("div", { class: "rounds-picker" },
        el("label", { class: "rounds-label", text: "Nombre de manches (de 5 à 200)" }, roundsInput),
        el("div", { class: "mode-switch", role: "group", "aria-label": "Raccourcis de manches" },
          ...[5, 10, 20, 50, 100, 200].map((n) =>
            el("button", {
              class: "btn btn-toggle btn-small" + (rounds === n ? " btn-toggle-on" : ""),
              type: "button",
              onclick: () => { rounds = n; renderSetup(); },
            }, String(n)),
          ),
        ),
        el("p", { class: "help-note", text: "Sur les petits plateaux, chaque manche passe vite : montez le nombre pour une partie plus longue." }),
      ),
    );
  }

  // Règles maison (repliable) : contrôles segmentés qui se rafraîchissent sur
  // place (sans reconstruire tout l'écran, pour ne pas refermer le volet).
  const houseSeg = (options, getCurrent, onPick) => {
    const wrap = el("div", { class: "reglage-control" });
    const items = options.map((o) => ({ o, b: el("button", { class: "seg-btn", type: "button", onclick: () => { onPick(o.val); refresh(); } }, o.label) }));
    const refresh = () => items.forEach(({ o, b }) => { const on = o.val === getCurrent(); b.classList.toggle("seg-on", on); b.setAttribute("aria-pressed", String(on)); });
    wrap.append(...items.map((x) => x.b));
    refresh();
    return wrap;
  };
  const houseRow = (titre, desc, control) => el("div", { class: "reglage-row" },
    el("div", { class: "reglage-label" },
      el("span", { class: "reglage-titre", text: titre }),
      el("span", { class: "reglage-desc", text: desc }),
    ),
    control,
  );
  zone.append(
    el("details", { class: "house-rules" },
      el("summary", { text: "🏠 Règles maison (facultatif)" }),
      el("div", { class: "house-rules-body" },
        houseRow("🕳️ Trou Noir", "La case redoutable (+3 cases ou recul de 6). Désactivez-la pour une partie plus douce.",
          houseSeg([{ val: true, label: "Activé" }, { val: false, label: "Désactivé" }], () => houseTrouNoir, (v) => { houseTrouNoir = v; })),
        houseRow("🎚️ Difficulté", "Adaptative : facile puis se durcit. Douce : toujours accessible. Corsée : questions ardues.",
          houseSeg([{ val: "adaptative", label: "Adaptative" }, { val: "douce", label: "Douce" }, { val: "corsee", label: "Corsée" }], () => houseDifficulte, (v) => { houseDifficulte = v; })),
        houseRow("🎭 Plaidoirie", "Après une mauvaise réponse, le joueur peut plaider sa mauvaise foi en UN argument ; si la table est convaincue, 1 🪙 de consolation.",
          houseSeg([{ val: false, label: "Non" }, { val: true, label: "Oui" }], () => housePlaidoirie, (v) => { housePlaidoirie = v; })),
      ),
    ),
  );

  zone.append(
    el("p", { class: "help-note", text: "Choisissez une tranche d'âge par joueur : les questions s'adaptent à la difficulté correspondante. En équipe, on joue au niveau du plus jeune, et un porte-parole différent répond à chaque question." }),
    el("button", { class: "btn btn-big btn-gold", type: "button", onclick: launchGame }, "🏰 Entrer dans le Donjon"),
    el("button", { class: "btn", type: "button", onclick: () => { renderHome(); show("home"); } }, "← Retour"),
  );
}

function totalMembers() {
  // Les équipes de bots n'ont pas de membres humains (t.membres absent).
  return teams.reduce((n, t) => n + (t.membres?.length ?? 0), 0);
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
      .map((p, i) => {
        const bracket = p.bracket ?? DEFAULT_BRACKET;
        const defaut = p.bot ? `Bot ${botLevelMeta(p.botLevel).nom}` : `Joueur ${i + 1}`;
        return { ...p, nom: p.nom.trim() || defaut, bracket, profil: bracketProfil(bracket) };
      })
      .slice(0, MAX_PLAYERS);
    if (pions.length < 1) return;
  } else {
    pions = teams.map((t, i) => {
      // Équipe automatique : pas de membres, difficulté adulte, pilotée par l'IA.
      if (t.bot) {
        return {
          nom: t.nom.trim() || `Bot ${botLevelMeta(t.botLevel).nom}`,
          characterId: t.characterId,
          bracket: "18+",
          profil: bracketProfil("18+"),
          bot: true,
          botLevel: t.botLevel,
          membres: null,
        };
      }
      const membres = t.membres.map((m, mi) => {
        const bracket = m.bracket ?? DEFAULT_BRACKET;
        return { nom: m.nom.trim() || `Membre ${mi + 1}`, bracket, profil: bracketProfil(bracket) };
      });
      // A team plays for the YOUNGEST member aboard: collective questions and
      // difficulty adapt to the youngest age present.
      const bracket = youngestBracket(membres.map((m) => m.bracket));
      return {
        nom: t.nom.trim() || `Équipe ${i + 1}`,
        characterId: t.characterId,
        bracket,
        profil: bracketProfil(bracket),
        membres,
      };
    });
    if (pions.length < 2) return;
  }
  clearSave();
  const def = boardById(selectedBoardId);
  // Mémorise la configuration (pour « manche suivante » du mode tournoi).
  try { localStorage.setItem("donjon-lastconfig", JSON.stringify({ mode: setupMode, pions, boardId: def.id, variant, rounds, difficulte: houseDifficulte, trouNoir: houseTrouNoir, plaidoirie: housePlaidoirie })); } catch { /* mode privé */ }
  newGame(
    { mode: setupMode, pions, boardId: def.id, variant, rounds, difficulte: houseDifficulte, plaidoirie: housePlaidoirie },
    generateBoard(def, { trouNoir: houseTrouNoir }),
  );
  show("game");
  startGame(showVictory);
}

/* ---------- tournoi (3 manches, cumul des points) ---------- */

const TOURNOI_KEY = "donjon-tournoi";

function tournoiState() {
  try { return JSON.parse(localStorage.getItem(TOURNOI_KEY)); } catch { return null; }
}

/** Relance une partie IDENTIQUE (même tablée, même plateau, mêmes règles). */
function relaunchSameConfig() {
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem("donjon-lastconfig")); } catch { /* rien */ }
  if (!cfg) { renderSetup(); show("setup"); return; }
  clearSave();
  const def = boardById(cfg.boardId);
  newGame(cfg, generateBoard(def, { trouNoir: cfg.trouNoir !== false }));
  show("game");
  startGame(showVictory);
}

/** Bloc tournoi de l'écran de victoire : cumul, manche suivante, podium final. */
function tournoiBlock(rankingData) {
  const pts = {};
  rankingData.forEach((p, i) => { pts[p.nom] = rankingData.length - i; });
  let t = tournoiState();
  if (t) {
    for (const [nom, v] of Object.entries(pts)) t.total[nom] = (t.total[nom] ?? 0) + v;
    t.joue += 1;
    if (t.joue >= 3) {
      try { localStorage.removeItem(TOURNOI_KEY); } catch { /* rien */ }
      const classement = Object.entries(t.total).sort((a, b) => b[1] - a[1]);
      return el("div", { class: "succes-unlock" },
        el("h3", { class: "succes-unlock-title", text: "🏆 PODIUM FINAL DU TOURNOI (3 manches)" }),
        ...classement.map(([nom, v], i) => el("p", { class: "succes-unlock-line", text: `${["🥇", "🥈", "🥉"][i] ?? "🎓"} ${nom} — ${v} points` })),
      );
    }
    try { localStorage.setItem(TOURNOI_KEY, JSON.stringify(t)); } catch { /* rien */ }
    const classement = Object.entries(t.total).sort((a, b) => b[1] - a[1]);
    return el("div", { class: "succes-unlock" },
      el("h3", { class: "succes-unlock-title", text: `🏁 Tournoi — après la manche ${t.joue}/3` }),
      ...classement.map(([nom, v]) => el("p", { class: "succes-unlock-line", text: `${nom} — ${v} points` })),
      el("button", { class: "btn btn-big btn-gold", type: "button", onclick: relaunchSameConfig }, `🏁 Manche ${t.joue + 1}/3 — même tablée !`),
    );
  }
  // Pas de tournoi actif : proposer d'enchaîner (cette partie devient la manche 1).
  return el("button", {
    class: "btn btn-big", type: "button",
    onclick: () => {
      try { localStorage.setItem(TOURNOI_KEY, JSON.stringify({ joue: 1, total: pts })); } catch { /* rien */ }
      relaunchSameConfig();
    },
  }, "🏁 Enchaîner en TOURNOI (3 manches, cumul des points)");
}

/* ---------- victory ---------- */

/** Pluie de confettis festive sur l'écran de victoire (coupée en reduced-motion). */
function spawnConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#e0b04a", "#8e5cc2", "#3ec27a", "#3e6ec2", "#c23e6b", "#58c98b"];
  const box = el("div", { class: "confetti", "aria-hidden": "true" });
  for (let i = 0; i < 28; i++) {
    const piece = el("span", { class: "confetti-piece" });
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    box.append(piece);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4200);
}

function showVictory(winner, rankingData, extras = {}) {
  show("victory");
  spawnConfetti();
  const zone = document.getElementById("victory-zone");
  zone.innerHTML = "";
  // Fond de fête peint (GEN 2), discret derrière le contenu — repli : rien.
  zone.append(artImg("victory-bg", "assets/fond-victoire.webp"));
  const etoilesMode = rankingData.some((p) => p.etoiles !== undefined);
  const bonusStars = extras.bonusStars ?? [];
  // Enregistre la partie au palmarès et récupère les succès nouvellement débloqués.
  const newSucces = recordGame({ pions: rankingData, winner, mode: getState()?.mode ?? "individuel", etoilesMode });
  zone.append(
    el("h2", { class: "victory-title", text: etoilesMode
      ? `🏆 ${winner.nom} remporte le Donjon avec ${winner.etoiles ?? 0} ⭐ !`
      : `🏆 ${winner.nom} remporte le Trésor du Savoir !` }),
  );
  if (newSucces.length > 0) {
    zone.append(
      el("div", { class: "succes-unlock" },
        el("h3", { class: "succes-unlock-title", text: newSucces.length > 1 ? "🏅 Nouveaux succès débloqués !" : "🏅 Succès débloqué !" }),
        ...newSucces.map((s) =>
          el("p", { class: "succes-unlock-line", text: `${s.emoji} ${s.titre} — ${s.desc}` }),
        ),
      ),
    );
  }
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
  // 🎯 Défis secrets révélés : chacun découvre l'objectif caché des autres.
  const defis = rankingData.filter((p) => p.defiInfo);
  if (defis.length > 0) {
    zone.append(el("div", { class: "succes-unlock" },
      el("h3", { class: "succes-unlock-title", text: "🎯 Défis secrets révélés !" }),
      ...defis.map((p) => el("p", { class: "succes-unlock-line", text: `${p.nom} — « ${p.defiInfo.texte} » : ${p.defiInfo.ok ? "✅ réussi !" : "❌ manqué"}` })),
    ));
  }
  // 🎤 Interview d'après-match + 🏆 prix décernés (humour ≥ complice).
  if ((getPrefs().humour ?? "complice") !== "sobre") {
    zone.append(interviewBlock(winner));
    const prix = prixDecernes(rankingData);
    if (prix.length > 0) {
      zone.append(el("div", { class: "succes-unlock" },
        el("h3", { class: "succes-unlock-title", text: "🏆 Les prix du Donjon" }),
        ...prix.map((t) => el("p", { class: "succes-unlock-line prix-line" },
          artImg("prix-medaille", t.art),
          el("span", { text: t.texte }),
        )),
      ));
    }
  }

  // Podium festif : le top 3 sur des marches, le gagnant surélevé et couronné.
  const top = rankingData.slice(0, 3);
  if (top.length >= 2) {
    const order = [1, 0, 2].filter((idx) => top[idx]); // 2e · 1er (centre) · 3e
    zone.append(
      el("div", { class: "victory-podium", "aria-hidden": "true" },
        ...order.map((idx) => {
          const p = top[idx];
          return el("div", { class: `podium-col podium-rank-${idx + 1}` },
            el("span", { class: "podium-crown", text: idx === 0 ? "👑" : idx === 1 ? "🥈" : "🥉" }),
            portraitEl(p.characterId, idx === 0 ? 84 : 60, p.skin),
            el("span", { class: "podium-name", text: p.nom }),
            el("span", { class: "podium-stand", text: String(idx + 1) }),
          );
        }),
      ),
    );
  }
  zone.append(
    el("ol", { class: "victory-list" },
      ...rankingData.map((p, i) =>
        el("li", { class: "victory-item" + (i === 0 ? " victory-item-first" : "") },
          el("span", { class: "victory-who" },
            el("span", { "aria-hidden": "true", text: i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎓" }),
            portraitEl(p.characterId, 40, p.skin),
            el("span", { text: p.nom + (p.bot ? " 🤖" : "") }),
          ),
          el("span", { class: "victory-meta", text: etoilesMode
            ? `⭐${p.etoiles ?? 0} · 🪙${p.pieces} · ${p.bonnes}/${p.questions} bonnes réponses`
            : `case ${p.position} · 🪙${p.pieces} · ${p.bonnes}/${p.questions} bonnes réponses` }),
        ),
      ),
    ),
    statsTable(rankingData, etoilesMode),
    souvenirSection(winner, rankingData, etoilesMode),
    tournoiBlock(rankingData),
    el("button", { class: "btn btn-big btn-gold", type: "button", onclick: () => { clearSave(); renderSetup(); show("setup"); } }, "⚔️ Revanche"),
    el("button", { class: "btn", type: "button", onclick: () => { clearSave(); renderHome(); show("home"); } }, "🏠 Accueil"),
  );
}

/** Tableau de statistiques détaillées par joueur, repliable (consultable en fin
 *  de partie) : bonnes réponses, taux de réussite, or gagné, cases/étoiles, malus. */
function statsTable(rankingData, etoilesMode) {
  const taux = (p) => (p.questions ? `${Math.round((p.bonnes / p.questions) * 100)} %` : "—");
  const cols = [
    etoilesMode ? { th: "⭐", get: (p) => p.etoiles ?? 0 } : { th: "👣 Cases", get: (p) => p.casesParcourues ?? p.position ?? 0 },
    { th: "✅ Bonnes", get: (p) => p.bonnes ?? 0 },
    { th: "❓ Posées", get: (p) => p.questions ?? 0 },
    { th: "🎯 Réussite", get: taux },
    { th: "🪙 Or gagné", get: (p) => p.orGagne ?? 0 },
    { th: "🪙 Solde", get: (p) => p.pieces ?? 0 },
    { th: "💀 Coups durs", get: (p) => p.malusSubis ?? 0 },
  ];
  const table = el("table", { class: "stats-table" },
    el("thead", {}, el("tr", {}, el("th", { class: "stats-th-name", text: "Joueur" }), ...cols.map((c) => el("th", { text: c.th })))),
    el("tbody", {}, ...rankingData.map((p, i) =>
      el("tr", { class: i === 0 ? "stats-first" : "" },
        el("td", { class: "stats-name" }, el("span", { text: `${i + 1}. ${p.nom}${p.bot ? " 🤖" : ""}` })),
        ...cols.map((c) => el("td", { text: String(c.get(p)) })),
      ),
    )),
  );
  return el("details", { class: "stats-details" },
    el("summary", { text: "📊 Statistiques détaillées de la partie" }),
    el("div", { class: "stats-scroll" }, table),
  );
}

/* ---------- réglages (confort & accessibilité) ---------- */

function renderReglages() {
  const zone = document.getElementById("reglages-zone");
  zone.innerHTML = "";
  const p = getPrefs();
  // Groupe de boutons « segmentés » : une option active à la fois.
  const seg = (options, current, onPick) => el("div", { class: "reglage-control" },
    ...options.map((o) =>
      el("button", {
        class: "seg-btn" + (o.val === current ? " seg-on" : ""),
        type: "button", "aria-pressed": String(o.val === current),
        onclick: () => { onPick(o.val); renderReglages(); },
      }, o.label),
    ),
  );
  const row = (titre, desc, control) => el("div", { class: "reglage-row" },
    el("div", { class: "reglage-label" },
      el("span", { class: "reglage-titre", text: titre }),
      el("span", { class: "reglage-desc", text: desc }),
    ),
    control,
  );
  const oui_non = [{ val: false, label: "Non" }, { val: true, label: "Oui" }];
  zone.append(
    row("🔠 Police plus lisible", "Sans empattement, plus aérée — pratique en cas de dyslexie.",
      seg([{ val: "standard", label: "Standard" }, { val: "lisible", label: "Lisible" }], p.police, (v) => setPref("police", v))),
    row("🔎 Texte plus grand", "Agrandit le texte pour lire sans effort.",
      seg(oui_non, p.gros, (v) => setPref("gros", v))),
    row("🌈 Mode daltonien", "Bonne réponse en bleu, coup dur en orange (au lieu de vert / rouge).",
      seg(oui_non, p.daltonien, (v) => setPref("daltonien", v))),
    row("🎬 Vue immersive (3D)", "Plateau en 3D avec caméra qui suit le pion + saynètes animées (façon Mario Party). Décochez pour le plateau 2D classique. Repli 2D automatique si l'appareil ne gère pas la 3D.",
      seg(oui_non, p.immersion !== false, (v) => setPref("immersion", v))),
    ...(langueList().length > 1 ? [
      row("🌍 Langue", "La langue du jeu et de sa banque de questions (rechargement immédiat).",
        seg(langueList().map((l) => ({ val: l.id, label: `${l.drapeau ?? "🌍"} ${l.nom}` })), p.langue ?? "fr-FR",
          (v) => { setPref("langue", v); location.reload(); })),
    ] : []),
    row("🎧 Partie à l'oreille", "Le maître du jeu lit aussi les propositions, le dé et les bonnes réponses : la partie peut se jouer sans regarder l'écran.",
      seg(oui_non, p.oreilles, (v) => setPref("oreilles", v))),
    row("🎩 Humour du Héraut", "Sobre : les faits, rien que les faits. Complice : clins d'œil pince-sans-rire (défaut). Grand Cabaret : le Héraut se croit en tournée.",
      seg([{ val: "sobre", label: "Sobre" }, { val: "complice", label: "Complice" }, { val: "cabaret", label: "Grand Cabaret" }], p.humour ?? "complice", (v) => setPref("humour", v))),
    row("🎬 Animations", "Réduisez les mouvements à l'écran si vous préférez le calme.",
      seg([{ val: "completes", label: "Complètes" }, { val: "reduites", label: "Réduites" }], p.animations, (v) => setPref("animations", v))),
    row("📖 Revoir le tutoriel", "Le petit guide de démarrage du Donjon.",
      el("div", { class: "reglage-control" }, el("button", { class: "seg-btn", type: "button", onclick: () => showTutorial() }, "▶️ Revoir"))),
  );
}

/* ---------- palmarès & succès ---------- */

function renderPalmares() {
  const zone = document.getElementById("palmares-zone");
  zone.innerHTML = "";
  const d = getPalmares();
  const tauxMoyen = d.questionsTotal ? Math.round((d.bonnesTotal / d.questionsTotal) * 100) : 0;
  const stat = (emoji, valeur, label) => el("div", { class: "palm-stat" },
    el("span", { class: "palm-stat-val", text: String(valeur) }),
    el("span", { class: "palm-stat-lbl", text: `${emoji} ${label}` }),
  );
  zone.append(
    el("div", { class: "palm-stats" },
      stat("🎮", d.parties, "parties"),
      stat("🏆", d.victoires, "victoires"),
      stat("✅", d.bonnesTotal, "bonnes réponses"),
      stat("🎯", `${tauxMoyen} %`, "réussite moyenne"),
      stat("🪙", d.orTotal, "or amassé"),
      stat("🌟", d.meilleuresEtoiles, "record d'étoiles"),
    ),
  );
  zone.append(el("h2", { class: "palm-succes-titre", text: `🏅 Succès débloqués — ${d.succes.length} / ${SUCCES.length}` }));
  const grid = el("div", { class: "palm-succes-grid" });
  for (const s of SUCCES) {
    const got = d.succes.includes(s.id);
    grid.append(
      el("div", { class: "palm-succes" + (got ? " palm-succes-on" : "") },
        el("span", { class: "palm-succes-emoji", "aria-hidden": "true", text: got ? s.emoji : "🔒" }),
        el("div", { class: "palm-succes-txt" },
          el("span", { class: "palm-succes-nom", text: s.titre }),
          el("span", { class: "palm-succes-desc", text: s.desc }),
        ),
      ),
    );
  }
  zone.append(grid);
  // Galerie des tenues : ce que chaque succès débloque pour les héros.
  zone.append(el("h2", { class: "palm-succes-titre", text: `✨ Tenues de héros — ${SKINS.filter((s) => skinUnlocked(s)).length} / ${SKINS.length}` }));
  // Pastilles de tenues peintes (GEN 2) — repli : l'emoji de la tenue.
  const SKIN_ART = {
    classique: "assets/tenue-classique.png",
    dore: "assets/tenue-doree.png",
    emeraude: "assets/tenue-emeraude.png",
    flamboyant: "assets/tenue-flamboyante.png",
    royal: "assets/tenue-royale.png",
    cosmique: "assets/tenue-cosmique.png",
  };
  const skinsGrid = el("div", { class: "palm-succes-grid" });
  for (const s of SKINS) {
    const got = skinUnlocked(s);
    const cond = s.succes ? SUCCES.find((x) => x.id === s.succes) : null;
    const badge = el("span", { class: "palm-succes-emoji", "aria-hidden": "true" });
    if (got && SKIN_ART[s.id]) {
      const im = artImg("tenue-art", SKIN_ART[s.id]);
      im.onerror = () => { im.remove(); badge.textContent = s.emoji; };
      badge.append(im);
    } else {
      badge.textContent = got ? s.emoji : "🔒";
    }
    skinsGrid.append(
      el("div", { class: "palm-succes" + (got ? " palm-succes-on" : "") },
        badge,
        el("div", { class: "palm-succes-txt" },
          el("span", { class: "palm-succes-nom", text: `Tenue ${s.nom}` }),
          el("span", { class: "palm-succes-desc", text: cond ? `Débloquée par le succès « ${cond.titre} ».` : "Offerte d'emblée." }),
        ),
      ),
    );
  }
  zone.append(skinsGrid);
  if (d.parties === 0) {
    zone.append(el("p", { class: "help-note", style: "text-align:center", text: "Jouez une partie pour commencer à garnir votre palmarès !" }));
  }
}

/* ---------- grimoire des anecdotes ---------- */

let grimoireFiltre = null; // catégorie active (null = toutes)

function renderGrimoire() {
  const zone = document.getElementById("grimoire-zone");
  zone.innerHTML = "";
  const all = grimoireEntries();
  if (all.length === 0) {
    zone.append(el("p", { class: "help-note", style: "text-align:center", text: "Le Grimoire est vide — jouez, et chaque anecdote découverte viendra s'y ranger !" }));
    return;
  }
  // Puces de filtre par catégorie (comptées), « Toutes » en tête.
  const cats = {};
  for (const e of all) cats[e.categorie] = (cats[e.categorie] ?? 0) + 1;
  const chips = el("div", { class: "grimoire-chips" },
    el("button", {
      class: "seg-btn" + (grimoireFiltre === null ? " seg-on" : ""), type: "button",
      onclick: () => { grimoireFiltre = null; renderGrimoire(); },
    }, `Toutes (${all.length})`),
    ...Object.keys(cats).sort().map((c) => el("button", {
      class: "seg-btn" + (grimoireFiltre === c ? " seg-on" : ""), type: "button",
      onclick: () => { grimoireFiltre = c; renderGrimoire(); },
    }, `${c} (${cats[c]})`)),
  );
  zone.append(chips);
  const list = el("div", { class: "grimoire-list" });
  for (const e of all.filter((x) => grimoireFiltre === null || x.categorie === grimoireFiltre).slice(0, 120)) {
    const sources = (e.sources ?? []).map((src) => {
      let label = "source";
      try { label = new URL(src).hostname.replace(/^www\./, ""); } catch { /* libellé par défaut */ }
      return el("a", { class: "source-link", href: src, target: "_blank", rel: "noopener noreferrer", text: label });
    });
    list.append(el("div", { class: "grimoire-card" },
      el("p", { class: "grimoire-cat", text: e.categorie }),
      el("p", { class: "grimoire-q", text: e.texte }),
      el("p", { class: "grimoire-anec", text: e.anecdote }),
      sources.length ? el("div", { class: "sources" }, ...sources) : null,
    ));
  }
  zone.append(list);
}

/* ---------- tutoriel du premier lancement ---------- */

const TUTO_STEPS = [
  { emoji: "🏰", titre: "Bienvenue au Donjon !", texte: "Un jeu de plateau de culture générale pour 1 à 20 aventuriers. On se cultive en s'amusant — et il n'y a JAMAIS de chronomètre." },
  { emoji: "🎲", titre: "Avancez, répondez", texte: "À votre tour, lancez le dé et avancez. La plupart des cases posent une question : bonne réponse = on avance et on gagne des pièces. Personne n'est jamais éliminé." },
  { emoji: "💡", titre: "Toujours une anecdote", texte: "Après chaque question, le Héraut révèle la bonne réponse ET une anecdote vérifiée avec ses sources. On repart toujours un peu moins bête !" },
  { emoji: "👑", titre: "Le premier au Trésor gagne", texte: "En mode Course, le premier au Trésor l'emporte. En mode Étoiles (façon Mario Party), on achète des étoiles chez le marchand. À la fin, un tableau récapitule les exploits de chacun." },
  { emoji: "⚙️", titre: "À votre main", texte: "Pas assez de joueurs ? Ajoutez des bots. Besoin de confort ? Les Réglages offrent une police plus lisible, un mode daltonien et bien plus. Bon jeu !" },
];

/** Affiche le tutoriel (overlay pas-à-pas). onClose optionnel après fermeture. */
function showTutorial(onClose) {
  let i = 0;
  const overlay = el("div", { class: "tuto-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Tutoriel du Donjon" });
  const close = () => { overlay.remove(); setPref("tutoVu", true); if (onClose) onClose(); };
  const render = () => {
    const s = TUTO_STEPS[i];
    const last = i === TUTO_STEPS.length - 1;
    overlay.innerHTML = "";
    overlay.append(
      el("div", { class: "tuto-card" },
        el("div", { class: "tuto-emoji", "aria-hidden": "true", text: s.emoji }),
        el("h2", { class: "tuto-titre", text: s.titre }),
        el("p", { class: "tuto-texte", text: s.texte }),
        el("div", { class: "tuto-dots", "aria-hidden": "true" },
          ...TUTO_STEPS.map((_, k) => el("span", { class: "tuto-dot" + (k === i ? " tuto-dot-on" : "") }))),
        el("div", { class: "tuto-actions" },
          i > 0 ? el("button", { class: "btn btn-small", type: "button", onclick: () => { i--; render(); } }, "← Précédent") : null,
          el("button", { class: "btn btn-gold", type: "button", onclick: () => { if (last) close(); else { i++; render(); } } }, last ? "C'est parti !" : "Suivant →"),
        ),
        el("button", { class: "btn btn-small", type: "button", onclick: close }, "Passer le tutoriel"),
      ),
    );
  };
  render();
  document.body.append(overlay);
}

/* ---------- éditeur de plateau maison ---------- */

const EDITOR_THEMES = [
  { id: "crypte", label: "🕯️ Crypte" },
  { id: "donjon", label: "🏰 Donjon" },
  { id: "tour", label: "🗼 Tour" },
  { id: "catacombes", label: "💀 Catacombes" },
  { id: "labyrinthe", label: "💰 Labyrinthe" },
];

/** Composez votre donjon : nom, longueur, ambiance et dosage des cases. Les
 *  cases restantes deviennent des Questions ; gambits et trous noirs sont
 *  placés automatiquement (cœur / fin de parcours). */
function showBoardEditor(existing) {
  const d = existing ? {
    id: existing.id, nom: existing.nom, length: existing.length, theme: existing.theme,
    chance: existing.dist.chance ?? 0, evenement: existing.dist.evenement ?? 0,
    malus: existing.dist.malus ?? 0, pieces: existing.dist.pieces ?? 0, joker: existing.dist.joker ?? 0,
    nbGambits: existing.gambits.length, nbTrousNoirs: existing.trounoirs.length,
  } : { id: null, nom: "", length: 36, theme: "donjon", chance: 4, evenement: 3, malus: 3, pieces: 3, joker: 2, nbGambits: 1, nbTrousNoirs: 0 };
  const overlay = el("div", { class: "tuto-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Éditeur de plateau maison" });
  const render = () => {
    overlay.innerHTML = "";
    const apercu = makeCustomBoard(d);
    const counter = (emoji, label, key, min, max) => el("div", { class: "editor-counter" },
      el("span", { class: "editor-counter-label", text: `${emoji} ${label}` }),
      el("div", { class: "editor-counter-controls" },
        el("button", { class: "btn btn-small", type: "button", "aria-label": `Moins : ${label}`, onclick: () => { d[key] = Math.max(min, d[key] - 1); render(); } }, "−"),
        el("strong", { class: "editor-counter-val", text: String(d[key]) }),
        el("button", { class: "btn btn-small", type: "button", "aria-label": `Plus : ${label}`, onclick: () => { d[key] = Math.min(max, d[key] + 1); render(); } }, "+"),
      ),
    );
    const lenLabel = el("span", { class: "editor-counter-label", text: `📏 Longueur : ${d.length} cases` });
    overlay.append(
      el("div", { class: "tuto-card editor-card" },
        el("h2", { class: "tuto-titre", text: existing ? "🛠️ Modifier le plateau" : "🛠️ Votre plateau maison" }),
        el("input", {
          class: "name-input", placeholder: "Nom du donjon (ex. Le Donjon de Mamie)", maxlength: "40",
          value: d.nom, "aria-label": "Nom du plateau", oninput: (e) => { d.nom = e.target.value; },
        }),
        el("div", { class: "editor-counter" },
          lenLabel,
          el("input", {
            class: "editor-range", type: "range", min: "24", max: "64", step: "2", value: String(d.length),
            "aria-label": "Longueur du parcours",
            oninput: (e) => { d.length = parseInt(e.target.value, 10); lenLabel.textContent = `📏 Longueur : ${d.length} cases`; },
            onchange: () => render(),
          }),
        ),
        el("div", { class: "mode-switch", role: "radiogroup", "aria-label": "Ambiance du donjon" },
          ...EDITOR_THEMES.map((t) => el("button", {
            class: "seg-btn" + (d.theme === t.id ? " seg-on" : ""), type: "button",
            "aria-pressed": String(d.theme === t.id), onclick: () => { d.theme = t.id; render(); },
          }, t.label))),
        counter("🍀", "Cases Chance", "chance", 0, 8),
        counter("🎪", "Événements collectifs", "evenement", 0, 8),
        counter("💀", "Coups durs", "malus", 0, 8),
        counter("🪙", "Cases Pièces", "pieces", 0, 8),
        counter("🃏", "Jokers", "joker", 0, 4),
        counter("🎲", "Gambits", "nbGambits", 0, 3),
        counter("🕳️", "Trous noirs", "nbTrousNoirs", 0, 2),
        el("p", { class: "help-note", text: `Le reste du parcours sera des cases Question (≈ ${apercu.dist.question}) — plus une boutique, du savoir insolite et des défis d'expression semés automatiquement.` }),
        el("div", { class: "tuto-actions" },
          el("button", { class: "btn", type: "button", onclick: () => overlay.remove() }, "Annuler"),
          el("button", {
            class: "btn btn-gold", type: "button",
            onclick: () => {
              const def = makeCustomBoard(d);
              saveCustomBoard(def);
              selectedBoardId = def.id;
              overlay.remove();
              renderSetup();
            },
          }, "💾 Garder ce plateau"),
        ),
      ),
    );
  };
  render();
  document.body.append(overlay);
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

  // Effets sonores synthétisés (muetables, désactivés par défaut).
  const sfxBtn = document.getElementById("sfx-toggle");
  if (!sfxAvailable()) {
    sfxBtn.hidden = true;
  } else {
    const refreshSfx = () => {
      sfxBtn.textContent = sfxEnabled() ? "🔔 Sons" : "🔕 Sons";
      sfxBtn.setAttribute("aria-pressed", String(sfxEnabled()));
    };
    sfxBtn.addEventListener("click", () => {
      setSfx(!sfxEnabled());
      try { localStorage.setItem("donjon-sfx", sfxEnabled() ? "1" : "0"); } catch { /* ignore */ }
      refreshSfx();
      if (sfxEnabled()) sfx("coin"); // petit retour immédiat à l'activation
    });
    try { if (localStorage.getItem("donjon-sfx") === "1") setSfx(true); } catch { /* ignore */ }
    refreshSfx();
  }

  // Musique de fond procédurale (muetable, désactivée par défaut).
  const musicBtn = document.getElementById("music-toggle");
  if (!musicAvailable()) {
    musicBtn.hidden = true;
  } else {
    const refreshMusic = () => {
      musicBtn.textContent = musicEnabled() ? "🎵 Musique" : "🎶 Silence";
      musicBtn.setAttribute("aria-pressed", String(musicEnabled()));
    };
    musicBtn.addEventListener("click", () => {
      setMusic(!musicEnabled());
      try { localStorage.setItem("donjon-music", musicEnabled() ? "1" : "0"); } catch { /* ignore */ }
      refreshMusic();
    });
    try { if (localStorage.getItem("donjon-music") === "1") setMusic(true); } catch { /* ignore */ }
    refreshMusic();
  }

  document.getElementById("rules-back").addEventListener("click", () => {
    renderHome();
    show("home");
  });

  document.getElementById("custom-back").addEventListener("click", () => {
    renderHome();
    show("home");
  });

  document.getElementById("reglages-back").addEventListener("click", () => {
    renderHome();
    show("home");
  });

  document.getElementById("palmares-back").addEventListener("click", () => {
    renderHome();
    show("home");
  });

  document.getElementById("grimoire-back").addEventListener("click", () => {
    renderHome();
    show("home");
  });

  document.getElementById("help-btn").addEventListener("click", () => openReference());

  document.getElementById("quit-btn").addEventListener("click", () => {
    const gameVisible = !document.getElementById("screen-game").hidden;
    if (!gameVisible) {
      renderHome();
      show("home");
      return;
    }
    if (window.confirm("Quitter la partie ? Elle reste sauvegardée pour être reprise plus tard.")) {
      // Pause NOMMÉE facultative : la partie rejoint la liste de l'accueil et
      // libère la sauvegarde active pour une autre tablée.
      const nom = window.prompt("Donner un nom à cette partie en pause ? (laisser vide pour la garder simplement en cours)", "");
      if (nom && nom.trim()) archiveCurrent(nom.trim());
      renderHome();
      show("home");
    }
  });
}

/* ---------- boot ---------- */

async function boot() {
  loadPrefs(); // applique tôt les préférences d'accessibilité (police, couleurs…)
  loadPalmares(); // charge le palmarès persistant (parties, victoires, succès)
  wireHeader();
  warmVoices();
  try {
    await loadBank();
  } catch {
    // renderHome() shows the warning and disables new games (bankSize() === 0).
  }
  // Contenu des défis d'expression (case 🎭) : chargement résilient, la case
  // retombe proprement sur une petite récompense si le fichier manque.
  await loadWordgames().catch(() => {});
  renderHome();
  show("home");
  // Tutoriel au tout premier lancement (une seule fois — mémorisé ensuite).
  // Jamais pendant les tests automatisés (l'overlay bloquerait les clics).
  if (!getPrefs().tutoVu && !globalThis.__DONJON_TEST) showTutorial();

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
