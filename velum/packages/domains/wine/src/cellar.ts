/**
 * Fonctions cave (§6.2.3) — intelligence transversale mets ⇄ vins :
 *  - sens 1 : « je cuisine tel plat → quel vin DÉJÀ DANS MA CAVE ? »
 *    (sommelier IA contraint à l'inventaire réel, anti-hallucination) ;
 *  - sens 2 : alertes « à boire » à l'apogée, enrichies des accords
 *    mets-vins de l'analyse ZAPPA (« ce vin est prêt — servez-le avec… »).
 */
import type {
  CellarWineEntry,
  DrinkNowSuggestion,
  PairingRecommendation,
  PairingRequest,
  PairingResult,
  VisionModel,
  WineAnalysisPayload,
} from '@velum/core';
import { parseModelJson } from './json.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * true si `year` tombe dans la fenêtre de consommation optimale [from, to]
 * (bornes incluses). Défensif : le payload provient d'un JSONB — si la fenêtre
 * est absente ou malformée, on renvoie false plutôt que d'alerter à tort.
 */
export function isInDrinkWindow(payload: WineAnalysisPayload, year: number): boolean {
  const tasting = (payload as unknown as Record<string, unknown>)['tasting'];
  if (!isRecord(tasting)) return false;
  const window = tasting['drinkWindow'];
  if (!isRecord(window)) return false;
  const from = finiteNumber(window['from']);
  const to = finiteNumber(window['to']);
  if (from === undefined || to === undefined || from > to) return false;
  return year >= from && year <= to;
}

/** Vin de cave enrichi de son analyse ZAPPA stockée (JSONB). */
export interface AnalyzedCellarWine {
  itemId: string;
  label: string;
  vintage?: number;
  storageLocation?: string;
  quantity?: number;
  payload: WineAnalysisPayload;
}

/** System prompt du sommelier de cave — contraint à l'inventaire fourni. */
export const CELLAR_SOMMELIER_PROMPT = `Tu es le sommelier personnel de VELUM.
On te donne UN PLAT et l'INVENTAIRE EXACT de la cave de l'utilisateur (JSON).
Ta mission : recommander le ou les vins DE CETTE CAVE UNIQUEMENT qui
s'accordent le mieux avec le plat.

RÈGLES ABSOLUES :
1. Tu ne recommandes QUE des vins présents dans l'inventaire fourni, en
   citant leur champ "itemId" tel quel. JAMAIS un vin extérieur à la cave.
2. Tu classes du meilleur accord au moins bon (3 recommandations maximum),
   avec un score 0..1 honnête (0.9+ = accord remarquable).
3. "reasoning" : une à deux phrases concrètes en français (structure du vin,
   pont aromatique avec le plat, maturité — privilégie un vin dans sa
   fenêtre de consommation).
4. "serveAt" : conseil de service concis (température, carafage) si utile.
5. Si AUCUN vin de la cave ne convient vraiment, renvoie "recommendations": []
   et remplis "fallbackAdvice" (type de vin à acheter, sans inventer de
   bouteille dans la cave).
6. Réponds en JSON STRICT, sans texte autour :
{"recommendations":[{"itemId":"…","label":"…","score":0.85,"reasoning":"…","serveAt":"…"}],"fallbackAdvice":"…"}`;

export const EMPTY_CELLAR_ADVICE =
  'Votre cave est vide : scannez vos premières bouteilles pour activer le sommelier.';

/** Construit le message utilisateur du sommelier (plat + inventaire). */
export function buildPairingUserPrompt(request: PairingRequest): string {
  const inventory = request.cellar.map((w) => ({
    itemId: w.itemId,
    label: w.label,
    vintage: w.vintage,
    region: w.region,
    color: w.color,
    drinkWindow: w.drinkWindow,
    foodPairings: w.foodPairings,
    quantity: w.quantity,
    storageLocation: w.storageLocation,
  }));
  return `PLAT : ${request.dish}\n\nINVENTAIRE DE LA CAVE (JSON) :\n${JSON.stringify(inventory)}`;
}

