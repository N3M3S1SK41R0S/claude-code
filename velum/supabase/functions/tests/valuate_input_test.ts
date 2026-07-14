import { assertEquals } from 'jsr:@std/assert@1';
import type { Candidate } from '@velum/core';

import {
  validateValuationRequest,
  type ValuationRequest,
} from '../valuate/input.ts';

function expectOk(result: ReturnType<typeof validateValuationRequest>): ValuationRequest {
  if (!result.ok) throw new Error(`Requête valide attendue : ${result.message}`);
  return result.value;
}

function expectError(result: ReturnType<typeof validateValuationRequest>, fragment: string): void {
  if (result.ok) throw new Error(`Erreur contenant « ${fragment} » attendue`);
  if (!result.message.includes(fragment)) {
    throw new Error(`Message inattendu : « ${result.message} »`);
  }
}

const candidate: Candidate = {
  id: 'wine-1',
  domain: 'wine',
  label: 'Château Exemple 2019',
  confidence: 0.82,
  attributes: { vintage: 2019 },
};

Deno.test('validateValuationRequest accepte le contrat nominal avec persistance', () => {
  const request = expectOk(
    validateValuationRequest({
      domain: 'wine',
      candidate,
      itemId: 'item-1',
    }),
  );

  assertEquals(request.domain, 'wine');
  assertEquals(request.candidate, candidate);
  assertEquals(request.itemId, 'item-1');
});

Deno.test('validateValuationRequest refuse les corps non objets', () => {
  expectError(validateValuationRequest(null), 'objet attendu');
  expectError(validateValuationRequest([]), 'objet attendu');
  expectError(validateValuationRequest('wine'), 'objet attendu');
});

Deno.test('validateValuationRequest refuse un candidat incompatible avec le domaine', () => {
  expectError(
    validateValuationRequest({ domain: 'coin', candidate }),
    'appartient au domaine',
  );
});

Deno.test('validateValuationRequest refuse les candidats susceptibles de casser un plugin', () => {
  expectError(
    validateValuationRequest({ domain: 'wine', candidate: { ...candidate, attributes: null } }),
    'attributes',
  );
  expectError(
    validateValuationRequest({ domain: 'wine', candidate: { ...candidate, confidence: 2 } }),
    'confidence',
  );
});

Deno.test('validateValuationRequest refuse un itemId fourni mais invalide', () => {
  expectError(
    validateValuationRequest({ domain: 'wine', candidate, itemId: 42 }),
    'itemId',
  );
  expectError(
    validateValuationRequest({ domain: 'wine', candidate, itemId: '   ' }),
    'itemId',
  );
});
