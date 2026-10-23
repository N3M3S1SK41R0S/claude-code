/**
 * @velum/domain-wine — module VELUM Vin (moteur ZAPPA∴VINI∴SAPIENS).
 * Point d'entrée public : plugin, prompts, adaptateurs de sources et helpers cave.
 */
export {
  WineDomainPlugin,
  winePlugin,
  WINE_DISCLAIMERS,
  WINE_RECOGNITION_SYSTEM_PROMPT,
} from './plugin.ts';
export { ZAPPA_SYSTEM_PROMPT } from './zappa.ts';
export { normalizeWineLabel, parseVintage } from './normalize.ts';
export {
  isInDrinkWindow,
  recommendForDish,
  drinkNowSuggestions,
  parsePairingResponse,
  buildPairingUserPrompt,
  CELLAR_SOMMELIER_PROMPT,
  EMPTY_CELLAR_ADVICE,
  type AnalyzedCellarWine,
} from './cellar.ts';
export {
  peakStatus,
  validDrinkWindow,
  isPeakStatus,
  cellarAtPeak,
  comparePeakEntries,
  mostUrgentPeakWine,
  countByPeakStatus,
  parseCellarSlotText,
  formatCellarLocationShort,
  DRINKABLE_STATUSES,
  type CellarAtPeakOptions,
  type CellarSlotParts,
} from './peak.ts';
export {
  localPairing,
  localPairingReason,
  classifyWine,
  dishCategories,
  normalizeDishText,
  LOCAL_PAIRING_THRESHOLD,
  LOCAL_PAIRING_MAX_SCORE,
  WINE_FAMILY_LABELS_FR,
  DISH_CATEGORY_LABELS_FR,
  type LocalPairingOptions,
  type WineClassification,
} from './localPairing.ts';
export {
  buildBlindTastingSession,
  BLIND_TASTING_STEPS,
  type BlindTastingWine,
  type BlindTastingSession,
  type BlindCard,
  type BlindAnswer,
  type BlindStep,
  type BlindStepKey,
} from './blindTasting.ts';
export {
  recalibrateDrinkWindow,
  type OpeningEvent,
  type OpeningVerdict,
  type DrinkWindow,
  type RecalibratedWindow,
} from './recalibrate.ts';
export {
  resolveWineOrigin,
  projectNorm,
  bboxAspect,
  normalizePlace,
  FRANCE_BBOX,
  WORLD_BBOX,
  FRANCE_OUTLINE,
  CORSICA_OUTLINE,
  WORLD_OUTLINES,
  FRENCH_PLACES,
  FOREIGN_PLACES,
  type WineOrigin,
  type MapScope,
  type BBox,
  type LatLng,
} from './geo.ts';
export { extractBalancedJson, parseModelJson } from './json.ts';
export { isoToAgeDays } from './transport.ts';
export type { Transport, SourceAdapterOptions } from './transport.ts';
export { WineSearcherSource } from './sources/wineSearcher.ts';
export { IdealwineSource } from './sources/idealwine.ts';
export { VivinoSource } from './sources/vivino.ts';
export { CavissimaSource } from './sources/cavissima.ts';
