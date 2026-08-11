// ⚡ PARTIE ÉCLAIR — le Donjon sans plateau : les questions s'enchaînent, pur
// et nerveux, taillé pour UN téléphone qui passe de main en main (ou en solo).
// Toujours les règles d'or de la maison : JAMAIS de chronomètre par réponse,
// jamais d'élimination entre joueurs, une anecdote après chaque question.
//
// Les douze idées du mode :
//  1. Sprint pur : question → verdict → anecdote → suivant, zéro friction.
//  2. Série de feu : bonnes réponses d'affilée → multiplicateur ×2 puis ×3.
//  3. Étages du Donjon : la difficulté grimpe d'un étage toutes les 5 questions.
//  4. Pass-and-play : chacun sa question à son tour, scores côte à côte.
//  5. Solo « 3 boucliers » : trois erreurs et le sprint s'achève — record à battre.
//  6. Jokers éclair (1 chacun par sprint) : 50/50, Passer, Indice-anecdote.
//  7. Thème du sprint : tout le menu, ou un seul thème à la carte.
//  8. Enchaînement mains libres : lecture + auto-avance, pour jouer sans les mains.
//  9. Le Héraut vocal : accroches et verdicts avec ses clips enregistrés.
// 10. Vibrations discrètes du téléphone sur les verdicts (si l'appareil sait).
// 11. Récap croustillant : podium, meilleure série, anecdotes à ressortir à table.
// 12. Records locaux par distance + palmarès général nourri (érudits, sans-faute).
import { choixAffiches, drawQuestion } from "./data.js";
import { AGE_BRACKETS, getState } from "./state.js";
import { themeMeta, THEME_ORDER } from "./themes.js";
import { say, sayHost, stop as stopVoix } from "./tts.js";
import { herald } from "./herald.js";
import { sfx } from "./sfx.js";
import { recordGame } from "./palmares.js";
import { el } from "./ui.js";
import { visuelEl } from "./visuels.js";
import { QUESTIONS_SON, jouerSon, sonMystereDispo, stopSon } from "./sonmystere.js";

const RECORD_KEY = "donjon-eclair-records";
const DISTANCES = [10, 20, 30, 50];

let partie = null;

/* ---------- réglages du sprint ---------- */

const litRecords = () => { try { return JSON.parse(localStorage.getItem(RECORD_KEY)) ?? {}; } catch { return {}; } };
const poseRecord = (cle, score) => {
  const r = litRecords();
  if (score > (r[cle] ?? 0)) { r[cle] = score; try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* privé */ } return true; }
  return false;
};

function joueursParDefaut() {
  // On reprend la tablée du plateau si elle existe : mêmes prénoms, mêmes âges.
  const pions = getState()?.pions?.filter((p) => !p.bot) ?? [];
  if (pions.length) return pions.slice(0, 8).map((p) => ({ nom: p.nom, bracket: p.bracket ?? "9-11" }));
  return [{ nom: "Champion", bracket: "9-11" }];
}

