"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { idb, idbAvailable } from "@/lib/db";
import type { MatchRecord } from "@/lib/types";

export default function ScoresPage() {
  const [records, setRecords] = useState<MatchRecord[] | null>(null);

  useEffect(() => {
    if (!idbAvailable()) {
      setRecords([]);
      return;
    }
    idb
      .getAll<MatchRecord>("scores")
      .then((all) => setRecords(all.sort((a, b) => b.date - a.date).slice(0, 50)))
      .catch(() => setRecords([]));
  }, []);

  const clearAll = async () => {
    if (!idbAvailable()) return;
    await idb.clear("scores").catch(() => {});
    setRecords([]);
  };

  const best = records?.reduce<{ name: string; score: number } | null>((acc, r) => {
    for (const p of r.players) {
      if (!acc || p.score > acc.score) acc = { name: p.name, score: p.score };
    }
    return acc;
  }, null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-gold">🏆 Palmarès</h1>
        <Link href="/" className="text-sm font-semibold text-soft underline-offset-4 hover:underline">
          ← Accueil
        </Link>
      </header>

      {best ? (
        <div className="rounded-2xl border border-gold bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-soft">Record du plateau</p>
          <p className="mt-1 font-display text-lg font-bold text-ink">
            {best.name} — <span className="text-gold">{best.score} pts</span>
          </p>
        </div>
      ) : null}

      {records === null ? (
        <p className="text-center text-soft" aria-live="polite">
          Le greffier compulse les archives…
        </p>
      ) : records.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-soft">
          <span className="text-4xl" aria-hidden>
            📜
          </span>
          <p>
            Aucune partie archivée. Le Mogul attend
            <br />
            de pouvoir juger quelqu&apos;un.
          </p>
          <Link href="/" className="mt-2 rounded-full bg-gold px-6 py-2.5 font-bold text-bg">
            Jouer une partie
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((r) => {
            const winner = [...r.players].sort((a, b) => b.score - a.score)[0];
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <div className="flex items-center justify-between text-xs text-soft">
                  <span>{new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="uppercase tracking-wide">{r.mode === "solo" ? "Solo" : `Party · ${r.players.length} joueurs`}</span>
                </div>
                {winner ? (
                  <p className="mt-1 font-display font-bold text-ink">
                    👑 {winner.name} <span className="font-mono text-gold">{winner.score} pts</span>
                    <span className="ml-2 text-xs font-normal text-soft">
                      ({winner.correct}/{winner.answered})
                    </span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {records && records.length > 0 ? (
        <button type="button" onClick={clearAll} className="mt-auto text-center text-xs text-soft underline-offset-2 hover:text-bad">
          Effacer l&apos;historique
        </button>
      ) : null}
    </main>
  );
}
