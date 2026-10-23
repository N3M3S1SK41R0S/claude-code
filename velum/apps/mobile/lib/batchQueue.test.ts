import { describe, expect, it } from 'vitest';
import type { Candidate, SheetDetection } from '@velum/core';

import {
  BATCH_CONCURRENCY,
  EMPTY_BATCH,
  RELIABLE_CONFIDENCE,
  batchReducer,
  batchSummary,
  displayOrder,
  effectiveCandidate,
  isBinderFirst,
  isReliable,
  nextToRun,
  photosInUse,
  reliableRows,
  statusForCandidates,
  supportsSheet,
  unsavedCount,
  type BatchAction,
  type BatchState,
} from './batchQueue';

function candidate(label: string, confidence: number, extra: Partial<Candidate> = {}): Candidate {
  return { id: `c-${label}`, domain: 'stamp', label, confidence, attributes: {}, ...extra };
}

function run(actions: BatchAction[], from: BatchState = EMPTY_BATCH): BatchState {
  return actions.reduce(batchReducer, from);
}

function shot(id: string): BatchAction {
  return {
    type: 'enqueue',
    id,
    source: 'shot',
    thumbnailUri: `file://${id}.jpg`,
    media: [{ role: 'front', base64: `data:${id}` }],
  };
}

function row(state: BatchState, id: string) {
  const found = state.rows.find((r) => r.id === id);
  if (!found) throw new Error(`ligne ${id} absente`);
  return found;
}

describe('domaines du mode classeur', () => {
  it('planche pour timbres et pièces seulement, mis en avant pour eux', () => {
    expect(supportsSheet('stamp')).toBe(true);
    expect(supportsSheet('coin')).toBe(true);
    expect(supportsSheet('wine')).toBe(false);
    expect(isBinderFirst('stamp')).toBe(true);
    expect(isBinderFirst('art')).toBe(false);
  });
});