export function renderEclairSetup() {
  const zone = document.getElementById("eclair-zone");
  zone.innerHTML = "";
  const cfg = {
    joueurs: joueursParDefaut(),
    total: 20,
    theme: null, // null = menu dégustation
    auto: false,
  };

  const rendu = () => {
    zone.innerHTML = "";
    zone.append(el("h1", { class: "screen-title", text: "⚡ Partie Éclair" }),
      el("p", { class: "help-note", text: "Le Donjon sans plateau : les questions s'enchaînent, le téléphone passe de main en main. Série de feu, étages de difficulté, jokers — et toujours zéro chrono, zéro éliminé." }));

    // Joueurs (1 à 8) : prénom + tranche d'âge.
    const bloc = el("div", { class: "eclair-setup" });
    cfg.joueurs.forEach((j, i) => {
      const b = AGE_BRACKETS.find((x) => x.id === j.bracket) ?? AGE_BRACKETS[2];
      bloc.append(el("div", { class: "eclair-joueur-row" },
        el("input", { class: "name-input", value: j.nom, maxlength: "16", "aria-label": `Prénom du joueur ${i + 1}`, oninput: (e) => { j.nom = e.target.value || `Joueur ${i + 1}`; } }),
        el("button", { class: "btn btn-small", type: "button", title: "Tranche d'âge", onclick: () => {
          const k = AGE_BRACKETS.findIndex((x) => x.id === j.bracket);
          j.bracket = AGE_BRACKETS[(k + 1) % AGE_BRACKETS.length].id;
          rendu();
        } }, `${b.emoji} ${b.label}`),
        cfg.joueurs.length > 1 ? el("button", { class: "btn btn-small", type: "button", "aria-label": "Retirer ce joueur", onclick: () => { cfg.joueurs.splice(i, 1); rendu(); } }, "✖") : el("span", {}),
      ));
    });
    if (cfg.joueurs.length < 8) {
      bloc.append(el("button", { class: "btn btn-small", type: "button", onclick: () => { cfg.joueurs.push({ nom: `Joueur ${cfg.joueurs.length + 1}`, bracket: "9-11" }); rendu(); } }, "＋ Ajouter un joueur"));
    }
    zone.append(bloc);

    // Distance du sprint.
    zone.append(el("h2", { class: "setup-subtitle", text: "Distance du sprint" }),
      el("div", { class: "mode-switch", role: "radiogroup", "aria-label": "Nombre de questions" },
        ...DISTANCES.map((n) => el("button", {
          class: "btn btn-toggle" + (cfg.total === n ? " btn-toggle-on" : ""),
          type: "button", role: "radio", "aria-checked": String(cfg.total === n),
          onclick: () => { cfg.total = n; rendu(); },
        }, `${n} questions`))));

    // Thème du sprint : menu dégustation ou un seul thème.
    zone.append(el("h2", { class: "setup-subtitle", text: "Menu du sprint" }));
    const themes = el("div", { class: "eclair-themes" },
      el("button", { class: "btn btn-toggle" + (cfg.theme === null ? " btn-toggle-on" : ""), type: "button", onclick: () => { cfg.theme = null; rendu(); } }, "🍽️ Menu dégustation (tout)"),
      ...THEME_ORDER.map((t) => {
        const m = themeMeta(t);
        return el("button", { class: "btn btn-toggle btn-small" + (cfg.theme === t ? " btn-toggle-on" : ""), type: "button", onclick: () => { cfg.theme = t; rendu(); } }, `${m.emoji ?? "🎯"} ${t}`);
      }));
    zone.append(themes);

    // Mains libres.
    zone.append(el("label", { class: "eclair-auto" },
      el("input", { type: "checkbox", checked: cfg.auto ? "checked" : undefined, onchange: (e) => { cfg.auto = e.target.checked; } }),
      el("span", { text: " 🙌 Enchaînement mains libres : questions et anecdotes lues, la suite arrive toute seule (activez le Héraut vocal !)" })));

    zone.append(el("button", { class: "btn btn-big eclair-go", type: "button", onclick: () => startEclair(cfg) }, "⚡ C'est parti !"));
    zone.append(el("button", { class: "btn", type: "button", onclick: () => { stopVoix(); window.__donjonShow?.("home"); } }, "← Retour"));
  };
  rendu();
}

/* ---------- le sprint ---------- */

function startEclair(cfg) {
  partie = {
    joueurs: cfg.joueurs.map((j) => ({
      ...j, score: 0, bonnes: 0, questions: 0, serie: 0, meilleureSerie: 0,
      boucliers: cfg.joueurs.length === 1 ? 3 : null,
      jokers: { moitie: true, passe: true, indice: true },
    })),
    total: cfg.total, theme: cfg.theme, auto: cfg.auto,
    tour: 0, vus: new Set(), aRessortir: [], finie: false,
  };
  sfx("fanfare");
  say(herald.ouverture(), { perso: "heraut" });
  prochaineQuestion();
}

const etageDe = () => 1 + Math.floor(partie.tour / (5 * Math.max(1, partie.joueurs.length)));
const multiplicateurDe = (serie) => serie >= 6 ? 3 : serie >= 3 ? 2 : 1;

