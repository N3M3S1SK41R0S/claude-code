"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ensureSeedLoaded, bankStats } from "@/lib/bank";
import { loadSettings, saveSettings } from "@/lib/settings";
import { warmVoices } from "@/lib/tts";
import { DEFAULT_SETTINGS, type GameMode, type MatchConfig, type Settings } from "@/lib/types";

const QUESTIONS_CHOICES = [5, 10, 15] as const;

export default function HomePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [bank, setBank] = useState<{ total: number; fresh: number } | null>(null);
  const [mode, setMode] = useState<GameMode>("solo");
  const [names, setNames] = useState<string[]>(["", ""]);
  const [perPlayer, setPerPlayer] = useState<number>(10);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    loadSettings().then(setSettings);
    ensureSeedLoaded()
      .then(() => bankStats())
      .then(setBank)
      .catch(() => setBank({ total: 0, fresh: 0 }));
    warmVoices();
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    try {
      localStorage.setItem("gm-scheme", next.colorScheme);
    } catch {
      /* private mode */
    }
  };

  const partyNames = useMemo(
    () => names.map((n) => n.trim()).filter((n) => n.length > 0),
    [names],
  );
  const canStart = mode === "solo" || partyNames.length >= 2;

  const start = () => {
    const config: MatchConfig = {
      mode,
      playerNames: mode === "solo" ? ["Vous"] : partyNames.slice(0, 8),
      questionsPerPlayer: perPlayer,
    };
    try {
      sessionStorage.setItem("gm-config", JSON.stringify(config));
    } catch {
      /* fall back to defaults on /play */
    }
    router.push("/play");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="text-center">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-5xl" aria-hidden>
            🎩
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-wide text-gold">
            LE GRAND MOGUL
          </h1>
          <p className="mt-1 font-display italic text-soft">Le quiz qui vous surplombe.</p>
        </motion.div>
      </header>

      <InstallPrompt />

      <section aria-label="Mode de jeu" className="grid grid-cols-2 gap-3">
        {(
          [
            { id: "solo", label: "Solo", desc: "10 questions, le Mogul et vous", emoji: "🧠" },
            { id: "party", label: "Party", desc: "2 à 8 joueurs, un seul appareil", emoji: "🎉" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={`rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
              mode === m.id ? "border-gold bg-card shadow-[0_0_16px_rgba(217,168,60,0.15)]" : "border-line bg-surface"
            }`}
          >
            <div className="text-2xl" aria-hidden>
              {m.emoji}
            </div>
            <div className="mt-1 font-display text-lg font-bold text-ink">{m.label}</div>
            <div className="text-xs text-soft">{m.desc}</div>
          </button>
        ))}
      </section>

      {mode === "party" ? (
        <section aria-label="Joueurs" className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-display font-bold text-ink">Qui affronte le Mogul ?</h2>
          <div className="flex flex-col gap-2">
            {names.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={n}
                  onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Joueur ${i + 1}`}
                  maxLength={20}
                  aria-label={`Nom du joueur ${i + 1}`}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-ink placeholder:text-soft"
                />
                {names.length > 2 ? (
                  <button
                    type="button"
                    aria-label={`Retirer le joueur ${i + 1}`}
                    className="text-soft"
                    onClick={() => setNames(names.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {names.length < 8 ? (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-gold"
              onClick={() => setNames([...names, ""])}
            >
              + Ajouter un joueur
            </button>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Longueur de partie" className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="text-sm text-soft">Questions par joueur</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Questions par joueur">
          {QUESTIONS_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={perPlayer === n}
              onClick={() => setPerPlayer(n)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                perPlayer === n ? "bg-gold text-bg" : "bg-card text-soft"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={start}
        disabled={!canStart}
        className="rounded-2xl bg-gold py-4 font-display text-xl font-bold text-bg shadow-lg transition active:scale-[0.98] disabled:opacity-40"
      >
        Entrer sur le plateau
      </button>
      {!canStart ? <p className="-mt-3 text-center text-xs text-soft">Il faut au moins 2 noms pour un party.</p> : null}

      <section aria-label="Réglages" className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => updateSettings({ muted: !settings.muted })}
          aria-pressed={settings.muted}
          aria-label={settings.muted ? "Réactiver le son" : "Couper le son"}
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm"
        >
          {settings.muted ? "🔇 Muet" : "🔊 Voix"}
        </button>
        <button
          type="button"
          onClick={() => updateSettings({ haptics: !settings.haptics })}
          aria-pressed={settings.haptics}
          aria-label={settings.haptics ? "Désactiver les vibrations" : "Activer les vibrations"}
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm"
        >
          {settings.haptics ? "📳 Vibre" : "📴 Sans vibration"}
        </button>
        <button
          type="button"
          onClick={() => updateSettings({ colorScheme: settings.colorScheme === "dark" ? "light" : "dark" })}
          aria-label="Changer de thème clair/sombre"
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm"
        >
          {settings.colorScheme === "dark" ? "🌙 Sombre" : "☀️ Clair"}
        </button>
      </section>

      <footer className="mt-auto flex flex-col items-center gap-2 text-center text-xs text-soft">
        <Link href="/scores" className="font-semibold text-gold underline-offset-4 hover:underline">
          🏆 Palmarès
        </Link>
        <p>
          {bank === null
            ? "Chargement de la banque de questions…"
            : `${bank.total} questions vérifiées embarquées${online ? "" : " — mode hors-ligne"}`}
        </p>
        <p aria-hidden>Le Mogul certifie chaque anecdote. Ou presque : chaque source est citée.</p>
      </footer>
    </main>
  );
}