describe('batchReducer — série', () => {
  it('enfile les prises dans l’ordre, sans doublon', () => {
    const state = run([shot('a'), shot('b'), shot('a')]);
    expect(state.rows.map((r) => [r.id, r.seq, r.status])).toEqual([
      ['a', 0, 'pending'],
      ['b', 1, 'pending'],
    ]);
    expect(state.nextSeq).toBe(2);
  });

  it('pending → running → identified, tri et top 3 des candidats', () => {
    const state = run([
      shot('a'),
      { type: 'uploaded', photo: 'data:a', storagePath: 'u/a.jpg' },
      { type: 'start', id: 'a' },
      {
        type: 'recognized',
        id: 'a',
        candidates: [candidate('x', 0.2), candidate('y', 0.9), candidate('z', 0.5), candidate('w', 0.4)],
      },
    ]);
    const a = row(state, 'a');
    expect(a.status).toBe('identified');
    expect(a.attempts).toBe(1);
    expect(a.candidates.map((c) => c.label)).toEqual(['y', 'z', 'w']);
    expect(a.media).toEqual([{ role: 'front', base64: 'data:a', storagePath: 'u/a.jpg' }]);
    expect(effectiveCandidate(a)?.label).toBe('y');
  });

  it('meilleure confiance < 0,35 ou aucun candidat → incertain', () => {
    expect(statusForCandidates([candidate('x', 0.34)])).toBe('uncertain');
    expect(statusForCandidates([])).toBe('uncertain');
    expect(statusForCandidates([candidate('x', 0.35)])).toBe('identified');
  });

  it('échec réessayable : failed → retry → pending, l’erreur est effacée', () => {
    let state = run([shot('a'), { type: 'start', id: 'a' }, { type: 'failed', id: 'a', errorCode: 'RATE_LIMITED' }]);
    expect(row(state, 'a')).toMatchObject({ status: 'failed', errorCode: 'RATE_LIMITED' });
    state = batchReducer(state, { type: 'retry', id: 'a' });
    expect(row(state, 'a').status).toBe('pending');
    expect(row(state, 'a').errorCode).toBeUndefined();
    state = run([{ type: 'start', id: 'a' }], state);
    expect(row(state, 'a').attempts).toBe(2);
  });

  it('ignore les transitions invalides (état inchangé, même référence)', () => {
    const state = run([shot('a')]);
    expect(batchReducer(state, { type: 'recognized', id: 'a', candidates: [] })).toBe(state);
    expect(batchReducer(state, { type: 'saving', id: 'a' })).toBe(state);
    expect(batchReducer(state, { type: 'retry', id: 'a' })).toBe(state);
    expect(batchReducer(state, { type: 'start', id: 'inconnu' })).toBe(state);
  });

  it('choix d’un autre candidat, correction prioritaire et ligne incertaine validée', () => {
    let state = run([
      shot('a'),
      { type: 'start', id: 'a' },
      { type: 'recognized', id: 'a', candidates: [candidate('x', 0.3), candidate('y', 0.2)] },
    ]);
    expect(row(state, 'a').status).toBe('uncertain');
    state = batchReducer(state, { type: 'choose', id: 'a', index: 1 });
    expect(effectiveCandidate(row(state, 'a'))?.label).toBe('y');
    expect(batchReducer(state, { type: 'choose', id: 'a', index: 5 })).toBe(state);

    state = batchReducer(state, { type: 'edit', id: 'a', candidate: candidate('corrigé', 0.3) });
    expect(row(state, 'a').status).toBe('identified');
    expect(effectiveCandidate(row(state, 'a'))?.label).toBe('corrigé');
    // Choisir à nouveau un candidat abandonne la correction.
    state = batchReducer(state, { type: 'choose', id: 'a', index: 0 });
    expect(row(state, 'a').edited).toBeUndefined();
  });

  it('ignorer puis rétablir une ligne', () => {
    let state = run([shot('a'), { type: 'start', id: 'a' }, { type: 'recognized', id: 'a', candidates: [candidate('x', 0.8)] }]);
    state = batchReducer(state, { type: 'skip', id: 'a' });
    expect(row(state, 'a').status).toBe('skipped');
    state = batchReducer(state, { type: 'restore', id: 'a' });
    expect(row(state, 'a').status).toBe('identified');
  });

  it('enregistrement : saving → saved, ou retour avec l’erreur', () => {
    const base = run([shot('a'), { type: 'start', id: 'a' }, { type: 'recognized', id: 'a', candidates: [candidate('x', 0.8)] }]);
    const saving = batchReducer(base, { type: 'saving', id: 'a' });
    expect(row(saving, 'a').status).toBe('saving');
    const saved = batchReducer(saving, { type: 'saved', id: 'a', itemId: 'item-1' });
    expect(row(saved, 'a')).toMatchObject({ status: 'saved', itemId: 'item-1' });
    const failed = batchReducer(saving, { type: 'saveFailed', id: 'a', errorCode: 'SOURCE_UNAVAILABLE' });
    expect(row(failed, 'a')).toMatchObject({ status: 'identified', errorCode: 'SOURCE_UNAVAILABLE' });
    // Une ligne sans candidat ne peut pas être enregistrée.
    const empty = run([shot('b'), { type: 'start', id: 'b' }, { type: 'recognized', id: 'b', candidates: [] }]);
    expect(batchReducer(empty, { type: 'saving', id: 'b' })).toBe(empty);
  });

  it('on ne retire pas une ligne en cours', () => {
    const state = run([shot('a'), { type: 'start', id: 'a' }]);
    expect(batchReducer(state, { type: 'remove', id: 'a' })).toBe(state);
    const done = run([{ type: 'failed', id: 'a', errorCode: 'X' }], state);
    expect(batchReducer(done, { type: 'remove', id: 'a' }).rows).toEqual([]);
  });
});