function prochaineQuestion() {
  if (!partie || partie.finie) return;
  const j = partie.joueurs[partie.tour % partie.joueurs.length];
  if (partie.tour >= partie.total || (j.boucliers !== null && j.boucliers <= 0)) return finDeSprint();

  const etage = Math.min(5, etageDe());
  // 🔊 LE SON MYSTÈRE s'invite aussi dans le sprint (~1 question sur 9) : une
  // respiration bienvenue au milieu du texte. Jamais si le thème est imposé
  // (on a promis un sprint sur CE thème) ni si l'appareil n'a pas d'audio.
  if (!partie.theme && sonMystereDispo() && (window.__DONJON_SON || Math.random() < 0.11)) {
    return montreQuestion(j, questionSon(), etage);
  }
  const q = drawQuestion({ nom: j.nom, bracket: j.bracket, niveau: etage }, {
    formats: ["qcm", "vrai_faux"],
    categories: partie.theme ? [partie.theme] : null,
    exclude: partie.vus,
  });
  if (!q) return finDeSprint(); // thème épuisé pour cette tranche : on conclut
  partie.vus.add(q.id);
  montreQuestion(j, q, etage);
}

// Questions déjà échangées : le secours ne joue qu'une fois par question.
const changees = new Set();

/** Fabrique une question « Son Mystère » à la volée : même forme qu'une
 *  question de la banque, pour traverser le sprint sans cas particulier. */
function questionSon() {
  const item = QUESTIONS_SON[Math.floor(Math.random() * QUESTIONS_SON.length)];
  return {
    id: `son-${item.son}`, categorie: "Musique", format: "qcm",
    difficulte: 2, niveau_age: "enfant",
    texte: "Écoutez bien… quel est ce son ?",
    choix: choixAffiches(null, [item.reponse, ...item.leurres]),
    bonne_reponse: item.reponse, anecdote: item.anecdote, son: item.son,
  };
}

