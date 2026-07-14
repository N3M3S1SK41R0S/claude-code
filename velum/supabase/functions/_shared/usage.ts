/**
 * Enregistrement des appels vision dans `vision_calls` — la seule fenêtre qu'on
 * ait sur ce que VELUM dépense réellement.
 *
 * Écriture en service-role (la table est protégée par une RLS sans policy :
 * un utilisateur ne doit ni lire les coûts, ni forger des lignes).
 *
 * L'écriture est un EFFET DE BORD, jamais un point de panne : si elle échoue,
 * on le journalise et l'analyse de la photo se poursuit. Perdre une ligne de
 * comptabilité est très préférable à faire échouer une identification.
 */
import { createAdminClient } from './auth.ts';
import { scheduleBackgroundTask } from './background.ts';

/** Ce que le fournisseur nous dit avoir consommé. */
export interface TokenUsage {
  input?: number;
  /** Inclut les tokens de RÉFLEXION chez Google — ce sont eux qui sont facturés. */
  output?: number;
}

/** Contexte métier de l'appel — connu de l'Edge Function, pas du client LLM. */
export interface VisionContext {
  operation: string; // recognize | analyze | cellar-pairing
  domain?: string; // wine | coin | art | stamp
  userId?: string;
}

export interface VisionCallRecord extends VisionContext {
  provider: string;
  model: string;
  attempt: number;
  usedFallback: boolean;
  ok: boolean;
  errorCode?: string;
  durationMs: number;
  usage?: TokenUsage;
}

/** Insertion best-effort, enregistrée sans bloquer la réponse HTTP. */
export function recordVisionCall(rec: VisionCallRecord): void {
  const row = {
    operation: rec.operation,
    domain: rec.domain ?? null,
    user_id: rec.userId ?? null,
    provider: rec.provider,
    model: rec.model,
    attempt: rec.attempt,
    used_fallback: rec.usedFallback,
    ok: rec.ok,
    error_code: rec.errorCode ?? null,
    duration_ms: rec.durationMs,
    input_tokens: rec.usage?.input ?? null,
    output_tokens: rec.usage?.output ?? null,
  };

  const task = (async () => {
    try {
      const { error } = await createAdminClient().from('vision_calls').insert(row);
      if (error) {
        console.log(
          JSON.stringify({ at: new Date().toISOString(), event: 'usage.insert_failed', message: error.message }),
        );
      }
    } catch (err) {
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          event: 'usage.insert_failed',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  })();

  scheduleBackgroundTask(task);
}
