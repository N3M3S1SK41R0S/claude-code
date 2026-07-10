/**
 * @velum/domain-coin — module VELUM Pièces (numismatique), moteur `numis_v1`.
 * Expose le plugin, le system prompt, la normalisation des grades et les
 * adaptateurs de sources de prix (§9).
 */
export {
  CoinDomainPlugin,
  coinPlugin,
  COIN_RECOGNITION_SYSTEM_PROMPT,
  GRADE_CAVEAT,
  NUMIS_ENGINE,
} from './plugin';
export { NUMIS_SYSTEM_PROMPT } from './numis';
export { normalizeGrade, sheldonToFr, type GradeScale, type NormalizedGrade } from './grade';
export {
  ageDaysFromIso,
  toCurrency,
  toPositiveNumber,
  type SourceAdapterOptions,
  type Transport,
} from './sources/transport';
export { NumistaSource } from './sources/numista';
export { PcgsSource } from './sources/pcgs';
export { NgcSource } from './sources/ngc';
export { EbaySoldSource } from './sources/ebaySold';
export { CatawikiSource } from './sources/catawiki';
export { HeritageSource } from './sources/heritage';
export { CgbSource } from './sources/cgb';
export { extractFirstJsonBlock, parseLooseJson, stripMarkdownFences } from './json';
