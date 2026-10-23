/**
 * Cave du MODE DÉMO — fiches de vins aux fenêtres d'apogée VARIÉES, exprimées
 * RELATIVEMENT à l'année en cours : la démo montre toujours tous les statuts
 * (dépassé, dernière année, apogée, l'an prochain, en garde) quelle que soit
 * la date. Le « sommelier IA » démo s'appuie sur l'appariement local
 * déterministe (aucun appel réseau). Fonctions pures (année injectable), testées.
 */
import type { PairingResult, VelumItem } from '@velum/core';
import { formatCellarLocationShort } from '@velum/domain-wine';

import { localPairingForItems } from './drinkNow';

export interface DemoWineSpec {
  /** Début et fin de la fenêtre, en années par rapport à l'année en cours. */
  window: [number, number];
  color: 'rouge' | 'blanc' | 'rosé' | 'effervescent';
  appellation: string;
  region: string;
  vintage: number;
  foodPairings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Dérive une fiche démo d'une fiche de base : identification (couleur,
 * appellation, région, millésime), fenêtre d'apogée relative et accords.
 */
export function demoWineAnalysis(
  base: Record<string, unknown>,
  spec: DemoWineSpec,
  year: number = new Date().getFullYear(),
): Record<string, unknown> {
  const identification = isRecord(base['identification']) ? base['identification'] : {};
  const tasting = isRecord(base['tasting']) ? base['tasting'] : {};
  const comparisons = isRecord(base['comparisons']) ? base['comparisons'] : {};
  return {
    ...base,
    identification: {
      ...identification,
      appellation: spec.appellation,
      color: spec.color,
      region: spec.region,
      vintage: spec.vintage,
    },
    tasting: {
      ...tasting,
      drinkWindow: { from: year + spec.window[0], to: year + spec.window[1] },
    },
    comparisons: { ...comparisons, foodPairings: [...spec.foodPairings] },
  };
}

/**
 * Sommelier de cave DÉMO : même contrat que l'Edge Function `cellar-pairing`
 * (PairingResult), calculé par l'appariement local — l'emplacement est cité
 * dans la justification, comme le demande le prompt du sommelier IA.
 */
export function demoCellarPairing(dish: string, wines: readonly VelumItem[], year: number): PairingResult {
  const local = localPairingForItems(dish, wines, year);
  const recommendations = local.suggestions.map((suggestion) => {
    const location = formatCellarLocationShort(suggestion.storageLocation);
    return {
      itemId: suggestion.itemId,
      label: suggestion.label,
      score: suggestion.score,
      reasoning: `${suggestion.reason}${location ? ` Rangé : ${location}.` : ''} (Mode démo : accord calculé localement.)`,
    };
  });
  if (recommendations.length > 0) return { recommendations };
  return {
    recommendations: [],
    fallbackAdvice:
      local.categories.length === 0
        ? 'Mode démo : plat non reconnu — précisez l’ingrédient principal (agneau, poisson, chèvre…).'
        : `Rien de vraiment adapté dans votre cave — à acheter : ${local.purchaseIdeas.join(', ')}.`,
  };
}