describe('batchReducer — planche', () => {
  const detections: SheetDetection[] = [
    { index: 0, position: 'case 1', candidates: [candidate('Semeuse', 0.8)], needsAssistedEntry: false },
    { index: 1, candidates: [], needsAssistedEntry: true },
    { index: 2, position: 'case 3', candidates: [candidate('Gandon', 0.5)], needsAssistedEntry: false },
  ];

  it('remplace la photo de planche par une ligne par objet, à sa place', () => {
    const state = run([
      shot('avant'),
      { type: 'enqueue', id: 'p', source: 'sheet', thumbnailUri: 'file://p.jpg', media: [{ role: 'front', base64: 'data:p' }] },
      shot('après'),
      { type: 'start', id: 'p' },
      { type: 'sheetRecognized', id: 'p', detections, truncated: true },
      // Téléversement terminé APRÈS la reconnaissance : chaque objet reçoit le chemin.
      { type: 'uploaded', photo: 'data:p', storagePath: 'u/p.jpg' },
    ]);
    expect(state.rows.map((r) => r.id)).toEqual(['avant', 'p-0', 'p-1', 'p-2', 'après']);
    const first = row(state, 'p-0');
    expect(first).toMatchObject({ source: 'detection', status: 'identified', position: 'case 1', thumbnailUri: 'file://p.jpg' });
    expect(first.media).toEqual([{ role: 'detail', base64: 'data:p', storagePath: 'u/p.jpg' }]);
    expect(row(state, 'p-2').media[0]?.storagePath).toBe('u/p.jpg');
    expect(row(state, 'avant').media[0]?.storagePath).toBeUndefined();
    // Un chemin déjà connu ne recrée pas l'état.
    expect(batchReducer(state, { type: 'uploaded', photo: 'data:p', storagePath: 'u/p.jpg' })).toBe(state);
    expect(row(state, 'p-1').status).toBe('uncertain');
    expect(state.truncatedSheets).toEqual(['p']);
    // Les objets détectés ne se « réessaient » pas un par un.
    const failedDetection = batchReducer(state, { type: 'skip', id: 'p-1' });
    expect(batchReducer(failedDetection, { type: 'retry', id: 'p-1' })).toBe(failedDetection);
  });

  it('planche sans objet détecté → échec réessayable', () => {
    const state = run([
      { type: 'enqueue', id: 'p', source: 'sheet', media: [{ role: 'detail' }] },
      { type: 'start', id: 'p' },
      { type: 'sheetRecognized', id: 'p', detections: [], truncated: false },
    ]);
    expect(row(state, 'p')).toMatchObject({ status: 'failed', errorCode: 'NO_DETECTION' });
    expect(row(batchReducer(state, { type: 'retry', id: 'p' }), 'p').status).toBe('pending');
  });

  it('une ligne de planche ne reçoit pas de candidats « objet seul »', () => {
    const state = run([{ type: 'enqueue', id: 'p', source: 'sheet', media: [] }, { type: 'start', id: 'p' }]);
    expect(batchReducer(state, { type: 'recognized', id: 'p', candidates: [candidate('x', 0.9)] })).toBe(state);
  });
});

describe('ordre d’affichage et lignes restantes', () => {
  it('prise la plus récente en haut, objets d’une planche dans l’ordre de lecture', () => {
    const detections: SheetDetection[] = [0, 1, 2].map((index) => ({
      index,
      candidates: [candidate(`t${index}`, 0.8)],
      needsAssistedEntry: false,
    }));
    const state = run([
      shot('a'),
      { type: 'enqueue', id: 'p', source: 'sheet', media: [{ role: 'detail', base64: 'data:p' }] },
      shot('b'),
      { type: 'start', id: 'p' },
      { type: 'sheetRecognized', id: 'p', detections, truncated: false },
    ]);
    expect(displayOrder(state).map((r) => r.id)).toEqual(['b', 'p-0', 'p-1', 'p-2', 'a']);
    expect(row(state, 'p-1').groupId).toBe('p');
  });

  it('une ligne enregistrée libère sa photo ; une photo de planche reste tant qu’un objet en dépend', () => {
    const detections: SheetDetection[] = [0, 1].map((index) => ({
      index,
      candidates: [candidate(`t${index}`, 0.8)],
      needsAssistedEntry: false,
    }));
    let state = run([
      shot('a'),
      { type: 'start', id: 'a' },
      { type: 'recognized', id: 'a', candidates: [candidate('x', 0.9)] },
      { type: 'enqueue', id: 'p', source: 'sheet', media: [{ role: 'detail', base64: 'data:p' }] },
      { type: 'start', id: 'p' },
      { type: 'sheetRecognized', id: 'p', detections, truncated: false },
    ]);
    expect([...photosInUse(state)].sort()).toEqual(['data:a', 'data:p']);
    state = run(
      [
        { type: 'saving', id: 'a' },
        { type: 'saved', id: 'a', itemId: 'i-a' },
        { type: 'saving', id: 'p-0' },
        { type: 'saved', id: 'p-0', itemId: 'i-p0' },
      ],
      state,
    );
    expect(row(state, 'a').media).toEqual([{ role: 'front' }]);
    expect([...photosInUse(state)]).toEqual(['data:p']);
    state = run([{ type: 'skip', id: 'p-1' }, { type: 'remove', id: 'p-1' }], state);
    expect(photosInUse(state).size).toBe(0);
  });

  it('compte ce qui serait perdu en quittant (ni enregistré, ni ignoré)', () => {
    let state = run([
      shot('a'),
      shot('b'),
      shot('c'),
      { type: 'start', id: 'a' },
      { type: 'recognized', id: 'a', candidates: [candidate('x', 0.9)] },
      { type: 'start', id: 'b' },
      { type: 'failed', id: 'b', errorCode: 'X' },
    ]);
    expect(unsavedCount(state)).toBe(3);
    state = run(
      [
        { type: 'saving', id: 'a' },
        { type: 'saved', id: 'a', itemId: 'i' },
        { type: 'skip', id: 'b' },
      ],
      state,
    );
    expect(unsavedCount(state)).toBe(1);
  });
});

