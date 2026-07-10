/**
 * @velum/domain-stamp — module VELUM Timbres (philatélie), moteur `phila_v1`.
 * Module à part entière (décision produit juillet 2026). Expose le plugin,
 * le system prompt, la normalisation des références de catalogue et les
 * adaptateurs de sources de prix (§9).
 */
export {
  StampDomainPlugin,
  stampPlugin,
  STAMP_RECOGNITION_SYSTEM_PROMPT,
  CONDITION_CAVEAT,
  PHILA_ENGINE,
  normalizeStampStatus,
} from './plugin';
export { PHILA_SYSTEM_PROMPT } from './phila';
export {
  normalizeCatalogNumber,
  type NormalizedCatalogNumber,
  type StampCatalog,
} from './catalog';
export {
  ageDaysFromIso,
  toCurrency,
  toPositiveNumber,
  type SourceAdapterOptions,
  type Transport,
} from './sources/transport';
export { ColnectSource } from './sources/colnect';
export { YvertCoteSource } from './sources/yvertCote';
export { DelcampeSource } from './sources/delcampe';
export { EbaySoldSource } from './sources/ebaySold';
export { CatawikiSource } from './sources/catawiki';
export { extractFirstJsonBlock, parseLooseJson, stripMarkdownFences } from './json';
