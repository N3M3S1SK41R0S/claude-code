/**
 * Ordonnanceur des effets de bord non bloquants des Edge Functions.
 *
 * Supabase peut arrêter l'instance dès que la réponse HTTP est envoyée. Une
 * promesse lancée avec `void` n'est donc pas garantie d'aller au bout. Le
 * runtime expose `EdgeRuntime.waitUntil()` pour enregistrer explicitement la
 * tâche sans retarder la réponse.
 */
export interface BackgroundRuntime {
  waitUntil(promise: Promise<unknown>): void;
}

// Global fourni par Supabase en production. `typeof` reste sûr hors runtime.
declare const EdgeRuntime: BackgroundRuntime | undefined;

/** Résout le runtime Supabase sans l'imposer aux tests Deno/Node. */
function edgeRuntime(): BackgroundRuntime | null {
  return typeof EdgeRuntime === 'undefined' ? null : EdgeRuntime;
}

/**
 * Enregistre une promesse déjà auto-protégée auprès du runtime. En dehors de
 * Supabase (tests Deno/Node), conserve le comportement best-effort historique.
 */
export function scheduleBackgroundTask(
  task: Promise<unknown>,
  runtime: BackgroundRuntime | null = edgeRuntime(),
): void {
  if (runtime === null) {
    void task;
    return;
  }
  runtime.waitUntil(task);
}
