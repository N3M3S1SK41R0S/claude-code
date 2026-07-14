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
} from './plugin.ts';
export { PHILA_SYSTEM_PROMPT } from './phila.ts';
export {
  normalizeCatalogNumber,
  type NormalizedCatalogNumber,
  type StampCatalog,
} from './catalog.ts';
export {
  gradeStamp,
  type StampGrade,
  type StampGradeFactors,
} from './grading.ts';
export {
  ageDaysFromIso,
  toCurrency,
  toPositiveNumber,
  type SourceAdapterOptions,
  type Transport,
} from './sources/transport.ts';
export { ColnectSource } from './sources/colnect.ts';
export { YvertCoteSource } from './sources/yvertCote.ts';
export { DelcampeSource } from './sources/delcampe.ts';
export { EbaySoldSource } from './sources/ebaySold.ts';
export { CatawikiSource } from './sources/catawiki.ts';
export { extractFirstJsonBlock, parseLooseJson, stripMarkdownFences } from './json.ts';
