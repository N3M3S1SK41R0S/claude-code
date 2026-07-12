/**
 * @velum/domain-wine — module VELUM Vin (moteur ZAPPA∴VINI∴SAPIENS).
 * Point d'entrée public : plugin, prompts, adaptateurs de sources et helpers cave.
 */
export {
  WineDomainPlugin,
  winePlugin,
  WINE_DISCLAIMERS,
  WINE_RECOGNITION_SYSTEM_PROMPT,
} from './plugin';
export { ZAPPA_SYSTEM_PROMPT } from './zappa';
export { normalizeWineLabel, parseVintage } from './normalize';
export {
  isInDrinkWindow,
  recommendForDish,
  drinkNowSuggestions,
  parsePairingResponse,
  buildPairingUserPrompt,
  CELLAR_SOMMELIER_PROMPT,
  type AnalyzedCellarWine,
} from './cellar';
export {
  buildBlindTastingSession,
  BLIND_TASTING_STEPS,
  type BlindTastingWine,
  type BlindTastingSession,
  type BlindCard,
  type BlindAnswer,
  type BlindStep,
  type BlindStepKey,
} from './blindTasting';
export { extractBalancedJson, parseModelJson } from './json';
export { isoToAgeDays } from './transport';
export type { Transport, SourceAdapterOptions } from './transport';
export { WineSearcherSource } from './sources/wineSearcher';
export { IdealwineSource } from './sources/idealwine';
export { VivinoSource } from './sources/vivino';
export { CavissimaSource } from './sources/cavissima';
