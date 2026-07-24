// Manifeste exécutable des accroches du Grand Héraut. Les chemins restent des
// chaînes littérales : le constructeur du fichier autonome peut ainsi remplacer
// chaque WebM par une data-URI, sans requête réseau et jusque sous file://.

export const HOST_PROFILE = Object.freeze({
  lang: "fr-FR",
  pitch: 1.08,
  rate: 1.02,
  volume: 1,
  preferredVoiceHints: ["premium", "enhanced", "natural", "france", "fr-fr"],
});

export const HOST_CUES = Object.freeze({
  question: Object.freeze([
    { id: "question-01", src: "assets/voix/question-01.webm", text: "Attention, les neurones entrent en scène !" },
    { id: "question-02", src: "assets/voix/question-02.webm", text: "Question en approche. Les sourcils sont autorisés à réfléchir." },
    { id: "question-03", src: "assets/voix/question-03.webm", text: "Silence dans le donjon, juste assez pour entendre la question." },
    { id: "question-04", src: "assets/voix/question-04.webm", text: "À vos cerveaux, prêts, pensez !" },
    { id: "question-05", src: "assets/voix/question-05.webm", text: "Le donjon pose la question. Prenez tout votre temps." },
    { id: "question-06", src: "assets/voix/question-06.webm", text: "Celle-ci est très sérieuse. Enfin, elle essaie." },
    { id: "question-07", src: "assets/voix/question-07.webm", text: "Ouvrez grand les oreilles et le petit tiroir à savoir." },
    { id: "question-08", src: "assets/voix/question-08.webm", text: "Question fraîche, servie sans chronomètre." },
    { id: "question-09", src: "assets/voix/question-09.webm", text: "Le savoir frappe à la porte. On lui ouvre !" },
    { id: "question-10", src: "assets/voix/question-10.webm", text: "Attention, question avec supplément panache." },
    { id: "question-11", src: "assets/voix/question-11.webm", text: "Le prochain indice est la question elle-même." },
    { id: "question-12", src: "assets/voix/question-12.webm", text: "Concentration royale. Voici la question !" },
  ]),
  anecdote: Object.freeze([
    { id: "anecdote-01", src: "assets/voix/anecdote-01.webm", text: "Et voici le petit trésor derrière la réponse." },
    { id: "anecdote-02", src: "assets/voix/anecdote-02.webm", text: "Minute culture. Elle dure le temps qu'il faut." },
    { id: "anecdote-03", src: "assets/voix/anecdote-03.webm", text: "L'anecdote arrive, bien coiffée et presque à l'heure." },
    { id: "anecdote-04", src: "assets/voix/anecdote-04.webm", text: "Le saviez-vous ? Le donjon, lui, vient de l'apprendre." },
    { id: "anecdote-05", src: "assets/voix/anecdote-05.webm", text: "Place au détail qui fait briller les lunettes." },
    { id: "anecdote-06", src: "assets/voix/anecdote-06.webm", text: "Un peu de savoir en plus, ça ne prend aucune place." },
    { id: "anecdote-07", src: "assets/voix/anecdote-07.webm", text: "Attention, anecdote à raconter dès demain." },
    { id: "anecdote-08", src: "assets/voix/anecdote-08.webm", text: "Le rideau se lève sur les coulisses du savoir." },
    { id: "anecdote-09", src: "assets/voix/anecdote-09.webm", text: "Bonus de culture, sans supplément de prix." },
    { id: "anecdote-10", src: "assets/voix/anecdote-10.webm", text: "Et maintenant, le pourquoi du comment." },
    { id: "anecdote-11", src: "assets/voix/anecdote-11.webm", text: "Une réponse, c'est bien. Son histoire, c'est encore mieux." },
    { id: "anecdote-12", src: "assets/voix/anecdote-12.webm", text: "Le grand héraut ouvre son tiroir à anecdotes." },
  ]),
  bonne: Object.freeze([
    { id: "bonne-01", src: "assets/voix/bonne-01.webm", text: "Bonne réponse ! Les neurones saluent la performance." },
    { id: "bonne-02", src: "assets/voix/bonne-02.webm", text: "Exact ! Le donjon applaudit avec ses deux mains." },
    { id: "bonne-03", src: "assets/voix/bonne-03.webm", text: "Bien joué ! Une réponse nette, sans miettes." },
    { id: "bonne-04", src: "assets/voix/bonne-04.webm", text: "C'est juste ! Même la pierre avait parié sur vous." },
    { id: "bonne-05", src: "assets/voix/bonne-05.webm", text: "Magnifique ! Le savoir vous va très bien." },
    { id: "bonne-06", src: "assets/voix/bonne-06.webm", text: "Réponse validée avec panache et petit bruit de trompette." },
  ]),
  mauvaise: Object.freeze([
    { id: "mauvaise-01", src: "assets/voix/mauvaise-01.webm", text: "Raté, mais avec une élégance remarquable." },
    { id: "mauvaise-02", src: "assets/voix/mauvaise-02.webm", text: "Pas cette fois. Le savoir revient au prochain tour." },
    { id: "mauvaise-03", src: "assets/voix/mauvaise-03.webm", text: "Presque ! Enfin, à quelques connaissances près." },
    { id: "mauvaise-04", src: "assets/voix/mauvaise-04.webm", text: "Le donjon dit non, mais très gentiment." },
    { id: "mauvaise-05", src: "assets/voix/mauvaise-05.webm", text: "Réponse cabossée. Anecdote toute neuve en échange." },
    { id: "mauvaise-06", src: "assets/voix/mauvaise-06.webm", text: "Ce n'est pas juste, mais personne ne perd son goûter." },
  ]),
});

let lastByKind = new Map();

/** Tire une accroche sans répéter immédiatement la précédente de sa catégorie. */
export function pickHostCue(kind) {
  const pool = HOST_CUES[kind];
  if (!pool?.length) return null;
  const previous = lastByKind.get(kind);
  if (!Number.isInteger(previous)) {
    const index = Math.floor(Math.random() * pool.length);
    lastByKind.set(kind, index);
    return pool[index];
  }
  const offset = Math.floor(Math.random() * Math.max(1, pool.length - 1));
  const index = pool.length > 1 && offset >= previous ? offset + 1 : offset;
  lastByKind.set(kind, index);
  return pool[index];
}

/** Remet à zéro l'historique, utile entre deux parties et dans les tests. */
export function resetHostCues() {
  lastByKind = new Map();
}
