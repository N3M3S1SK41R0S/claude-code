/**
 * Edge Function `analyze-art` — fiche œuvre/tableau (moteur 'art_v1').
 * POST { candidate, itemId? } → AnalysisResult.
 */
import { artPlugin } from '@velum/domain-art';
import { makeAnalyzeHandler } from '../_shared/analyze.ts';

Deno.serve(makeAnalyzeHandler(artPlugin));
