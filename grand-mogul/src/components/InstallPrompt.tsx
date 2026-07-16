"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Android: native install prompt. iOS: manual instructions (no API exists). */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) setShowIos(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed || (!deferred && !showIos)) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
      <div className="text-soft">
        {deferred ? (
          <span>📲 Installez le jeu pour jouer en plein écran, même hors-ligne.</span>
        ) : (
          <span>
            📲 Sur iPhone : <strong className="text-ink">Partager</strong> →{" "}
            <strong className="text-ink">Sur l&apos;écran d&apos;accueil</strong>.
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {deferred ? (
          <button
            type="button"
            className="rounded-full bg-gold px-4 py-1.5 font-semibold text-bg"
            onClick={async () => {
              await deferred.prompt();
              setDeferred(null);
            }}
          >
            Installer
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Masquer"
          className="-m-1 rounded-full p-2.5 text-soft"
          onClick={() => setDismissed(true)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
