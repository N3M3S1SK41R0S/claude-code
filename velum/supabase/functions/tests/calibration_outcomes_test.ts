import {
  assertEquals,
  assertThrows,
} from 'jsr:@std/assert@1';

import { parseCalibrationOutcomes } from '../calibration/outcomes.ts';

Deno.test('parseCalibrationOutcomes accepte les nombres JSON et Postgres textuels', () => {
  const outcomes = parseCalibrationOutcomes(
    [
      {
        central: '100',
        ci80_low: 90,
        ci80_high: '110',
        ci95_low: '80',
        ci95_high: 120,
        realized: '105',
      },
    ],
    'wine',
  );

  assertEquals(outcomes, [
    {
      central: 100,
      ci80: [90, 110],
      ci95: [80, 120],
      realized: 105,
      domain: 'wine',
    },
  ]);
});

Deno.test('parseCalibrationOutcomes refuse les lignes et nombres malformés', () => {
  assertThrows(
    () => parseCalibrationOutcomes(null, 'coin'),
    TypeError,
    'tableau attendu',
  );
  assertThrows(
    () => parseCalibrationOutcomes([null], 'coin'),
    TypeError,
    'objet attendu',
  );
  assertThrows(
    () =>
      parseCalibrationOutcomes(
        [
          {
            central: 'inconnu',
            ci80_low: 90,
            ci80_high: 110,
            ci95_low: 80,
            ci95_high: 120,
            realized: 105,
          },
        ],
        'coin',
      ),
    TypeError,
    'central numérique attendu',
  );
});

Deno.test('parseCalibrationOutcomes refuse les prix non positifs', () => {
  assertThrows(
    () =>
      parseCalibrationOutcomes(
        [
          {
            central: 100,
            ci80_low: 90,
            ci80_high: 110,
            ci95_low: 80,
            ci95_high: 120,
            realized: 0,
          },
        ],
        'art',
      ),
    RangeError,
    'doivent être positifs',
  );
});

Deno.test('parseCalibrationOutcomes refuse les intervalles inversés ou emboîtés à tort', () => {
  const base = {
    central: 100,
    ci80_low: 90,
    ci80_high: 110,
    ci95_low: 80,
    ci95_high: 120,
    realized: 105,
  };

  assertThrows(
    () => parseCalibrationOutcomes([{ ...base, ci80_low: 111 }], 'stamp'),
    RangeError,
    "bornes d'intervalle inversées",
  );
  assertThrows(
    () => parseCalibrationOutcomes([{ ...base, ci95_low: 95 }], 'stamp'),
    RangeError,
    "l'IC 95 doit contenir l'IC 80",
  );
});
