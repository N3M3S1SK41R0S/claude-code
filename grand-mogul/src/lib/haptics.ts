let enabled = true;

export function setHaptics(on: boolean): void {
  enabled = on;
}

function vibrate(pattern: number | number[]): void {
  if (!enabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw on vibrate without user gesture — never fatal.
  }
}

export const haptics = {
  correct: () => vibrate(35),
  wrong: () => vibrate([70, 50, 70]),
  skill: () => vibrate([20, 30, 20]),
  tick: () => vibrate(15),
  wheel: () => vibrate(10),
};
