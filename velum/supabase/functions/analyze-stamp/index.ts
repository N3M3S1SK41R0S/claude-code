/**
 * Edge Function `analyze-stamp` — fiche philatélique (moteur 'phila_v1').
 * Module à part entière. POST { candidate, itemId? } → AnalysisResult.
 */
import { stampPlugin } from '@velum/domain-stamp';
import { makeAnalyzeHandler } from '../_shared/analyze.ts';

Deno.serve(makeAnalyzeHandler(stampPlugin));
