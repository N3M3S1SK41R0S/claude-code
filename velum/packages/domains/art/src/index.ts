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
} from './plugin';
export { ART_SYSTEM_PROMPT } from './art';
export { parseDimensions, type ParsedDimensions } from './dimensions';
export { extractBalancedJson, parseModelJson } from './json';
export { isoToAgeDays } from './transport';
export type { Transport, SourceAdapterOptions } from './transport';
export { ArtpriceSource } from './sources/artprice';
export { ArtsySource } from './sources/artsy';
export { DrouotSource } from './sources/drouot';
export { HeritageArtSource } from './sources/heritage';
export { MagnusSource } from './sources/magnus';
