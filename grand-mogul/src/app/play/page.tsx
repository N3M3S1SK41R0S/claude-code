"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CastBar } from "@/components/CastBar";
import { HostBubble } from "@/components/HostBubble";
import { ThemeWheel } from "@/components/ThemeWheel";
import { bankStats, ensureSeedLoaded, flagQuestion, markAsked, nextQuestion, prefetchBatch } from "@/lib/bank";
import { castLine, hostRetort } from "@/lib/cast";
import {
  answerMatches,
  applyCorrect,
  applyWrong,
  CCD_MULTIPLIER,
  type CcdMode,
  CONFIDENCE,
  type ConfidenceLevel,
  basePoints,
  correctTexts,
  gambitMultiplier,
  makeHint,
  makePlayer,
  pickEliminations,
} from "@/lib/engine";
import { haptics } from "@/lib/haptics";
import { host } from "@/lib/host";
import { idb, idbAvailable } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { THEME_BY_ID } from "@/lib/themes";
import { speak, stop as stopSpeech } from "@/lib/tts";
import type { CastId, MatchConfig, MatchRecord, PlayerState, StoredQuestion, ThemeDef } from "@/lib/types";

type Phase = "boot" | "intro" | "handoff" | "wheel" | "teaser" | "question" | "reveal" | "results" | "empty";

type Outcome = "correct" | "wrong" | "skip";

interface CastEvent {
  castId: CastId;
  line: string;
  retort: string | null;
}

