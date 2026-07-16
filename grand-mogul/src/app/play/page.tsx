"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CastBar } from "@/components/CastBar";
import { HostBubble } from "@/components/HostBubble";
import { ThemeWheel } from "@/components/ThemeWheel";
import { TimerBar } from "@/components/TimerBar";
import { bankStats, ensureSeedLoaded, flagQuestion, markAsked, nextQuestion, prefetchBatch } from "@/lib/bank";
import { castLine, hostRetort } from "@/lib/cast";
import { QUESTION_TIME_S, applyCorrect, applyWrong, makeHint, makePlayer, pickEliminations } from "@/lib/engine";
import { haptics } from "@/lib/haptics";
import { host } from "@/lib/host";
import { idb, idbAvailable } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { THEME_BY_ID } from "@/lib/themes";
import { speak, stop as stopSpeech } from "@/lib/tts";
import type { CastId, MatchConfig, MatchRecord, PlayerState, StoredQuestion, ThemeDef } from "@/lib/types";

type Phase = "boot" | "intro" | "handoff" | "wheel" | "teaser" | "question" | "reveal" | "results" | "empty";

type Outcome = "correct" | "wrong" | "timeout" | "skip";

interface CastEvent {
  castId: CastId;
  line: string;
  retort: string | null;
}

const DEFAULT_CONFIG: MatchConfig = { mode: "solo", playerNames: ["Vous"], questionsPerPlayer: 10 };

