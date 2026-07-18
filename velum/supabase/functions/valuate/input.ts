import type { Candidate, VelumDomain } from '@velum/core';
import { isVelumDomain } from '../_shared/domains.ts';
import {
  validateCandidate,
  validateJsonObject,
  type ValidationResult,
} from '../_shared/input.ts';

export interface ValuationRequest {
  domain: VelumDomain;
  candidate: Candidate;
  itemId?: string;
}

function invalid(message: string): ValidationResult<ValuationRequest> {
  return { ok: false, message };
}

/** Valide intégralement le corps public de l'Edge Function `valuate`. */
export function validateValuationRequest(value: unknown): ValidationResult<ValuationRequest> {
  const bodyResult = validateJsonObject(value);
  if (!bodyResult.ok) return invalid(bodyResult.message);
  const body = bodyResult.value;

  const domain = body['domain'];
  if (!isVelumDomain(domain)) {
    return invalid('Domaine inconnu (attendu : wine, coin, art, stamp ou watch)');
  }

  const candidateResult = validateCandidate(body['candidate'], domain);
  if (!candidateResult.ok) return invalid(candidateResult.message);

  const rawItemId = body['itemId'];
  if (
    rawItemId !== undefined &&
    (typeof rawItemId !== 'string' || rawItemId.trim().length === 0)
  ) {
    return invalid("Champ 'itemId' invalide : chaîne non vide attendue");
  }

  return {
    ok: true,
    value: {
      domain,
      candidate: candidateResult.value,
      ...(typeof rawItemId === 'string' ? { itemId: rawItemId } : {}),
    },
  };
}