describe('nextToRun — concurrence bornée', () => {
  it(`démarre au plus ${BATCH_CONCURRENCY} reconnaissances, les plus anciennes d’abord`, () => {
    let state = run([shot('a'), shot('b'), shot('c'), shot('d')]);
    expect(nextToRun(state)).toEqual(['a', 'b']);
    state = run([{ type: 'start', id: 'a' }], state);
    expect(nextToRun(state)).toEqual(['b']);
    // Un démarrage déjà lancé mais pas encore dans l'état compte aussi.
    expect(nextToRun(state, 2, new Set(['b']))).toEqual([]);
    state = run([{ type: 'start', id: 'b' }], state);
    expect(nextToRun(state)).toEqual([]);
    state = run([{ type: 'failed', id: 'a', errorCode: 'X' }], state);
    expect(nextToRun(state)).toEqual(['c']);
    expect(nextToRun(state, 0)).toEqual([]);
  });
});

describe('lignes fiables et synthèse', () => {
  const state = run([
    shot('sûr'),
    shot('moyen'),
    shot('flou'),
    shot('corrigé'),
    shot('attente'),
    ...(['sûr', 'moyen', 'flou', 'corrigé'].map((id) => ({ type: 'start', id }) as BatchAction)),
    {
      type: 'recognized',
      id: 'sûr',
      candidates: [candidate('A', 0.9, { quickEstimate: { low: 10, high: 20, currency: 'EUR' } })],
    },
    {
      type: 'recognized',
      id: 'moyen',
      candidates: [candidate('B', 0.5, { quickEstimate: { low: 1.5, high: 3, currency: 'EUR' } })],
    },
    { type: 'recognized', id: 'flou', candidates: [candidate('C', 0.1)] },
    { type: 'recognized', id: 'corrigé', candidates: [candidate('D', 0.4)] },
    { type: 'edit', id: 'corrigé', candidate: candidate('D corrigé', 0.4) },
  ]);

  it(`« Tout enregistrer » : confiance ≥ ${RELIABLE_CONFIDENCE} ou ligne corrigée`, () => {
    expect(reliableRows(state).map((r) => r.id)).toEqual(['sûr', 'corrigé']);
    expect(isReliable(row(state, 'moyen'))).toBe(false);
    expect(isReliable(row(state, 'moyen'), 0.5)).toBe(true);
    const skipped = batchReducer(state, { type: 'skip', id: 'sûr' });
    expect(reliableRows(skipped).map((r) => r.id)).toEqual(['corrigé']);
  });

  it('compteurs, valeur indicative cumulée et activité', () => {
    const summary = batchSummary(state);
    expect(summary).toMatchObject({
      total: 5,
      waiting: 1,
      identified: 3,
      uncertain: 1,
      failed: 0,
      reliable: 2,
      busy: true,
    });
    expect(summary.indicativeTotal).toEqual({ low: 11.5, high: 23, currency: 'EUR' });
    expect(batchSummary(EMPTY_BATCH)).toMatchObject({ total: 0, busy: false, indicativeTotal: null });
  });
});
