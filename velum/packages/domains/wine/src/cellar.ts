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
import { parseModelJson } from './json';

/**
 * true si `year` tombe dans la fenêtre de consommation optimale [from, to]
 * (bornes incluses). Défensif : le payload provient d'un JSONB — si la fenêtre
 * est absente ou malformée, on renvoie false plutôt que d'alerter à tort.
 */
export function isInDrinkWindow(payload: WineAnalysisPayload, year: number): boolean {
  const window = payload.tasting?.drinkWindow as { from?: unknown; to?: unknown } | undefined;
  if (!window) return false;
  const { from, to } = window;
  if (typeof from !== 'number' || typeof to !== 'number') return false;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
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
 * recommandation dont l'itemId n'existe pas dans la cave est écartée.
 */
export function parsePairingResponse(raw: string, cellar: CellarWineEntry[]): PairingResult {
  const parsed = parseModelJson(raw) as {
    recommendations?: unknown;
    fallbackAdvice?: unknown;
  } | null;
  if (!parsed) return { recommendations: [], fallbackAdvice: undefined };

  const byId = new Map(cellar.map((w) => [w.itemId, w]));
  const recommendations: PairingRecommendation[] = [];
  if (Array.isArray(parsed.recommendations)) {
    for (const r of parsed.recommendations as Record<string, unknown>[]) {
      const itemId = typeof r['itemId'] === 'string' ? r['itemId'] : null;
      if (!itemId) continue;
      const inCellar = byId.get(itemId);
      if (!inCellar) continue; // anti-hallucination : hors cave → écarté
      const rawScore = typeof r['score'] === 'number' ? r['score'] : 0.5;
      recommendations.push({
        itemId,
        label: typeof r['label'] === 'string' ? r['label'] : inCellar.label,
        score: Math.min(1, Math.max(0, rawScore)),
        reasoning: typeof r['reasoning'] === 'string' ? r['reasoning'] : '',
        serveAt: typeof r['serveAt'] === 'string' ? r['serveAt'] : undefined,
      });
    }
  }
  recommendations.sort((a, b) => b.score - a.score);
  return {
    recommendations: recommendations.slice(0, 3),
    fallbackAdvice:
      typeof parsed.fallbackAdvice === 'string' && parsed.fallbackAdvice.length > 0
        ? parsed.fallbackAdvice
        : undefined,
  };
}

/** Sens 1 : plat → meilleur(s) vin(s) de la cave, via le LLM serveur. */
export async function recommendForDish(
  request: PairingRequest,
  vision: VisionModel,
): Promise<PairingResult> {
  if (request.cellar.length === 0) {
    return {
      recommendations: [],
      fallbackAdvice: 'Votre cave est vide : scannez vos premières bouteilles pour activer le sommelier.',
    };
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
