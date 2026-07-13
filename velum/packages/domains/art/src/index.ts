/**
 * @velum/domain-art — module VELUM Tableaux (moteur `art_v1`).
 * Point d'entrée public : plugin, prompts, adaptateurs de sources et helpers.
 */
export {
  ArtDomainPlugin,
  artPlugin,
  ART_DISCLAIMERS,
  ART_ENGINE,
  ART_RECOGNITION_SYSTEM_PROMPT,
} from './plugin.ts';
export { ART_SYSTEM_PROMPT } from './art.ts';
export { parseDimensions, type ParsedDimensions } from './dimensions.ts';
export { extractBalancedJson, parseModelJson } from './json.ts';
export { isoToAgeDays } from './transport.ts';
export type { Transport, SourceAdapterOptions } from './transport.ts';
export { ArtpriceSource } from './sources/artprice.ts';
export { ArtsySource } from './sources/artsy.ts';
export { DrouotSource } from './sources/drouot.ts';
export { HeritageArtSource } from './sources/heritage.ts';
export { MagnusSource } from './sources/magnus.ts';
