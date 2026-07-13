/**
 * Edge Function `analyze-wine` — fiche 7 modules ZAPPA∴VINI∴SAPIENS (§6.2.2).
 * POST { candidate, itemId? } → AnalysisResult (moteur 'zappa_vini').
 */
import { winePlugin } from '@velum/domain-wine';
import { makeAnalyzeHandler } from '../_shared/analyze.ts';

Deno.serve(makeAnalyzeHandler(winePlugin));
