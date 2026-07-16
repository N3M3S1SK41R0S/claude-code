/**
 * Edge Function `arbiter` — arbitre boire/garder/vendre (offre Gold+, pari #3).
 *
 * POST { itemId: string, currentYear?: number }
 *   → auth (Bearer) → vérification du plan (gold | platine)
 *   → lecture défensive de l'objet, de sa fenêtre d'apogée et de sa trajectoire
 *   → moteur pur `arbitrate` avec garde-fou anti-market-timing
 *   → ArbiterSignal indicatif, jamais un ordre de vente.
 */
import type { ArbiterSignal, VelumDomain } from '@velum/core';
import { arbitrate, type TrajectoryPoint } from '@velum/valuation';
import { getUser, type AuthContext } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { isVelumDomain } from '../_shared/domains.ts';
import { validateJsonObject } from '../_shared/input.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';

const ENTITLED_PLANS = new Set(['gold', 'platine']);
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

interface ArbiterHandlerDeps {
  authenticate(req: Request): Promise<AuthContext | null>;
  currentYear(): number;
}

const DEFAULT_DEPS: ArbiterHandlerDeps = {
  authenticate: getUser,
  currentYear: () => new Date().getUTCFullYear(),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUsageWindow(value: unknown): { from: number; to: number } | undefined {
  if (!isRecord(value)) return undefined;
  const tasting = value['tasting'];
  if (!isRecord(tasting)) return undefined;
  const rawWindow = tasting['drinkWindow'];
  if (!isRecord(rawWindow)) return undefined;

  const from = finiteNumber(rawWindow['from']);
  const to = finiteNumber(rawWindow['to']);
  if (
    from === null ||
    to === null ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < MIN_YEAR ||
    to > MAX_YEAR ||
    from > to
  ) {
    return undefined;
  }
  return { from, to };
}

function parseTrajectory(rows: unknown): TrajectoryPoint[] {
  if (!Array.isArray(rows)) return [];
  const points: { point: TrajectoryPoint; time: number }[] = [];

  for (const raw of rows) {
    if (!isRecord(raw)) continue;
    const at = raw['valued_at'];
    const central = finiteNumber(raw['central']);
    const low = finiteNumber(raw['ci80_low']);
    const high = finiteNumber(raw['ci80_high']);
    const time = typeof at === 'string' ? Date.parse(at) : Number.NaN;

    if (
      typeof at !== 'string' ||
      !Number.isFinite(time) ||
      central === null ||
      low === null ||
      high === null ||
      central <= 0 ||
      low <= 0 ||
      high <= 0 ||
      low > central ||
      central > high
    ) {
      continue;
    }

    points.push({ point: { at, central, ci80: [low, high] }, time });
  }

  points.sort((a, b) => a.time - b.time);
  return points.map(({ point }) => point);
}

function unavailableWineWindow(): ArbiterSignal {
  return {
    verdict: 'watch',
    confidence: 0,
    trend: 'unknown',
    sellWindow: false,
    reasons: [
      'Fenêtre d’apogée indisponible ou invalide — aucun arbitrage boire/garder/vendre n’est publié.',
    ],
  };
}

export function createArbiterHandler(
  overrides: Partial<ArbiterHandlerDeps> = {},
): (req: Request) => Promise<Response> {
  const deps: ArbiterHandlerDeps = { ...DEFAULT_DEPS, ...overrides };

  return async (req: Request): Promise<Response> => {
    const preflight = handleOptions(req);
    if (preflight) return preflight;
    if (req.method !== 'POST') {
      return error('INVALID_INPUT', 'Méthode non autorisée', 405);
    }

    const auth = await deps.authenticate(req);
    if (!auth) {
      return error('UNAUTHORIZED', 'Authentification requise', 401);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return error('INVALID_INPUT', 'Corps JSON invalide', 400);
    }

    const bodyResult = validateJsonObject(rawBody);
    if (!bodyResult.ok) {
      return error('INVALID_INPUT', bodyResult.message, 400);
    }
    const body = bodyResult.value;

    const rawItemId = body['itemId'];
    if (typeof rawItemId !== 'string' || rawItemId.trim().length === 0 || rawItemId.length > 128) {
      return error('INVALID_INPUT', "Champ 'itemId' invalide : chaîne non vide attendue", 400);
    }
    const itemId = rawItemId.trim();

    const rawCurrentYear = body['currentYear'];
    const currentYear = rawCurrentYear === undefined ? deps.currentYear() : rawCurrentYear;
    if (
      typeof currentYear !== 'number' ||
      !Number.isInteger(currentYear) ||
      currentYear < MIN_YEAR ||
      currentYear > MAX_YEAR
    ) {
      return error(
        'INVALID_INPUT',
        `Champ 'currentYear' invalide : entier entre ${MIN_YEAR} et ${MAX_YEAR} attendu`,
        400,
      );
    }

    try {
      const { data: profile, error: profileError } = await auth.supabase
        .from('profiles')
        .select('plan')
        .eq('id', auth.user.id)
        .maybeSingle();
      if (profileError) {
        return error('SOURCE_UNAVAILABLE', 'Lecture des droits produit impossible', 503);
      }
      const plan = profile?.plan;
      if (typeof plan !== 'string' || !ENTITLED_PLANS.has(plan)) {
        return error(
          'PLAN_REQUIRED',
          'L’arbitre fait partie du carnet virtuel — offre Gold ou Platine.',
          403,
        );
      }

      const { data: item, error: itemError } = await auth.supabase
        .from('items')
        .select('id, domain, attributes')
        .eq('id', itemId)
        .maybeSingle();
      if (itemError) return error('SOURCE_UNAVAILABLE', 'Lecture de l’objet impossible', 503);
      if (!item) return error('UNAUTHORIZED', 'Objet introuvable ou non possédé', 403);
      if (!isVelumDomain(item.domain)) {
        return error('SOURCE_UNAVAILABLE', 'Domaine de l’objet invalide', 503);
      }
      const domain: VelumDomain = item.domain;
      if (!isRecord(item.attributes)) {
        return error('SOURCE_UNAVAILABLE', 'Attributs de l’objet invalides', 503);
      }

      let usageWindow: { from: number; to: number } | undefined;
      if (domain === 'wine') {
        const { data: analysis, error: analysisError } = await auth.supabase
          .from('analyses')
          .select('payload')
          .eq('item_id', itemId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (analysisError) {
          return error('SOURCE_UNAVAILABLE', 'Lecture de l’analyse impossible', 503);
        }

        const payload = analysis?.payload ?? item.attributes['analysis'];
        usageWindow = parseUsageWindow(payload);
        if (usageWindow === undefined) return json(unavailableWineWindow());
      }

      const { data: snapshots, error: snapshotError } = await auth.supabase
        .from('valuations')
        .select('central, ci80_low, ci80_high, valued_at')
        .eq('item_id', itemId)
        .order('valued_at', { ascending: true })
        .limit(50);
      if (snapshotError) {
        return error('SOURCE_UNAVAILABLE', 'Lecture de la trajectoire impossible', 503);
      }

      const trajectory = parseTrajectory(snapshots);
      const signal = arbitrate({
        currentYear,
        ...(usageWindow !== undefined ? { usageWindow } : {}),
        trajectory,
      });
      return json(signal);
    } catch (cause) {
      return errorFromException(cause);
    }
  };
}

export const handler = createArbiterHandler();

if (import.meta.main) Deno.serve(handler);
