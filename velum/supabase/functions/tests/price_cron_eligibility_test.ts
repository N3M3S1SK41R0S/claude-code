import {
  assertEquals,
  assertThrows,
} from 'jsr:@std/assert@1';

import {
  isValuationStale,
  parsePlanId,
  scheduledItemDecision,
  scheduledPlanCapabilities,
  shouldProcessScheduledItem,
} from '../price-cron/eligibility.ts';

Deno.test('parsePlanId refuse les plans absents ou inconnus', () => {
  assertEquals(parsePlanId('free'), 'free');
  assertEquals(parsePlanId('platine'), 'platine');
  assertEquals(parsePlanId('diamant'), null);
  assertEquals(parsePlanId(null), null);
});

Deno.test('les capacités planifiées suivent exactement PLAN_LIMITS', () => {
  assertEquals(scheduledPlanCapabilities('free'), {
    alerts: false,
    liveValuation: false,
  });
  assertEquals(scheduledPlanCapabilities('premium'), {
    alerts: true,
    liveValuation: false,
  });
  assertEquals(scheduledPlanCapabilities('gold'), {
    alerts: true,
    liveValuation: false,
  });
  assertEquals(scheduledPlanCapabilities('platine'), {
    alerts: true,
    liveValuation: true,
  });
});

Deno.test('Free ne déclenche jamais de travail planifié', () => {
  const state = { activeAlertTypes: ['price_threshold', 'drink_window'], isStale: true };
  assertEquals(scheduledItemDecision('free', state), {
    evaluateAlerts: false,
    refreshValuation: false,
  });
  assertEquals(shouldProcessScheduledItem('free', state), false);
});

Deno.test('Premium et Gold évaluent les alertes sans valorisation périodique', () => {
  for (const plan of ['premium', 'gold'] as const) {
    assertEquals(
      scheduledItemDecision(plan, { activeAlertTypes: ['drink_window'], isStale: true }),
      { evaluateAlerts: true, refreshValuation: false },
    );
    assertEquals(
      scheduledItemDecision(plan, { activeAlertTypes: ['price_threshold'], isStale: false }),
      { evaluateAlerts: true, refreshValuation: true },
    );
  }
});

Deno.test('Platine revalorise les cotes obsolètes même sans alerte', () => {
  assertEquals(
    scheduledItemDecision('platine', { activeAlertTypes: [], isStale: true }),
    { evaluateAlerts: false, refreshValuation: true },
  );
  assertEquals(
    scheduledItemDecision('platine', { activeAlertTypes: [], isStale: false }),
    { evaluateAlerts: false, refreshValuation: false },
  );
});

Deno.test('isValuationStale traite les dates absentes ou illisibles comme obsolètes', () => {
  const boundary = '2026-07-08T00:00:00.000Z';
  assertEquals(isValuationStale(undefined, boundary), true);
  assertEquals(isValuationStale('pas une date', boundary), true);
  assertEquals(isValuationStale('2026-07-08T00:00:00.000Z', boundary), true);
  assertEquals(isValuationStale('2026-07-09T00:00:00.000Z', boundary), false);
  assertThrows(() => isValuationStale(null, 'invalide'), RangeError);
});