function readConfig(): MatchConfig {
  try {
    const raw = sessionStorage.getItem("gm-config");
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as MatchConfig;
    if (!Array.isArray(parsed.playerNames) || parsed.playerNames.length === 0) return DEFAULT_CONFIG;
    return {
      mode: parsed.mode === "party" ? "party" : "solo",
      playerNames: parsed.playerNames.slice(0, 8),
      questionsPerPlayer: [5, 10, 15].includes(parsed.questionsPerPlayer) ? parsed.questionsPerPlayer : 10,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export default function PlayPage() {
  const router = useRouter();
  const [config, setConfig] = useState<MatchConfig>(DEFAULT_CONFIG);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<Phase>("boot");
  const [theme, setTheme] = useState<ThemeDef | null>(null);
  const [question, setQuestion] = useState<StoredQuestion | null>(null);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [doubled, setDoubled] = useState(false);
  const [extraTime, setExtraTime] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [hostLine, setHostLine] = useState("");
  const [castEvent, setCastEvent] = useState<CastEvent | null>(null);
  const [reported, setReported] = useState(false);
  const [saved, setSaved] = useState(false);

  // Guards async callbacks from previous turns (wheel timers, TTS chains…).
  const turnToken = useRef(0);
  const playersRef = useRef(players);
  playersRef.current = players;

  const totalTurns = config.playerNames.length * config.questionsPerPlayer;
  const currentIndex = players.length > 0 ? turn % players.length : 0;
  const current = players[currentIndex];
  const questionNumber = players.length > 0 ? Math.floor(turn / players.length) + 1 : 1;

  useEffect(() => {
    const cfg = readConfig();
    setConfig(cfg);
    setPlayers(cfg.playerNames.map((name, i) => makePlayer(i, name)));
    loadSettings();
    ensureSeedLoaded().then((count) => {
      if (count === 0) {
        setPhase("empty");
        return;
      }
      setHostLine(host.intro());
      setPhase("intro");
    });
    return () => stopSpeech();
  }, []);

  const speakSeq = useCallback(async (lines: [string, Parameters<typeof speak>[1]][]) => {
    const token = turnToken.current;
    for (const [text, speaker] of lines) {
      if (turnToken.current !== token) return;
      await speak(text, speaker);
    }
  }, []);

  const resetQuestionState = () => {
    setTheme(null);
    setQuestion(null);
    setEliminated([]);
    setHint(null);
    setDoubled(false);
    setExtraTime(0);
    setSelected(null);
    setOutcome(null);
    setCastEvent(null);
    setReported(false);
  };

  const enterTurn = useCallback(
    (nextTurn: number) => {
      turnToken.current += 1;
      stopSpeech();
      resetQuestionState();
      if (nextTurn >= totalTurns) {
        setPhase("results");
        return;
      }
      setTurn(nextTurn);
      if (config.mode === "party") {
        const name = config.playerNames[nextTurn % config.playerNames.length] ?? "";
        setHostLine(host.passDevice());
        setPhase("handoff");
        void speakSeq([[`Au tour de ${name}.`, "mogul"]]);
      } else {
        setPhase("wheel");
      }
    },
    [config, speakSeq, totalTurns],
  );

  const startMatch = () => {
    void speakSeq([[hostLine, "mogul"]]);
    enterTurn(0);
  };

  const onWheelResult = (t: ThemeDef) => {
    const token = turnToken.current;
    setTheme(t);
    const teaser = host.teaser(t.id);
    setHostLine(teaser);
    setPhase("teaser");
    void speakSeq([[teaser, "mogul"]]);
    const tier = playersRef.current[turn % playersRef.current.length]?.tier ?? 2;
    void nextQuestion(t.id, tier).then((q) => {
      if (turnToken.current !== token) return;
      if (!q) {
        setPhase("empty");
        return;
      }
      setQuestion(q);
      window.setTimeout(() => {
        if (turnToken.current === token) setPhase("question");
      }, 1700);
    });
  };

  const finishReveal = useCallback(
    (q: StoredQuestion, result: Outcome, quip: string) => {
      setOutcome(result);
      setPhase("reveal");
      setHostLine(quip);
      void markAsked(q.hash);
      const lead = host.anecdoteLeadIn();
      void speakSeq([
        [quip, "mogul"],
        [`${lead} ${q.anecdote}`, "mogul"],
      ]);
      // Keep the local bank fat: top up from the API while the player reads.
      void bankStats().then((s) => {
        if (s.fresh < 40) void prefetchBatch(q.theme, playersRef.current[turn % playersRef.current.length]?.tier ?? 3);
      });
    },
    [speakSeq, turn],
  );

  const onAnswer = (i: number) => {
    if (phase !== "question" || !question || !current) return;
    setSelected(i);
    const isCorrect = i === question.answerIndex;
    setPlayers((ps) =>
      ps.map((p, idx) =>
        idx === currentIndex ? (isCorrect ? applyCorrect(p, question.difficulty, doubled) : applyWrong(p)) : p,
      ),
    );
    if (isCorrect) haptics.correct();
    else haptics.wrong();
    finishReveal(question, isCorrect ? "correct" : "wrong", isCorrect ? host.quipCorrect() : host.quipWrong());
  };

  const onTimeout = useCallback(() => {
    if (!question || !current) return;
    setSelected(null);
    setPlayers((ps) => ps.map((p, idx) => (idx === currentIndex ? applyWrong(p) : p)));
    haptics.wrong();
    finishReveal(question, "timeout", host.quipTimeout());
  }, [question, current, currentIndex, finishReveal]);

  const onSkill = (id: CastId) => {
    if (phase !== "question" || !question || !current || current.skillsUsed[id]) return;
    haptics.skill();
    setPlayers((ps) =>
      ps.map((p, idx) => (idx === currentIndex ? { ...p, skillsUsed: { ...p.skillsUsed, [id]: true } } : p)),
    );
    const line = castLine(id);
    // One host↔cast exchange max per question: retort only on the first skill.
    const retort = castEvent === null ? hostRetort(id) : null;
    setCastEvent({ castId: id, line, retort });
    const speech: [string, Parameters<typeof speak>[1]][] = [[line, id]];
    if (retort) speech.push([retort, "mogul"]);
    void speakSeq(speech);

    switch (id) {
      case "gronk":
        setEliminated(pickEliminations(question.answerIndex, question.choices.length));
        break;
      case "lilune":
        setHint(makeHint(question.choices[question.answerIndex] ?? ""));
        break;
      case "bargol":
        setDoubled(true);
        break;
      case "melissandre":
        setExtraTime((s) => s + 15);
        break;
      case "fifrelin":
        // Skip: no points, streak preserved, but the anecdote is still served.
        finishReveal(question, "skip", retort ?? hostRetort(id));
        break;
    }
  };

  const onReport = () => {
    if (!question || reported) return;
    setReported(true);
    void flagQuestion(question, "signalée par le joueur");
  };

  const ranking = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);

  useEffect(() => {
    if (phase !== "results" || players.length === 0 || saved) return;
    setSaved(true);
    const record: MatchRecord = {
      id: `m-${Date.now()}`,
      date: Date.now(),
      mode: config.mode,
      players: players.map((p) => ({
        name: p.name,
        score: p.score,
        correct: p.correct,
        answered: p.answered,
        bestStreak: p.bestStreak,
      })),
    };
    if (idbAvailable()) void idb.put("scores", record).catch(() => {});
    const top = ranking[0];
    const ratio = top && top.answered > 0 ? top.correct / top.answered : 0;
    const line = host.resultsLine(ratio);
    setHostLine(line);
    void speakSeq([[line, "mogul"]]);
  }, [phase, players, saved, config.mode, ranking, speakSeq]);

  if (phase === "boot") {
    return (
      <main className="flex min-h-dvh items-center justify-center text-soft">
        <p aria-live="polite">Le Mogul ajuste son monocle…</p>
      </main>
    );
  }

  if (phase === "empty") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-4xl" aria-hidden>
          🎩
        </div>
        <HostBubble line="Plus de questions en réserve. Même moi, ça me laisse sans voix." />
        <button
          type="button"
          className="rounded-full bg-gold px-6 py-3 font-bold text-bg"
          onClick={() => router.push("/")}
        >
          Retour à l&apos;accueil
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      {/* HUD */}
      {phase !== "intro" && phase !== "results" && current ? (
        <header className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-ink">{current.name}</span>
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-soft">
              Palier {current.tier}
            </span>
            {current.streak >= 2 ? (
              <span className="text-xs" aria-label={`Série de ${current.streak}`}>
                🔥{current.streak}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-soft">
              Q{Math.min(questionNumber, config.questionsPerPlayer)}/{config.questionsPerPlayer}
            </span>
            <motion.span
              key={current.score}
              initial={{ scale: 1.25 }}
              animate={{ scale: 1 }}
              className="font-mono font-bold text-gold"
              aria-label={`Score : ${current.score} points`}
            >
              {current.score}
            </motion.span>
          </div>
        </header>
      ) : null}

      <AnimatePresence mode="wait">
        {phase === "intro" ? (
          <motion.section
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-8 text-center"
          >
            <div className="text-6xl" aria-hidden>
              🎩
            </div>
            <HostBubble line={hostLine} sub="LE GRAND MOGUL, en personne." />
            <button
              type="button"
              onClick={startMatch}
              className="rounded-2xl bg-gold px-10 py-4 font-display text-xl font-bold text-bg shadow-lg active:scale-95"
            >
              C&apos;est parti
            </button>
          </motion.section>
        ) : null}

        {phase === "handoff" && current ? (
          <motion.section
            key={`handoff-${turn}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
          >
            <p className="text-sm uppercase tracking-widest text-soft">Au tour de</p>
            <h2 className="font-display text-4xl font-bold text-gold">{current.name}</h2>
            <HostBubble line={hostLine} />
            <button
              type="button"
              onClick={() => setPhase("wheel")}
              className="rounded-2xl bg-gold px-10 py-4 font-display text-lg font-bold text-bg active:scale-95"
            >
              Je suis prêt·e
            </button>
          </motion.section>
        ) : null}

        {phase === "wheel" ? (
          <motion.section
            key={`wheel-${turn}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <h2 className="font-display text-xl font-bold text-ink">La roue des thèmes</h2>
            <ThemeWheel onResult={onWheelResult} />
          </motion.section>
        ) : null}

        {phase === "teaser" && theme ? (
          <motion.section
            key={`teaser-${turn}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
          >
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2 font-display text-lg font-bold" style={{ color: theme.color }}>
              <span aria-hidden>{theme.emoji}</span> {theme.name}
            </div>
            <HostBubble line={hostLine} />
          </motion.section>
        ) : null}

        {(phase === "question" || phase === "reveal") && question && current ? (
          <motion.section
            key={`q-${turn}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col gap-4"
          >
            <div className="flex items-center justify-between text-xs text-soft">
              <span className="flex items-center gap-1 font-semibold" style={{ color: THEME_BY_ID[question.theme].color }}>
                <span aria-hidden>{THEME_BY_ID[question.theme].emoji}</span> {THEME_BY_ID[question.theme].name}
              </span>
              <span>
                Difficulté {"★".repeat(question.difficulty)}
                {doubled ? " · MISE ×2" : ""}
              </span>
            </div>

            {phase === "question" ? (
              <TimerBar seconds={QUESTION_TIME_S} extraSeconds={extraTime} running={phase === "question"} onTimeout={onTimeout} />
            ) : null}

            <div className="rounded-2xl border border-line bg-card p-5">
              <p className="font-display text-lg font-semibold leading-snug text-ink">{question.question}</p>
              {hint && phase === "question" ? (
                <p className="mt-2 text-sm italic text-gold">🌙 {hint}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2" role="group" aria-label="Choix de réponse">
              {question.choices.map((choice, i) => {
                const isAnswer = i === question.answerIndex;
                const isSelected = i === selected;
                const isEliminated = eliminated.includes(i);
                let cls = "border-line bg-surface text-ink";
                if (phase === "reveal") {
                  if (isAnswer) cls = "border-good bg-good/15 text-ink font-bold";
                  else if (isSelected) cls = "border-bad bg-bad/15 text-soft line-through";
                  else cls = "border-line bg-surface text-soft opacity-60";
                } else if (isEliminated) {
                  cls = "border-line bg-surface text-soft opacity-30 line-through";
                }
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={phase !== "question" || isEliminated}
                    onClick={() => onAnswer(i)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99] ${cls}`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-[15px] leading-snug">{choice}</span>
                    {phase === "reveal" && isAnswer ? <span className="ml-auto" aria-hidden>✅</span> : null}
                  </button>
                );
              })}
            </div>

            {castEvent ? (
              <div className="rounded-xl border border-line bg-surface px-4 py-2 text-sm">
                <p className="font-semibold text-ink">
                  {castEvent.line}
                </p>
                {castEvent.retort ? <p className="mt-1 text-xs italic text-soft">🎩 {castEvent.retort}</p> : null}
              </div>
            ) : null}

            {phase === "question" ? (
              <div className="mt-auto">
                <CastBar player={current} disabled={false} onSkill={onSkill} />
              </div>
            ) : null}

            {phase === "reveal" ? (
              <div className="flex flex-col gap-3">
                <HostBubble
                  line={hostLine}
                  sub={
                    outcome === "correct"
                      ? doubled
                        ? "Mise doublée encaissée."
                        : undefined
                      : outcome === "skip"
                        ? "Question esquivée avec panache."
                        : undefined
                  }
                />
                <div className="rounded-2xl border border-gold/40 bg-surface p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gold">📜 L&apos;anecdote du Mogul</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{question.anecdote}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {question.sources.slice(0, 3).map((src, i) => {
                      let label = `source ${i + 1}`;
                      try {
                        label = new URL(src).hostname.replace(/^www\./, "");
                      } catch {
                        /* keep fallback label */
                      }
                      return (
                        <a
                          key={i}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-line px-2.5 py-1 text-[11px] text-soft underline-offset-2 hover:text-gold"
                        >
                          {label}
                        </a>
                      );
                    })}
                    <button
                      type="button"
                      onClick={onReport}
                      disabled={reported}
                      className="ml-auto text-[11px] text-soft underline-offset-2 hover:text-bad disabled:opacity-60"
                    >
                      {reported ? "🚩 Signalée — merci" : "🚩 Signaler une erreur"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => enterTurn(turn + 1)}
                  className="rounded-2xl bg-gold py-4 font-display text-lg font-bold text-bg shadow-lg active:scale-[0.98]"
                >
                  {turn + 1 >= totalTurns ? "Voir le verdict" : "Continuer"}
                </button>
              </div>
            ) : null}
          </motion.section>
        ) : null}

        {phase === "results" ? (
          <motion.section
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col gap-6 pt-4"
          >
            <h2 className="text-center font-display text-3xl font-bold text-gold">Le verdict</h2>
            <HostBubble line={hostLine} />
            <ol className="flex flex-col gap-2" aria-label="Classement">
              {ranking.map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    i === 0 ? "border-gold bg-card" : "border-line bg-surface"
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎓"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold text-ink">{p.name}</p>
                    <p className="text-xs text-soft">
                      {p.correct}/{p.answered} bonnes réponses · meilleure série {p.bestStreak}
                    </p>
                  </div>
                  <span className="font-mono text-lg font-bold text-gold">{p.score}</span>
                </li>
              ))}
            </ol>
            <div className="mt-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlayers(config.playerNames.map((name, i) => makePlayer(i, name)));
                  setSaved(false);
                  setHostLine(host.intro());
                  setPhase("intro");
                  setTurn(0);
                }}
                className="rounded-2xl bg-gold py-4 font-display text-lg font-bold text-bg active:scale-[0.98]"
              >
                Revanche
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-2xl border border-line bg-surface py-3 font-semibold text-ink active:scale-[0.98]"
              >
                Retour à l&apos;accueil
              </button>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
