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

Deno.test('parseCellarRows calcule le statut d’apogée de l’année injectée', () => {
  const rows = [
    {
      id: 'closing',
      title: 'Bandol 2015',
      storage_location: 'Rangée 2 · Colonne 4 · Place 1',
      attributes: { analysis: { tasting: { drinkWindow: { from: 2020, to: 2026 } } } },
    },
    {
      id: 'young',
      title: 'Barolo 2021',
      attributes: { analysis: { tasting: { drinkWindow: { from: 2031, to: 2050 } } } },
    },
    { id: 'unknown', title: 'Vin sans fiche', attributes: {} },
  ];
  const parsed = parseCellarRows(rows, { year: 2026 });
  assertEquals(parsed.map((wine) => [wine.itemId, wine.peakStatus]), [
    ['closing', 'closing'],
    ['young', 'young'],
    ['unknown', 'unknown'],
  ]);
  assertEquals(parsed[0]?.storageLocation, 'Rangée 2 · Colonne 4 · Place 1');
  // Sans année : aucun statut inventé (rétro-compatibilité).
  assertEquals(parseCellarRows(rows)[0]?.peakStatus, undefined);
});

Deno.test('parseCellarRows relit l’identification ZAPPA à défaut d’attributs directs', () => {
  const [wine] = parseCellarRows(
    [
      {
        id: 'wine-1',
        title: 'Domaine Tempier',
        attributes: {
          color: 'rouge',
          analysis: {
            identification: {
              vintage: 2015,
              color: 'blanc',
              region: 'Provence',
              appellation: ' Bandol ',
              grapes: [{ name: 'mourvèdre', percent: 75 }, { name: 'grenache' }, { percent: 5 }, 'mourvèdre'],
            },
          },
        },
      },
    ],
    { year: 2026 },
  );
  assertEquals(wine, {
    itemId: 'wine-1',
    label: 'Domaine Tempier',
    vintage: 2015,
    region: 'Provence',
    appellation: 'Bandol',
    // L'attribut direct (corrigé par l'utilisateur) prime sur la fiche.
    color: 'rouge',
    grapes: ['mourvèdre', 'grenache'],
    peakStatus: 'unknown',
  });
});
