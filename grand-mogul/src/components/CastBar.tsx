"use client";

import { CAST } from "@/lib/cast";
import type { CastId, PlayerState } from "@/lib/types";

/**
 * The five companions as one-shot jokers. Each is disabled once used this
 * match (per player) or when interaction is closed.
 */
export function CastBar({
  player,
  disabled,
  onSkill,
}: {
  player: PlayerState;
  disabled: boolean;
  onSkill: (id: CastId) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2" role="group" aria-label="Compagnons (jokers)">
      {CAST.map((c) => {
        const used = Boolean(player.skillsUsed[c.id]);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSkill(c.id)}
            disabled={used || disabled}
            aria-label={`${c.name} — ${c.skill.name} : ${c.skill.description}${used ? " (déjà utilisé)" : ""}`}
            title={`${c.skill.name} — ${c.skill.description}`}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition active:scale-95 ${
              used
                ? "border-line bg-surface opacity-35"
                : "border-line bg-card hover:border-gold disabled:opacity-35"
            }`}
            style={used ? undefined : { boxShadow: `inset 0 -2px 0 ${c.color}` }}
          >
            <span className="text-xl" aria-hidden>
              {used ? "✖️" : c.emoji}
            </span>
            <span className="text-[10px] font-semibold leading-tight text-ink">{c.name}</span>
            <span className="text-[9px] leading-tight text-soft">{c.skill.name}</span>
          </button>
        );
      })}
    </div>
  );
}