function montreQuestion(j, q, etage) {
  const zone = document.getElementById("eclair-zone");
  zone.innerHTML = "";
  const m = themeMeta(q.categorie);
  const mult = multiplicateurDe(j.serie);
  const numero = partie.tour + 1;

  // Bandeau : qui joue, où on en est, la série de feu.
  zone.append(el("div", { class: "eclair-bandeau" },
    el("div", { class: "eclair-qui" },
      el("strong", { text: j.nom }),
      el("span", { class: "eclair-score", text: `${j.score} pts` }),
      j.boucliers !== null ? el("span", { class: "eclair-boucliers", text: "🛡".repeat(Math.max(0, j.boucliers)) }) : el("span", {}),
    ),
    el("div", { class: "eclair-etat" },
      el("span", { text: `Q ${numero}/${partie.total}` }),
      el("span", { class: "eclair-etage", text: `🏰 Étage ${etage}` }),
      el("span", { class: "eclair-serie" + (j.serie >= 3 ? " eclair-serie-feu" : ""), text: j.serie > 0 ? `🔥${j.serie}${mult > 1 ? ` ×${mult}` : ""}` : "" }),
    )));

  // La carte question, plein pouce. Le VISUEL passe avant l'énoncé : sans lui,
  // « quel pays reconnaissez-vous à sa carte ? » n'a aucune réponse possible —
  // une question sur quatre était injouable ici.
  const carte = el("div", { class: "eclair-carte" });
  carte.append(...[
    el("span", { class: "eclair-theme", style: `background:${m.color ?? "#4a6fb5"}`, text: `${m.emoji ?? "🎯"} ${q.categorie}` }),
    visuelEl(q.visuel),
    el("p", { class: "eclair-texte", text: q.texte }),
  ].filter(Boolean));
  // Un bouton de réécoute pour le Son Mystère — autant de fois qu'on veut,
  // il n'y a pas plus de chronomètre ici qu'ailleurs.
  if (q.son) {
    carte.append(el("button", { class: "btn btn-small eclair-reecoute", type: "button", onclick: () => jouerSon(q.son) }, "🔊 (Ré)écouter le son"));
  }
  zone.append(carte);
  sayHost(q.texte, "question");
  if (q.son) setTimeout(() => jouerSon(q.son), 900); // après la consigne, jamais par-dessus

  // Même règle qu'au plateau : l'ordre des propositions est tiré au sort, sinon
  // « je prends la première » suffit à gagner deux fois sur trois.
  const choix = q.format === "vrai_faux" ? ["Vrai", "Faux"] : choixAffiches(q, (q.choix ?? []).slice(0, 4));
  const bonne = q.format === "vrai_faux" ? (q.bonne_reponse ?? q.reponse) : q.bonne_reponse;
  const boutons = choix.map((c) => el("button", {
    class: "btn eclair-choix", type: "button",
    onclick: (e) => repond(j, q, String(c), String(bonne), e.target),
  }, String(c)));
  const grille = el("div", { class: "eclair-grille" + (choix.length === 2 ? " eclair-grille-2" : "") }, ...boutons);
  zone.append(grille);

  // 🔄 Dépannage : une question incomprise ne doit pas gâcher le sprint. Une
  // seule fois par question, et SANS consommer le joker « Passer » — celui-ci
  // reste un choix tactique, ceci n'est qu'un secours.
  if (!changees.has(q.id)) {
    zone.append(el("button", {
      class: "btn btn-small changer-question", type: "button",
      onclick: () => { changees.add(q.id); prochaineQuestion(); },
    }, "🔄 On n'a pas compris — changer de question"));
  }

  // Jokers éclair du joueur (une cartouche de chaque par sprint).
  const jokers = el("div", { class: "eclair-jokers" });
  if (j.jokers.moitie && q.format === "qcm" && choix.length === 4) {
    jokers.append(el("button", { class: "btn btn-small", type: "button", onclick: (e) => {
      j.jokers.moitie = false; e.target.remove(); sfx("power");
      const faux = boutons.filter((b) => b.textContent !== String(bonne));
      faux.sort(() => Math.random() - 0.5).slice(0, 2).forEach((b) => { b.disabled = true; b.classList.add("eclair-efface"); });
    } }, "🪄 50 / 50"));
  }
  if (j.jokers.passe) {
    jokers.append(el("button", { class: "btn btn-small", type: "button", onclick: () => {
      j.jokers.passe = false; sfx("drum");
      prochaineQuestion(); // même tour : une autre question, sans pénalité
    } }, "🔁 Passer"));
  }
  if (j.jokers.indice) {
    jokers.append(el("button", { class: "btn btn-small", type: "button", onclick: (e) => {
      j.jokers.indice = false; e.target.remove(); sfx("ooh");
      carte.append(el("p", { class: "eclair-indice", text: `📜 Indice du Héraut : ${q.anecdote}` }));
    } }, "📜 Indice"));
  }
  zone.append(jokers);
  zone.append(el("button", { class: "btn btn-small eclair-stop", type: "button", onclick: () => finDeSprint() }, "🏁 Terminer ici"));
}

function repond(j, q, choisi, bonne, bouton) {
  if (q.son) stopSon(); // le verdict est annoncé : on ne parle pas par-dessus le bruitage
  const ok = choisi === bonne;
  j.questions += 1;
  partie.tour += 1;
  try { navigator.vibrate?.(ok ? 25 : [40, 60, 40]); } catch { /* pas de vibreur */ }
  if (ok) {
    j.serie += 1;
    j.meilleureSerie = Math.max(j.meilleureSerie, j.serie);
    const points = 1 * multiplicateurDe(j.serie);
    j.score += points; j.bonnes += 1;
    sfx(j.serie === 3 || j.serie === 6 ? "fanfare" : "clap");
    if (j.serie === 3 || j.serie === 6) say(herald.bonne(), { perso: "heraut" });
  } else {
    j.serie = 0;
    if (j.boucliers !== null) j.boucliers -= 1;
    sfx("malus");
    if (partie.tour % 3 === 0) say(herald.mauvaise(), { perso: "heraut" });
    partie.aRessortir.push(q);
  }
  montreVerdict(j, q, ok, choisi, bonne, bouton);
}