const DEFAULT_CONFIG: MatchConfig = { mode: "solo", playerNames: ["Vous"], questionsPerPlayer: 10, audience: "adulte" };

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
      audience: ["enfant", "ado", "adulte"].includes(parsed.audience) ? parsed.audience : "adulte",
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

  // Per-question interaction state.
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [doubled, setDoubled] = useState(false);
  const [secondChance, setSecondChance] = useState(false);
  const [secondChanceUsed, setSecondChanceUsed] = useState(false);
  const [ccdMode, setCcdMode] = useState<CcdMode | null>(null);
  const [duoChoices, setDuoChoices] = useState<number[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [overrideOffered, setOverrideOffered] = useState(false);
  const [pendingMultiplier, setPendingMultiplier] = useState(1);

  const [hostLine, setHostLine] = useState("");
  const [castEvent, setCastEvent] = useState<CastEvent | null>(null);
  const [reported, setReported] = useState(false);
  const [saved, setSaved] = useState(false);
  const [quitAsk, setQuitAsk] = useState(false);

  // Guards async callbacks from previous turns (wheel timers, TTS chains…).
  const turnToken = useRef(0);
  const playersRef = useRef(players);
  playersRef.current = players;
  // Hashes served during this match: recycling the bank can't repeat them.
  const servedRef = useRef<Set<string>>(new Set());
  // Player state before the current resolution, for the honor-system override.
  const snapshotRef = useRef<PlayerState | null>(null);

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
    setSecondChance(false);
    setSecondChanceUsed(false);
    setCcdMode(null);
    setDuoChoices([]);
    setConfidence(null);
    setTextAnswer("");
    setSelected(null);
    setTypedAnswer(null);
    setOutcome(null);
    setPointsEarned(0);
    setOverrideOffered(false);
    setPendingMultiplier(1);
    setCastEvent(null);
    setReported(false);
    setQuitAsk(false);
    snapshotRef.current = null;
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
    // Party mode announces the first player right away — speaking the intro
    // too would make two concurrent voices fight for the speaker.
    if (config.mode === "solo") void speakSeq([[hostLine, "mogul"]]);
    servedRef.current.clear();
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
    nextQuestion(t.id, tier, config.audience, servedRef.current)
      .then((q) => {
        if (turnToken.current !== token) return;
        if (!q) {
          setPhase("empty");
          return;
        }
        servedRef.current.add(q.hash);
        setQuestion(q);
        window.setTimeout(() => {
          if (turnToken.current === token) setPhase("question");
        }, 1700);
      })
      .catch(() => {
        if (turnToken.current === token) setPhase("empty");
      });
  };

  const finishReveal = useCallback(
    (q: StoredQuestion, result: Outcome, quip: string, earned: number) => {
      setOutcome(result);
      setPointsEarned(earned);
      setPhase("reveal");
      setHostLine(quip);
      void markAsked(q.hash);
      const lead = host.anecdoteLeadIn();
      void speakSeq([
        [quip, "mogul"],
        [`${lead} ${q.anecdote}`, "mogul"],
      ]);
      // Keep the local bank fat: top up from the API while the player reads.
      void bankStats()
        .then((s) => {
          if (s.fresh < 40) return prefetchBatch(q.theme, playersRef.current[turn % playersRef.current.length]?.tier ?? 3);
        })
        .catch(() => {});
    },
    [speakSeq, turn],
  );

  /** Format multiplier × jokers (BARGOL ×2, confident bet ×2). */
  const jokerMultiplier = (doubledNow: boolean, confidenceNow: ConfidenceLevel | null) =>
    (doubledNow ? 2 : 1) * (confidenceNow === "sur" ? CONFIDENCE.sur.multiplier : 1);

  const resolve = useCallback(
    (q: StoredQuestion, correct: boolean, multiplier: number, opts?: { allowOverride?: boolean }) => {
      const player = playersRef.current[turn % playersRef.current.length];
      if (!player) return;
      snapshotRef.current = player;
      setPendingMultiplier(multiplier);
      let earned = 0;
      if (correct) {
        const after = applyCorrect(player, q.difficulty, multiplier);
        earned = after.score - player.score;
        setPlayers((ps) => ps.map((p, idx) => (idx === currentIndex ? after : p)));
        haptics.correct();
      } else {
        const penalty = confidence === "sur" ? Math.round(basePoints(q.difficulty) * CONFIDENCE.sur.penaltyOfBase) : 0;
        setPlayers((ps) => ps.map((p, idx) => (idx === currentIndex ? applyWrong(p, penalty) : p)));
        earned = -Math.min(penalty, player.score);
        haptics.wrong();
      }
      setOverrideOffered(Boolean(opts?.allowOverride) && !correct);
      finishReveal(q, correct ? "correct" : "wrong", correct ? host.quipCorrect() : host.quipWrong(), earned);
    },
    [confidence, currentIndex, finishReveal, turn],
  );

  /** MÉLISSANDRE's second chance: absorb one wrong attempt, stay in play. */
  const consumeSecondChance = (afterEffect?: () => void) => {
    setSecondChance(false);
    setSecondChanceUsed(true);
    haptics.skill();
    afterEffect?.();
  };

  const onChoiceAnswer = (i: number) => {
    if (phase !== "question" || !question || !current) return;
    if (question.format === "pari_confiance" && confidence === null) return;
    const isCorrect = i === (question.answerIndex ?? 0);
    if (!isCorrect && secondChance) {
      consumeSecondChance(() => setEliminated((e) => [...e, i]));
      return;
    }
    setSelected(i);
    const fmt = question.format === "cash_carre_duo" && ccdMode ? CCD_MULTIPLIER[ccdMode] : 1;
    resolve(question, isCorrect, fmt * jokerMultiplier(doubled, confidence));
  };

  const onTextSubmit = () => {
    if (phase !== "question" || !question || !current || !textAnswer.trim()) return;
    const accepted = correctTexts(question);
    const isCorrect = answerMatches(textAnswer, accepted);
    if (!isCorrect && secondChance) {
      consumeSecondChance(() => setTextAnswer(""));
      return;
    }
    setTypedAnswer(textAnswer.trim());
    const fmt = question.format === "cash_carre_duo" ? CCD_MULTIPLIER.cash : 1;
    resolve(question, isCorrect, fmt * jokerMultiplier(doubled, confidence), { allowOverride: true });
  };

  const onGambitSubmit = () => {
    if (phase !== "question" || !question || !current || !textAnswer.trim()) return;
    const guess = Number(textAnswer.replace(",", ".").replace(/\s+/g, ""));
    const mult = gambitMultiplier(guess, question.numericAnswer ?? NaN);
    if (mult === 0 && secondChance) {
      consumeSecondChance(() => setTextAnswer(""));
      return;
    }
    setTypedAnswer(textAnswer.trim());
    resolve(question, mult > 0, mult * jokerMultiplier(doubled, confidence));
  };

  /** Honor-system correction for typed answers the matcher rejected. */
  const onOverride = () => {
    if (!question || !snapshotRef.current || outcome !== "wrong") return;
    const before = snapshotRef.current;
    const after = applyCorrect(before, question.difficulty, pendingMultiplier);
    setPlayers((ps) => ps.map((p, idx) => (idx === currentIndex ? after : p)));
    setOutcome("correct");
    setPointsEarned(after.score - before.score);
    setOverrideOffered(false);
    setHostLine("Accordé. Ma confiance vous honore, ne la gaspillez pas.");
  };

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
        setEliminated((e) => [...e, ...pickEliminations(question.answerIndex ?? 0, question.choices?.length ?? 4).filter((x) => !e.includes(x))]);
        break;
      case "lilune":
        setHint(makeHint(question));
        break;
      case "bargol":
        setDoubled(true);
        break;
      case "melissandre":
        setSecondChance(true);
        break;
      case "fifrelin":
        // Skip: no points, streak preserved, but the anecdote is still served.
        finishReveal(question, "skip", retort ?? hostRetort(id), 0);
        break;
    }
  };

  const onReport = () => {
    if (!question || reported) return;
    setReported(true);
    void flagQuestion(question, "signalée par le joueur");
  };

  const restartMatch = () => {
    turnToken.current += 1;
    stopSpeech();
    servedRef.current.clear();
    resetQuestionState();
    setPlayers(config.playerNames.map((name, i) => makePlayer(i, name)));
    setSaved(false);
    setHostLine(host.intro());
    setPhase("intro");
    setTurn(0);
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

  /* ---------- derived rendering state ---------- */

  const visibleChoiceIndexes = useMemo(() => {
    if (!question?.choices) return [];
    if (question.format === "cash_carre_duo") {
      if (ccdMode === "carre") return question.choices.map((_, i) => i);
      if (ccdMode === "duo") return duoChoices;
      return [];
    }
    return question.choices.map((_, i) => i);
  }, [question, ccdMode, duoChoices]);

  const showTextInput =
    question &&
    phase === "question" &&
    (question.format === "equipe" || (question.format === "cash_carre_duo" && ccdMode === "cash"));
  const showNumericInput = question && phase === "question" && question.format === "gambit_numerique";
  const needsCcdPick = question?.format === "cash_carre_duo" && ccdMode === null && phase === "question";
  const needsConfidencePick = question?.format === "pari_confiance" && confidence === null && phase === "question";

  const skillUnavailable: Partial<Record<CastId, boolean>> = {
    gronk: visibleChoiceIndexes.length < 4,
    melissandre: secondChance || secondChanceUsed,
  };

  const correctAnswerText = question ? (correctTexts(question)[0] ?? "") : "";

  const pickCcd = (mode: CcdMode) => {
    if (!question?.choices) return;
    setCcdMode(mode);
    if (mode === "duo") {
      const answer = question.answerIndex ?? 0;
      const wrong = question.choices.map((_, i) => i).filter((i) => i !== answer);
      const other = wrong[Math.floor(Math.random() * wrong.length)] ?? 0;
      setDuoChoices([answer, other].sort((a, b) => a - b));
    }
  };

  /* ---------- screens ---------- */

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
        <HostBubble line="Plus de questions en réserve pour ce public. Même moi, ça me laisse sans voix." />
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
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setQuitAsk(true)}
              aria-label="Quitter la partie"
              className="-ml-2 rounded-full p-2 text-soft hover:text-bad"
            >
              ✕
            </button>
            <span className="truncate font-display font-bold text-ink">{current.name}</span>
            <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-soft">
              Palier {current.tier}
            </span>
            {current.streak >= 2 ? (
              <span className="shrink-0 text-xs" aria-label={`Série de ${current.streak}`}>
                🔥{current.streak}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
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

      {quitAsk ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-bad/50 bg-surface px-4 py-2 text-sm" role="alertdialog" aria-label="Confirmer l'abandon">
          <span className="text-ink">Quitter la partie ?</span>
          <div className="flex gap-2">
            <button type="button" className="rounded-full bg-bad px-4 py-1.5 font-semibold text-white" onClick={() => router.push("/")}>
              Oui
            </button>
            <button type="button" className="rounded-full border border-line px-4 py-1.5 text-soft" onClick={() => setQuitAsk(false)}>
              Non
            </button>
          </div>
        </div>
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
            <button type="button" onClick={() => router.push("/")} className="-mt-4 text-sm text-soft underline-offset-4 hover:underline">
              ← Retour
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
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2 font-display text-lg font-bold text-ink">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: theme.color }} />
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
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: THEME_BY_ID[question.theme].color }} />
                <span aria-hidden>{THEME_BY_ID[question.theme].emoji}</span> {THEME_BY_ID[question.theme].name}
              </span>
              <span>
                {"★".repeat(question.difficulty)}
                {doubled ? " · MISE ×2" : ""}
                {secondChance ? " · 2ᵉ CHANCE" : ""}
              </span>
            </div>

            <div className="rounded-2xl border border-line bg-card p-5">
              <p className="font-display text-lg font-semibold leading-snug text-ink">{question.question}</p>
              {hint && phase === "question" ? (
                <p className="mt-2 text-sm italic text-gold">🌙 {hint}</p>
              ) : null}
            </div>

            {/* cash / carré / duo picker */}
            {needsCcdPick ? (
              <div className="flex flex-col gap-2" role="group" aria-label="Choisissez votre mise">
                <p className="text-center text-sm text-soft">Comment répondez-vous ?</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { mode: "cash", label: "CASH", desc: "réponse libre · ×3" },
                      { mode: "carre", label: "CARRÉ", desc: "4 choix · ×2" },
                      { mode: "duo", label: "DUO", desc: "2 choix · ×1" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.mode}
                      type="button"
                      onClick={() => pickCcd(o.mode)}
                      className="rounded-xl border border-line bg-surface px-2 py-3 text-center transition hover:border-gold active:scale-95"
                    >
                      <span className="block font-display font-bold text-gold">{o.label}</span>
                      <span className="block text-[11px] text-soft">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* confidence bet picker */}
            {needsConfidencePick ? (
              <div className="flex flex-col gap-2" role="group" aria-label="Pari de confiance">
                <p className="text-center text-sm text-soft">Pariez sur vous-même :</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfidence("sur")}
                    className="rounded-xl border border-line bg-surface px-2 py-3 text-center transition hover:border-gold active:scale-95"
                  >
                    <span className="block font-display font-bold text-gold">SÛR DE MOI</span>
                    <span className="block text-[11px] text-soft">×2 · gage −{Math.round(CONFIDENCE.sur.penaltyOfBase * 100)} % si faux</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfidence("prudent")}
                    className="rounded-xl border border-line bg-surface px-2 py-3 text-center transition hover:border-gold active:scale-95"
                  >
                    <span className="block font-display font-bold text-ink">PRUDENT</span>
                    <span className="block text-[11px] text-soft">×1 · sans gage</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* choice grid */}
            {!needsCcdPick && !needsConfidencePick && visibleChoiceIndexes.length > 0 ? (
              <div
                className={`grid gap-2 ${visibleChoiceIndexes.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
                role="group"
                aria-label="Choix de réponse"
              >
                {visibleChoiceIndexes.map((i, pos) => {
                  const choice = question.choices?.[i] ?? "";
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
                      onClick={() => onChoiceAnswer(i)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99] ${cls}`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs font-bold" aria-hidden>
                        {String.fromCharCode(65 + pos)}
                      </span>
                      <span className="text-[15px] leading-snug">{choice}</span>
                      {phase === "reveal" && isAnswer ? (
                        <span className="ml-auto" aria-hidden>
                          ✅
                        </span>
                      ) : null}
                      {phase === "reveal" && isAnswer ? <span className="sr-only">(bonne réponse)</span> : null}
                      {phase === "reveal" && isSelected && !isAnswer ? <span className="sr-only">(votre réponse)</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* free text / numeric input */}
            {showTextInput || showNumericInput ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (showNumericInput) onGambitSubmit();
                  else onTextSubmit();
                }}
              >
                <input
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  inputMode={showNumericInput ? "decimal" : "text"}
                  placeholder={showNumericInput ? "Votre estimation…" : "Votre réponse…"}
                  aria-label={showNumericInput ? "Votre estimation numérique" : "Votre réponse"}
                  autoComplete="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-3 text-ink placeholder:text-soft"
                />
                <button
                  type="submit"
                  disabled={!textAnswer.trim()}
                  className="rounded-xl bg-gold px-5 py-3 font-bold text-bg disabled:opacity-40"
                >
                  Valider
                </button>
              </form>
            ) : null}

            {question.format === "equipe" && phase === "question" ? (
              <p className="text-center text-xs text-soft">Plusieurs réponses sont valables — il n&apos;en faut qu&apos;une.</p>
            ) : null}

            {castEvent ? (
              <div className="rounded-xl border border-line bg-surface px-4 py-2 text-sm">
                <p className="font-semibold text-ink">{castEvent.line}</p>
                {castEvent.retort ? <p className="mt-1 text-xs italic text-soft">🎩 {castEvent.retort}</p> : null}
              </div>
            ) : null}

            {phase === "question" ? (
              <div className="mt-auto">
                <CastBar player={current} disabled={false} unavailable={skillUnavailable} onSkill={onSkill} />
              </div>
            ) : null}

            {phase === "reveal" ? (
              <div className="flex flex-col gap-3">
                {/* Screen readers get the verdict explicitly — color alone is not information. */}
                <p className="sr-only" role="status" aria-live="polite">
                  {outcome === "correct"
                    ? `Bonne réponse. ${pointsEarned > 0 ? `${pointsEarned} points.` : ""}`
                    : outcome === "skip"
                      ? "Question passée."
                      : "Mauvaise réponse."}{" "}
                  La bonne réponse était : {question.format === "equipe" ? (question.acceptedAnswers ?? []).join(", ") : question.format === "gambit_numerique" ? String(question.numericAnswer) : correctAnswerText}.
                </p>

                <HostBubble
                  line={hostLine}
                  sub={
                    outcome === "correct" && pointsEarned > 0
                      ? `+${pointsEarned} pts${doubled ? " (mise doublée)" : ""}`
                      : outcome === "skip"
                        ? "Question esquivée avec panache."
                        : pointsEarned < 0
                          ? `${pointsEarned} pts (pari perdu)`
                          : undefined
                  }
                />

                {/* Typed-answer verdict */}
                {typedAnswer !== null ? (
                  <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                    <p className="text-soft">
                      Votre réponse : <span className="font-semibold text-ink">« {typedAnswer} »</span>
                    </p>
                    {question.format === "gambit_numerique" ? (
                      <p className="mt-1 text-soft">
                        Réponse exacte : <span className="font-bold text-good">{question.numericAnswer}</span>
                      </p>
                    ) : question.format === "equipe" ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(question.acceptedAnswers ?? []).map((a) => (
                          <span key={a} className="rounded-full border border-good/40 bg-good/10 px-2.5 py-0.5 text-xs text-ink">
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-soft">
                        Réponse attendue : <span className="font-bold text-good">{correctAnswerText}</span>
                      </p>
                    )}
                    {overrideOffered ? (
                      <button type="button" onClick={onOverride} className="mt-2 text-xs font-semibold text-gold underline-offset-2 hover:underline">
                        Ma formulation était juste → compter comme bonne
                      </button>
                    ) : null}
                  </div>
                ) : null}

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
                      className="ml-auto p-1 text-[11px] text-soft underline-offset-2 hover:text-bad disabled:opacity-60"
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
                onClick={restartMatch}
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
