/**
 * @velum/domain-watch — module VELUM Montres de collection (hommes et femmes),
 * moteur `watch_v1`. Module à part entière (décision produit juillet 2026).
 * Expose le plugin (spécifications, mécanisme, histoire du modèle — pourquoi,
 * par qui —, état) et les adaptateurs de sources de prix (§9) : les dernières
 * transactions vivent dans les observations de la valorisation §7.
 */
export {
  WatchDomainPlugin,
  watchPlugin,
  WATCH_RECOGNITION_SYSTEM_PROMPT,
  CONDITION_CAVEAT,
  WATCH_ENGINE,
  WATCH_DISCLAIMERS,
} from './plugin.ts';
export { WATCH_SYSTEM_PROMPT } from './horo.ts';
export {
  ageDaysFromIso,
  toCurrency,
  toPositiveNumber,
  type SourceAdapterOptions,
  type Transport,
} from './sources/transport.ts';
export { HeritageSource } from './sources/heritage.ts';
export { WatchChartsSource } from './sources/watchCharts.ts';
export { EbaySoldSource } from './sources/ebaySold.ts';
export { CatawikiSource } from './sources/catawiki.ts';
export { Chrono24Source } from './sources/chrono24.ts';
export { extractFirstJsonBlock, parseLooseJson, stripMarkdownFences } from './json.ts';
