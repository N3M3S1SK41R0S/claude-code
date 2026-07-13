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
} from './plugin.ts';
export { NUMIS_SYSTEM_PROMPT } from './numis.ts';
export { normalizeGrade, sheldonToFr, type GradeScale, type NormalizedGrade } from './grade.ts';
export {
  ageDaysFromIso,
  toCurrency,
  toPositiveNumber,
  type SourceAdapterOptions,
  type Transport,
} from './sources/transport.ts';
export { NumistaSource } from './sources/numista.ts';
export { PcgsSource } from './sources/pcgs.ts';
export { NgcSource } from './sources/ngc.ts';
export { EbaySoldSource } from './sources/ebaySold.ts';
export { CatawikiSource } from './sources/catawiki.ts';
export { HeritageSource } from './sources/heritage.ts';
export { CgbSource } from './sources/cgb.ts';
export { extractFirstJsonBlock, parseLooseJson, stripMarkdownFences } from './json.ts';
