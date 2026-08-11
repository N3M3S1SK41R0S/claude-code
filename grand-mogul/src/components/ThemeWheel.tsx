"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { THEMES } from "@/lib/themes";
import type { ThemeDef } from "@/lib/types";
import { haptics } from "@/lib/haptics";

const SLICE = 360 / THEMES.length;
const R = 130;
const CX = 140;
const CY = 140;

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

function slicePath(index: number): string {
  const a0 = index * SLICE;
  const a1 = (index + 1) * SLICE;
  const [x0, y0] = polar(a0, R);
  const [x1, y1] = polar(a1, R);
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`;
}

/** The theme wheel: tap to spin, lands on a random theme. */
export function ThemeWheel({ onResult }: { onResult: (theme: ThemeDef) => void }) {
  const reduced = useReducedMotion();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);

  const slices = useMemo(
    () =>
      THEMES.map((t, i) => {
        const [lx, ly] = polar(i * SLICE + SLICE / 2, R * 0.68);
        return { theme: t, path: slicePath(i), lx, ly };
      }),
    [],
  );

  const spin = () => {
    if (spinning) return;
    const index = Math.floor(Math.random() * THEMES.length);
    const target = THEMES[index] as ThemeDef;
    // Bring the center of slice `index` under the top pointer, plus 4 full turns.
    const current = ((rotationRef.current % 360) + 360) % 360;
    const desired = (360 - (index * SLICE + SLICE / 2)) % 360;
    const delta = 4 * 360 + ((desired - current + 360) % 360);
    const next = rotationRef.current + delta;
    rotationRef.current = next;

    if (reduced) {
      setRotation(next);
      onResult(target);
      return;
    }
    setSpinning(true);
    haptics.wheel();
    setRotation(next);
    window.setTimeout(() => {
      setSpinning(false);
      haptics.wheel();
      onResult(target);
    }, 2400);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <div
          aria-hidden
          className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"
        >
          🔻
        </div>
        <motion.svg
          width="280"
          height="280"
          viewBox="0 0 280 280"
          animate={{ rotate: rotation }}
          transition={reduced ? { duration: 0 } : { duration: 2.4, ease: [0.15, 0.6, 0.15, 1] }}
          className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          role="img"
          aria-label="Roue des thèmes"
        >
          <circle cx={CX} cy={CY} r={R + 6} fill="var(--surface)" stroke="var(--gold)" strokeWidth="3" />
          {slices.map(({ theme, path, lx, ly }) => (
            <g key={theme.id}>
              <path d={path} fill={theme.color} stroke="var(--bg)" strokeWidth="1.5" opacity="0.9" />
              <text x={lx} y={ly} fontSize="20" textAnchor="middle" dominantBaseline="central">
                {theme.emoji}
              </text>
            </g>
          ))}
          <circle cx={CX} cy={CY} r="26" fill="var(--surface)" stroke="var(--gold)" strokeWidth="2" />
          <text x={CX} y={CY} fontSize="20" textAnchor="middle" dominantBaseline="central">
            🎩
          </text>
        </motion.svg>
      </div>
      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        className="rounded-full bg-gold px-8 py-3 font-display text-lg font-bold text-bg shadow-lg transition active:scale-95 disabled:opacity-50"
      >
        {spinning ? "La roue décide…" : "Tourner la roue"}
      </button>
    </div>
  );
}