/**
 * Parse la réponse du sommelier avec garde anti-hallucination : toute
 * recommandation dont l'itemId n'existe pas dans la cave est écartée. Le
 * libellé affiché vient toujours de la base, jamais du modèle.
 */
export function parsePairingResponse(raw: string, cellar: CellarWineEntry[]): PairingResult {
  const parsed = parseModelJson(raw);
  if (!isRecord(parsed)) return { recommendations: [], fallbackAdvice: undefined };

  const byId = new Map(cellar.map((wine) => [wine.itemId, wine]));
  const recommendationById = new Map<string, PairingRecommendation>();
  const rawRecommendations = parsed['recommendations'];

  if (Array.isArray(rawRecommendations)) {
    for (const rawRecommendation of rawRecommendations) {
      if (!isRecord(rawRecommendation)) continue;

      const itemId = nonEmptyString(rawRecommendation['itemId']);
      if (!itemId) continue;
      const inCellar = byId.get(itemId);
      if (!inCellar) continue; // anti-hallucination : hors cave → écarté

      const score = Math.min(1, Math.max(0, finiteNumber(rawRecommendation['score']) ?? 0.5));
      const recommendation: PairingRecommendation = {
        itemId,
        // Le modèle ne peut pas renommer un item réel avec une bouteille prestigieuse.
        label: inCellar.label,
        score,
        reasoning:
          nonEmptyString(rawRecommendation['reasoning']) ??
          'Justification indisponible — accord à confirmer selon vos préférences.',
        ...(nonEmptyString(rawRecommendation['serveAt'])
          ? { serveAt: nonEmptyString(rawRecommendation['serveAt']) }
          : {}),
      };

      // Un même itemId ne doit jamais occuper plusieurs places du top 3.
      const existing = recommendationById.get(itemId);
      if (!existing || recommendation.score > existing.score) {
        recommendationById.set(itemId, recommendation);
      }
    }
  }

  const recommendations = [...recommendationById.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    recommendations,
    fallbackAdvice: nonEmptyString(parsed['fallbackAdvice']),
  };
}

/** Sens 1 : plat → meilleur(s) vin(s) de la cave, via le LLM serveur. */
export async function recommendForDish(
  request: PairingRequest,
  vision: VisionModel,
): Promise<PairingResult> {
  if (request.cellar.length === 0) {
    return { recommendations: [], fallbackAdvice: EMPTY_CELLAR_ADVICE };
  }
  const raw = await vision.complete({
    system: CELLAR_SOMMELIER_PROMPT,
    prompt: buildPairingUserPrompt(request),
    maxTokens: 1024,
  });
  return parsePairingResponse(raw, request.cellar);
}

/**
 * Sens 2 : vins de la cave arrivés à leur apogée cette année → suggestion
 * « à boire », accompagnée des accords mets-vins de l'analyse ZAPPA.
 */
export function drinkNowSuggestions(
  wines: AnalyzedCellarWine[],
  year: number,
): DrinkNowSuggestion[] {
  const out: DrinkNowSuggestion[] = [];
  for (const wine of wines) {
    if (!isInDrinkWindow(wine.payload, year)) continue;
    const window = wine.payload.tasting.drinkWindow;
    out.push({
      itemId: wine.itemId,
      label: wine.label,
      vintage: wine.vintage,
      windowFrom: window.from,
      windowTo: window.to,
      suggestedDishes: Array.isArray(wine.payload.comparisons?.foodPairings)
        ? wine.payload.comparisons.foodPairings.filter((d): d is string => typeof d === 'string').slice(0, 3)
        : [],
    });
  }
  // Les fenêtres qui se referment le plus tôt d'abord (urgence de service).
  return out.sort((a, b) => a.windowTo - b.windowTo);
}
