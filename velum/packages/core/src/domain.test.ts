import { describe, expect, it } from 'vitest';
import {
  ASSISTED_ENTRY_THRESHOLD,
  CLASSIFICATION_MAX_LEVELS,
  MAX_SHEET_DETECTIONS,
  QUICK_SCAN_OUTPUT_RULES,
  RECOGNITION_MAX_TOKENS,
  SHEET_RECOGNITION_MAX_TOKENS,
  coerceClassification,
  coerceQuickEstimate,
  quickScanFields,
  sheetDetectionFrom,
  type Candidate,
} from './domain.ts';

function candidate(confidence: number, label = 'Cérès 20c noir'): Candidate {
  return { id: `c-${label}-${confidence}`, domain: 'stamp', label, confidence, attributes: {} };
}

describe('coerceQuickEstimate', () => {
  it('accepte une fourchette en euros et l’arrondit au centime', () => {
    expect(coerceQuickEstimate({ low: 12.345, high: 30 })).toEqual({ low: 12.35, high: 30, currency: 'EUR' });
    expect(coerceQuickEstimate({ low: 5, high: 8, currency: 'eur' })).toEqual({ low: 5, high: 8, currency: 'EUR' });
  });

  it('remet dans l’ordre des bornes inversées', () => {
    expect(coerceQuickEstimate({ low: 80, high: 40 })).toEqual({ low: 40, high: 80, currency: 'EUR' });
  });

  it('accepte les formes tableau, min/max et les nombres en texte à la française', () => {
    expect(coerceQuickEstimate([10, 20])).toEqual({ low: 10, high: 20, currency: 'EUR' });
    expect(coerceQuickEstimate({ min: '1,5', max: '3 €' })).toEqual({ low: 1.5, high: 3, currency: 'EUR' });
  });

  it('écarte les valeurs non numériques, négatives ou nulles', () => {
    expect(coerceQuickEstimate(undefined)).toBeUndefined();
    expect(coerceQuickEstimate('20 à 30 €')).toBeUndefined();
    expect(coerceQuickEstimate({ low: 'beaucoup', high: 10 })).toBeUndefined();
    expect(coerceQuickEstimate({ low: -5, high: 10 })).toBeUndefined();
    expect(coerceQuickEstimate({ low: 0, high: 0 })).toBeUndefined();
    expect(coerceQuickEstimate({ low: Number.NaN, high: 10 })).toBeUndefined();
  });

  it('écarte une autre devise (aucune conversion silencieuse)', () => {
    expect(coerceQuickEstimate({ low: 10, high: 20, currency: 'USD' })).toBeUndefined();
  });

  it('écarte les valeurs aberrantes au-delà du plafond du domaine', () => {
    expect(coerceQuickEstimate({ low: 10, high: 2_000_000 }, { maxEur: 1_000_000 })).toBeUndefined();
    expect(coerceQuickEstimate({ low: 10, high: 900 }, { maxEur: 1_000_000 })).toEqual({
      low: 10,
      high: 900,
      currency: 'EUR',
    });
  });

  it('écarte une fourchette trop large pour informer', () => {
    expect(coerceQuickEstimate({ low: 1, high: 500 })).toBeUndefined();
    // Borne basse nulle : « jusqu’à 2 € » reste informatif.
    expect(coerceQuickEstimate({ low: 0, high: 2 })).toEqual({ low: 0, high: 2, currency: 'EUR' });
  });

  it('applique aussi la règle d’écart quand la borne basse est nulle (plancher à 1 €)', () => {
    // « 0 – 900 000 € » n'informe pas : écartée comme toute fourchette trop large.
    expect(coerceQuickEstimate({ low: 0, high: 900_000 })).toBeUndefined();
    expect(coerceQuickEstimate({ low: 0, high: 2000 })).toBeUndefined();
    expect(coerceQuickEstimate({ low: 0, high: 100 })).toEqual({ low: 0, high: 100, currency: 'EUR' });
    // Borne basse positive : comportement inchangé (rapport haut / bas).
    expect(coerceQuickEstimate({ low: 0.05, high: 8 })).toBeUndefined();
    expect(coerceQuickEstimate({ low: 0.3, high: 12 })).toEqual({ low: 0.3, high: 12, currency: 'EUR' });
  });

  it('n’invente pas de montant à partir d’un texte ambigu', () => {
    // Séparateurs de milliers : « 1,200 » vaut 1,2 en français et 1 200 en anglais → écarté.
    expect(coerceQuickEstimate({ low: '1,200', high: '2,500' })).toBeUndefined();
    expect(coerceQuickEstimate({ low: '1.200 €', high: '1.500 €' })).toBeUndefined();
    expect(coerceQuickEstimate({ low: '1 200', high: '2 500' })).toEqual({ low: 1200, high: 2500, currency: 'EUR' });
    // Hexadécimal, notation scientifique : jamais lus comme des montants.
    expect(coerceQuickEstimate({ low: '0x10', high: '0x20' })).toBeUndefined();
    expect(coerceQuickEstimate({ low: '1e3', high: 2000 })).toBeUndefined();
    // Décimales ordinaires : toujours acceptées.
    expect(coerceQuickEstimate({ low: '12.50', high: '30,5 €' })).toEqual({ low: 12.5, high: 30.5, currency: 'EUR' });
  });

  it('refait le contrôle « haut nul » APRÈS l’arrondi au centime', () => {
    expect(coerceQuickEstimate({ low: 0.001, high: 0.004 })).toBeUndefined();
    expect(coerceQuickEstimate({ low: 0.001, high: 0.5 })).toEqual({ low: 0, high: 0.5, currency: 'EUR' });
  });
});

