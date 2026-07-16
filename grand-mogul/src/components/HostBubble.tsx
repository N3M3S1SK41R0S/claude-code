"use client";

import { motion } from "framer-motion";

/** Speech bubble of LE GRAND MOGUL — mock-solemn serif, gold monocle avatar. */
export function HostBubble({ line, sub }: { line: string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-3"
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-surface text-xl shadow-[0_0_12px_rgba(217,168,60,0.25)]"
      >
        🎩
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3">
        <p className="font-display text-[15px] italic leading-snug text-ink">{line}</p>
        {sub ? <p className="mt-1 text-xs text-soft">{sub}</p> : null}
      </div>
    </motion.div>
  );
}
