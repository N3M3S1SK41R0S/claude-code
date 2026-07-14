import {
  assertEquals,
  assertThrows,
} from 'jsr:@std/assert@1';

import {
  parseCellarRows,
  validatePairingBody,
} from '../cellar-pairing/input.ts';

function expectError(
  result: ReturnType<typeof validatePairingBody>,
  fragment: string,
): void {
  if (result.ok) throw new Error(`Erreur contenant « ${fragment} » attendue`);
  if (!result.message.includes(fragment)) {
    throw new Error(`Message inattendu : ${result.message}`);
  }
}

Deno.test('validatePairingBody normalise le plat et refuse les corps invalides', () => {
  assertEquals(validatePairingBody({ dish: '  risotto aux cèpes  ' }), {
    ok: true,
    value: { dish: 'risotto aux cèpes' },
  });
  expectError(validatePairingBody(null), 'objet attendu');
  expectError(validatePairingBody({ dish: '' }), "Champ 'dish'");
  expectError(validatePairingBody({ dish: 'x'.repeat(501) }), '≤ 500');
});

Deno.test('parseCellarRows extrait seulement les champs JSONB valides', () => {
  assertEquals(
    parseCellarRows([
      {
        id: 'wine-1',
        title: '  Bandol Domaine Tempier 2018  ',
        storage_location: ' Casier B3 ',
        attributes: {
          vintage: 2018,
          region: 'Provence',
          color: 'rouge',
          quantity: 2,
          analysis: {
            tasting: { drinkWindow: { from: 2024, to: 2032 } },
            comparisons: { foodPairings: ['  daube  ', 42, ''] },
          },
        },
      },
    ]),
    [
      {
        itemId: 'wine-1',
        label: 'Bandol Domaine Tempier 2018',
        vintage: 2018,
        region: 'Provence',
        color: 'rouge',
        storageLocation: 'Casier B3',
        drinkWindow: { from: 2024, to: 2032 },
        foodPairings: ['daube'],
        quantity: 2,
      },
    ],
  );
});

Deno.test('parseCellarRows construit un libellé ou affiche le repli honnête', () => {
  const rows = parseCellarRows([
    {
      id: 'wine-1',
      title: null,
      attributes: { producer: 'Domaine X', cuvee: 'Réserve', vintage: 2019 },
      storage_location: null,
    },
    { id: 'wine-2', title: '   ', attributes: [], storage_location: null },
  ]);

  assertEquals(rows[0]?.label, 'Domaine X Réserve 2019');
  assertEquals(rows[1]?.label, 'Vin sans étiquette');
});

Deno.test('parseCellarRows omet les fenêtres et champs optionnels malformés', () => {
  assertEquals(
    parseCellarRows([
      {
        id: 'wine-1',
        title: 'Vin A',
        attributes: {
          vintage: '2018',
          quantity: Number.NaN,
          analysis: {
            tasting: { drinkWindow: { from: 2030, to: 2020 } },
            comparisons: { foodPairings: 'plat' },
          },
        },
      },
    ]),
    [{ itemId: 'wine-1', label: 'Vin A' }],
  );
});

Deno.test('parseCellarRows bloque une ligne sans identifiant anti-hallucination', () => {
  assertThrows(() => parseCellarRows(null), TypeError, 'tableau attendu');
  assertThrows(() => parseCellarRows([null]), TypeError, 'objet attendu');
  assertThrows(
    () => parseCellarRows([{ id: '', title: 'Vin', attributes: {} }]),
    TypeError,
    'id non vide attendu',
  );
});
