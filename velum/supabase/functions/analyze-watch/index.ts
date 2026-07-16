/**
 * Edge Function `analyze-watch` — fiche horlogère (moteur 'watch_v1') :
 * spécifications, mécanisme, histoire du modèle (pourquoi, par qui), état.
 * 5e module. POST { candidate, itemId? } → AnalysisResult.
 */
import { watchPlugin } from '@velum/domain-watch';
import { makeAnalyzeHandler } from '../_shared/analyze.ts';

Deno.serve(makeAnalyzeHandler(watchPlugin));
