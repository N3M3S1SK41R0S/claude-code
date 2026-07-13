/**
 * Taux de change vers EUR (FxRates de @velum/core : 1 unité de `currency`
 * = fx[currency] EUR), via api.frankfurter.app (gratuit, sans clé).
 *
 * Frankfurter renvoie les taux DEPUIS l'EUR (1 EUR = rates[cur] unités de
 * cur) : on inverse donc chaque taux. Cache mémoire 24 h ; repli statique
 * si le réseau est indisponible (avertissement loggué).
 */
import type { FxRates } from '@velum/core';

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?base=EUR';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

/** Repli si le réseau est indisponible — valeurs approximatives. */
const FALLBACK_RATES: FxRates = { EUR: 1, USD: 0.9, GBP: 1.15, CHF: 1.05 };

let cache: { rates: FxRates; fetchedAt: number } | null = null;

/** Retourne les taux vers EUR, depuis le cache (24 h) ou le réseau. */
export async function getFxRates(): Promise<FxRates> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  try {
    const response = await fetch(FRANKFURTER_URL);
    if (!response.ok) {
      throw new Error(`Frankfurter a répondu ${response.status}`);
    }
    const payload = (await response.json()) as { rates?: Record<string, number> };
    const raw = payload.rates ?? {};

    // Frankfurter : 1 EUR = raw[cur] cur → on veut 1 cur = 1/raw[cur] EUR.
    const rates: FxRates = { EUR: 1 };
    for (const [currency, perEur] of Object.entries(raw)) {
      if (typeof perEur === 'number' && perEur > 0) {
        rates[currency] = 1 / perEur;
      }
    }

    cache = { rates, fetchedAt: Date.now() };
    return rates;
  } catch (err) {
    console.warn(
      `[fx] Taux de change indisponibles (${err instanceof Error ? err.message : String(err)}) — repli sur les taux statiques`,
    );
    // Repli non mis en cache : la prochaine requête retentera le réseau.
    return { ...FALLBACK_RATES };
  }
}

/** Vide le cache — utile pour les tests. */
export function clearFxCache(): void {
  cache = null;
}
