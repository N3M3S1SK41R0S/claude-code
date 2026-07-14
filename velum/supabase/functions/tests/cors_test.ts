import { assertEquals } from 'jsr:@std/assert@1';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';

Deno.test('CORS autorise GET pour la lecture de calibration', () => {
  assertEquals(corsHeaders['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');

  const response = handleOptions(
    new Request('https://velum.test/calibration', { method: 'OPTIONS' }),
  );
  if (response === null) throw new Error('Réponse de pré-vol attendue');

  assertEquals(response.status, 204);
  assertEquals(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
});

Deno.test('handleOptions ne capture pas les requêtes métier', () => {
  assertEquals(
    handleOptions(new Request('https://velum.test/calibration', { method: 'GET' })),
    null,
  );
});
