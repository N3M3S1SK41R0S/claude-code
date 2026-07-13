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
  type AnalyzedCellarWine,
} from './cellar.ts';
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
export { extractBalancedJson, parseModelJson } from './json.ts';
export { isoToAgeDays } from './transport.ts';
export type { Transport, SourceAdapterOptions } from './transport.ts';
export { WineSearcherSource } from './sources/wineSearcher.ts';
export { IdealwineSource } from './sources/idealwine.ts';
export { VivinoSource } from './sources/vivino.ts';
export { CavissimaSource } from './sources/cavissima.ts';
