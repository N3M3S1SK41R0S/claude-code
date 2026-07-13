/**
 * Edge Function `analyze-coin` — fiche numismatique (moteur 'numis_v1').
 * POST { candidate, itemId? } → AnalysisResult.
 */
import { coinPlugin } from '@velum/domain-coin';
import { makeAnalyzeHandler } from '../_shared/analyze.ts';

Deno.serve(makeAnalyzeHandler(coinPlugin));
