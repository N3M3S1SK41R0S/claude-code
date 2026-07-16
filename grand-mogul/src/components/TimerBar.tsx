"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Countdown bar. `extraSeconds` can grow mid-run (MÉLISSANDRE's Temps gelé);
 * the deadline shifts without restarting the elapsed time.
 */
export function TimerBar({
  seconds,
  extraSeconds,
  running,
  onTimeout,
}: {
  seconds: number;
  extraSeconds: number;
  running: boolean;
  onTimeout: () => void;
}) {
  const startRef = useRef<number>(Date.now());
  const firedRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const [leftMs, setLeftMs] = useState(seconds * 1000);
  const totalMs = (seconds + extraSeconds) * 1000;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, startRef.current + (seconds + extraSeconds) * 1000 - Date.now());
      setLeftMs(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeoutRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [running, seconds, extraSeconds]);

  const ratio = totalMs > 0 ? leftMs / totalMs : 0;
  const secondsLeft = Math.ceil(leftMs / 1000);
  const urgent = secondsLeft <= 5;

  return (
    <div className="flex items-center gap-3" aria-label={`Temps restant : ${secondsLeft} secondes`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="presentation">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            urgent ? "bg-bad" : "bg-gold"
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span
        className={`w-8 text-right font-mono text-sm tabular-nums ${urgent ? "font-bold text-bad" : "text-soft"}`}
        aria-live={urgent ? "assertive" : "off"}
      >
        {secondsLeft}
      </span>
    </div>
  );
}