describe('coerceClassification', () => {
  it('nettoie, déduplique les niveaux consécutifs et tronque', () => {
    expect(coerceClassification(['  France ', 'france', 'Cérès', '', 42, null, '1849–1850'])).toEqual([
      'France',
      'Cérès',
      '42',
      '1849–1850',
    ]);
    const many = Array.from({ length: 9 }, (_, i) => `niveau ${i}`);
    expect(coerceClassification(many)).toHaveLength(CLASSIFICATION_MAX_LEVELS);
  });

  it('découpe une chaîne « A > B > C »', () => {
    expect(coerceClassification('Vin > Bordeaux › Pauillac')).toEqual(['Vin', 'Bordeaux', 'Pauillac']);
  });

  it('renvoie undefined si rien n’est exploitable', () => {
    expect(coerceClassification(undefined)).toBeUndefined();
    expect(coerceClassification([' ', '  '])).toBeUndefined();
    expect(coerceClassification(['x'.repeat(200)])).toBeUndefined();
  });
});

describe('quickScanFields', () => {
  it('conserve fourchette et classement d’une identification fiable', () => {
    expect(
      quickScanFields({ estimate: { low: 40, high: 90 }, classification: ['France', 'Cérès'] }, 0.8),
    ).toEqual({ quickEstimate: { low: 40, high: 90, currency: 'EUR' }, classification: ['France', 'Cérès'] });
    expect(quickScanFields({ quickEstimate: [1, 2] }, 0.9)).toEqual({
      quickEstimate: { low: 1, high: 2, currency: 'EUR' },
    });
  });

  it('ne montre aucun prix pour une identification trop incertaine', () => {
    const fields = quickScanFields(
      { estimate: { low: 40, high: 90 }, classification: ['France'] },
      ASSISTED_ENTRY_THRESHOLD - 0.01,
    );
    expect(fields.quickEstimate).toBeUndefined();
    expect(fields.classification).toEqual(['France']);
  });

  it('n’ajoute aucune clé quand le modèle ne fournit rien', () => {
    expect(quickScanFields({}, 0.9)).toEqual({});
  });
});

describe('sheetDetectionFrom', () => {
  it('trie, garde 3 candidats et normalise la position', () => {
    const detection = sheetDetectionFrom(
      2,
      [candidate(0.2, 'a'), candidate(0.9, 'b'), candidate(0.5, 'c'), candidate(0.4, 'd')],
      '  rangée 1, case 3  ',
    );
    expect(detection.index).toBe(2);
    expect(detection.position).toBe('rangée 1, case 3');
    expect(detection.candidates.map((c) => c.confidence)).toEqual([0.9, 0.5, 0.4]);
    expect(detection.needsAssistedEntry).toBe(false);
  });

  it('bascule en saisie assistée sans candidat ou sous le seuil', () => {
    expect(sheetDetectionFrom(0, []).needsAssistedEntry).toBe(true);
    expect(sheetDetectionFrom(0, [candidate(0.3)]).needsAssistedEntry).toBe(true);
    expect('position' in sheetDetectionFrom(0, [], '   ')).toBe(false);
  });
});

describe('budgets de sortie', () => {
  it('reste compact pour un objet et borné pour une planche', () => {
    expect(RECOGNITION_MAX_TOKENS).toBeLessThan(1024);
    // Planche : 24 objets × 1 candidat compact (~95 tokens) ≈ 2 300 tokens ; le
    // budget garde une marge d'au moins 50 % contre la troncature.
    expect(SHEET_RECOGNITION_MAX_TOKENS).toBeGreaterThanOrEqual(MAX_SHEET_DETECTIONS * 95 * 1.5);
    expect(QUICK_SCAN_OUTPUT_RULES).toContain('"estimate"');
    expect(QUICK_SCAN_OUTPUT_RULES).toContain('"classification"');
  });
});
