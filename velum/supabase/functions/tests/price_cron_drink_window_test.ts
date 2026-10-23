import { assertEquals } from 'jsr:@std/assert@1';

import {
  DRINK_WINDOW_ROUTE,
  drinkWindowNotification,
  pairingsFromPayload,
} from '../price-cron/drinkWindow.ts';

const PAYLOAD = {
  tasting: { drinkWindow: { from: 2020, to: 2030 } },
  comparisons: { foodPairings: ['gigot d’agneau', '  ', 'daube provençale', 'fromages affinés'] },
};

Deno.test('alerte à boire : position compacte et deux plats ZAPPA', () => {
  assertEquals(
    drinkWindowNotification({
      label: 'Bandol Domaine Tempier 2015',
      storageLocation: 'Rangée 2 · Colonne 4 · Place 1',
      payload: PAYLOAD,
      currentYear: 2026,
    }),
    {
      title: 'À boire — apogée atteinte',
      body:
        "Bandol Domaine Tempier 2015 est dans sa fenêtre de consommation optimale (jusqu'en 2030)." +
        ' Emplacement : Rangée 2 · Col. 4 · Pl. 1.' +
        ' Accord suggéré : gigot d’agneau ou daube provençale.',
    },
  );
});

Deno.test('alerte à boire : dernière année signalée, texte libre conservé', () => {
  const content = drinkWindowNotification({
    label: '  ',
    storageLocation: ' Cave — casier B3 ',
    payload: { ...PAYLOAD, tasting: { drinkWindow: { from: 2020, to: 2026 } } },
    currentYear: 2026,
  });
  assertEquals(content.title, 'À boire — dernière année d’apogée');
  assertEquals(content.body.startsWith('Une de vos bouteilles est dans sa fenêtre'), true);
  assertEquals(content.body.includes('Emplacement : Cave — casier B3.'), true);
});

Deno.test('alerte à boire : payload JSONB malformé → message sobre, jamais de crash', () => {
  for (const payload of [null, 'texte', { comparisons: { foodPairings: 'plat' } }, { tasting: { drinkWindow: { from: 2030, to: 2020 } } }]) {
    const content = drinkWindowNotification({ label: 'Vin X', storageLocation: null, payload, currentYear: 2026 });
    assertEquals(content.body, 'Vin X est dans sa fenêtre de consommation optimale.');
  }
  assertEquals(pairingsFromPayload({ comparisons: { foodPairings: ['a', 42, 'a', 'b', 'c'] } }), ['a', 'b']);
  assertEquals(DRINK_WINDOW_ROUTE, '/cellar-peak');
});