function montreVerdict(j, q, ok, choisi, bonne, bouton) {
  bouton?.classList.add(ok ? "eclair-bonne" : "eclair-mauvaise");
  const zone = document.getElementById("eclair-zone");
  const mult = multiplicateurDe(j.serie);
  const carte = el("div", { class: "eclair-verdict " + (ok ? "eclair-v-bonne" : "eclair-v-mauvaise") },
    el("p", { class: "eclair-v-titre", text: ok ? `✅ Exact${mult > 1 ? ` — série de feu ×${mult} !` : " !"}` : `❌ C'était : ${bonne}` }),
    el("p", { class: "eclair-v-anecdote", text: `📜 ${q.anecdote}` }),
  );
  const suite = el("button", { class: "btn btn-big eclair-suivant", type: "button", onclick: () => { stopVoix(); prochaineQuestion(); } },
    partie.tour >= partie.total ? "🏁 Voir le résultat" : "➜ Question suivante");
  zone.append(carte, suite);
  suite.focus();
  sayHost(q.anecdote, "anecdote");
  if (partie.auto) setTimeout(() => { if (partie && !partie.finie && document.contains(suite)) suite.click(); }, 6500);
}

/* ---------- le récap croustillant ---------- */

function finDeSprint() {
  if (!partie || partie.finie) return;
  partie.finie = true;
  stopVoix();
  const zone = document.getElementById("eclair-zone");
  zone.innerHTML = "";
  const classement = [...partie.joueurs].sort((a, b) => b.score - a.score);
  const gagnant = classement[0];
  sfx("win");
  say(herald.victoire ? herald.victoire(gagnant.nom) : `Bravo ${gagnant.nom} !`, { perso: "heraut" });

  zone.append(el("h1", { class: "screen-title", text: "⚡ Résultat du sprint" }));
  const podium = el("div", { class: "eclair-podium" });
  classement.forEach((j, i) => {
    const taux = j.questions ? Math.round((j.bonnes / j.questions) * 100) : 0;
    podium.append(el("div", { class: "eclair-podium-row" + (i === 0 ? " eclair-podium-or" : "") },
      el("span", { class: "eclair-medaille", text: ["🥇", "🥈", "🥉"][i] ?? "🎖️" }),
      el("strong", { text: j.nom }),
      el("span", { text: `${j.score} pts · ${j.bonnes}/${j.questions} (${taux} %) · 🔥 meilleure série ${j.meilleureSerie}` }),
    ));
  });
  zone.append(podium);

  // Record local par distance (le score du 1er).
  const cleRecord = `${partie.total}q${partie.theme ? `-${partie.theme}` : ""}`;
  if (poseRecord(cleRecord, gagnant.score)) {
    zone.append(el("p", { class: "eclair-record", text: `🏆 NOUVEAU RECORD sur ${partie.total} questions${partie.theme ? ` (${partie.theme})` : ""} : ${gagnant.score} points !` }));
  } else {
    const r = litRecords()[cleRecord];
    if (r) zone.append(el("p", { class: "help-note", text: `Record à battre sur cette distance : ${r} points.` }));
  }

  // Trois anecdotes à ressortir à table (celles des questions ratées).
  const perles = partie.aRessortir.slice(-3);
  if (perles.length) {
    zone.append(el("h2", { class: "setup-subtitle", text: "📜 À ressortir à table" }),
      ...perles.map((q) => el("p", { class: "eclair-perle", text: `• ${q.anecdote}` })));
  }

  // Palmarès général : le sprint nourrit les mêmes compteurs que le plateau.
  try { recordGame({ pions: partie.joueurs.map((j) => ({ ...j, bot: false })), winner: gagnant.nom, mode: "eclair" }); } catch { /* jamais bloquant */ }

  const cfg = { joueurs: partie.joueurs.map((j) => ({ nom: j.nom, bracket: j.bracket })), total: partie.total, theme: partie.theme, auto: partie.auto };
  zone.append(el("div", { class: "eclair-fin-actions" },
    el("button", { class: "btn btn-big", type: "button", onclick: () => startEclair(cfg) }, "⚡ Revanche !"),
    el("button", { class: "btn", type: "button", onclick: () => renderEclairSetup() }, "🎛️ Changer le menu"),
    el("button", { class: "btn", type: "button", onclick: () => { partie = null; window.__donjonShow?.("home"); } }, "🏰 Retour au Donjon"),
  ));
}
