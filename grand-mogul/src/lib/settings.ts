import { idb, idbAvailable } from "./db";
import { setHaptics } from "./haptics";
import { setMuted } from "./tts";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const KEY = "settings";

export async function loadSettings(): Promise<Settings> {
  if (!idbAvailable()) return DEFAULT_SETTINGS;
  try {
    const stored = await idb.get<{ key: string; value: Settings }>("meta", KEY);
    const settings = { ...DEFAULT_SETTINGS, ...(stored?.value ?? {}) };
    applySettings(settings);
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  applySettings(settings);
  if (!idbAvailable()) return;
  try {
    await idb.put("meta", { key: KEY, value: settings });
  } catch {
    // Storage failure must never break the game.
  }
}

export function applySettings(settings: Settings): void {
  setMuted(settings.muted);
  setHaptics(settings.haptics);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("light", settings.colorScheme === "light");
  }
}
