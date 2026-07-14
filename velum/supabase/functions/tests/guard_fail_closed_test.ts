import { assertEquals } from 'jsr:@std/assert@1';

import {
  runGuardCheck,
  type GuardCheckDeps,
} from '../_shared/guard.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readError(response: Response): Promise<{ code: string; message: string }> {
  const body: unknown = await response.json();
  if (!isRecord(body) || !isRecord(body['error'])) {
    throw new Error('Enveloppe d’erreur attendue');
  }
  const code = body['error']['code'];
  const message = body['error']['message'];
  if (typeof code !== 'string' || typeof message !== 'string') {
    throw new Error('Code et message d’erreur attendus');
  }
  return { code, message };
}

function testDeps(
  rpc: GuardCheckDeps['rpc'],
  logs: Record<string, unknown>[],
): GuardCheckDeps {
  return {
    rpc,
    now: () => '2026-07-14T12:00:00.000Z',
    log: (entry) => logs.push(entry),
  };
}

Deno.test('runGuardCheck transmet la première IP proxy et laisse passer une décision ok', async () => {
  const logs: Record<string, unknown>[] = [];
  let observedIp = '';
  const response = await runGuardCheck(
    new Request('https://velum.test/recognize', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    }),
    testDeps(async (ip) => {
      observedIp = ip;
      return { data: 'ok', error: null };
    }, logs),
  );

  assertEquals(response, null);
  assertEquals(observedIp, '203.0.113.10');
  assertEquals(logs, []);
});

Deno.test('runGuardCheck refuse l’appel si le RPC renvoie une erreur', async () => {
  const logs: Record<string, unknown>[] = [];
  const response = await runGuardCheck(
    new Request('https://velum.test/analyze-wine'),
    testDeps(async () => ({
      data: null,
      error: { message: 'base indisponible' },
    }), logs),
  );

  if (response === null) throw new Error('Réponse de refus attendue');
  assertEquals(response.status, 503);
  assertEquals((await readError(response)).code, 'SOURCE_UNAVAILABLE');
  assertEquals(logs, [
    {
      at: '2026-07-14T12:00:00.000Z',
      event: 'guard.unavailable',
      message: 'base indisponible',
    },
  ]);
});

Deno.test('runGuardCheck refuse l’appel si le RPC lève une exception', async () => {
  const logs: Record<string, unknown>[] = [];
  const response = await runGuardCheck(
    new Request('https://velum.test/analyze-coin'),
    testDeps(async () => {
      throw new Error('transport interrompu');
    }, logs),
  );

  if (response === null) throw new Error('Réponse de refus attendue');
  assertEquals(response.status, 503);
  assertEquals((await readError(response)).code, 'SOURCE_UNAVAILABLE');
  assertEquals(logs[0]?.['event'], 'guard.unavailable');
  assertEquals(logs[0]?.['message'], 'transport interrompu');
});

Deno.test('runGuardCheck refuse une décision SQL inconnue au lieu de laisser passer', async () => {
  const logs: Record<string, unknown>[] = [];
  const response = await runGuardCheck(
    new Request('https://velum.test/analyze-art'),
    testDeps(async () => ({ data: 'nouvelle-valeur-inattendue', error: null }), logs),
  );

  if (response === null) throw new Error('Réponse de refus attendue');
  assertEquals(response.status, 503);
  assertEquals((await readError(response)).code, 'SOURCE_UNAVAILABLE');
  assertEquals(logs[0]?.['event'], 'guard.invalid_result');
  assertEquals(logs[0]?.['decision'], 'nouvelle-valeur-inattendue');
});

Deno.test('runGuardCheck conserve les statuts métier du garde-fou', async () => {
  const cases = [
    { decision: 'budget', status: 503, code: 'SOURCE_UNAVAILABLE' },
    { decision: 'user', status: 429, code: 'RATE_LIMITED' },
    { decision: 'ip', status: 429, code: 'RATE_LIMITED' },
    { decision: 'unauthorized', status: 401, code: 'UNAUTHORIZED' },
  ];

  for (const expected of cases) {
    const response = await runGuardCheck(
      new Request('https://velum.test/recognize'),
      testDeps(async () => ({ data: expected.decision, error: null }), []),
    );
    if (response === null) throw new Error(`Refus attendu pour ${expected.decision}`);
    assertEquals(response.status, expected.status);
    assertEquals((await readError(response)).code, expected.code);
  }
});
