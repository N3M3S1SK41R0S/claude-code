import { beforeEach, describe, expect, it } from 'vitest';
import { isVelumError } from '@velum/core';

import { createCalibrationRepo, rowToCalibrationRun } from './calibration';
import { asSupabase, FakeSupabase } from './testing/fake-supabase';

describe('calibration repo', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['calibration_runs'] = [
      {
        domain: 'wine',
        n: 12,
        coverage80: 0.7,
        coverage95: 0.9,
        status: 'calibrating',
        computed_at: '2026-07-01T00:00:00Z',
      },
      {
        domain: 'wine',
        n: '42',
        coverage80: '0.81',
        coverage95: '0.95',
        status: 'well_calibrated',
        computed_at: '2026-07-15T00:00:00Z',
      },
      {
        domain: 'coin',
        n: 31,
        coverage80: 0.6,
        coverage95: 0.82,
        status: 'overconfident',
        computed_at: '2026-07-14T00:00:00Z',
      },
    ];
  });

  it('retourne le dernier run du domaine et coerce les numeric PostgREST', async () => {
    const run = await createCalibrationRepo(asSupabase(fake)).latest('wine');
    expect(run).toEqual({
      domain: 'wine',
      n: 42,
      coverage80: 0.81,
      coverage95: 0.95,
      status: 'well_calibrated',
      computedAt: '2026-07-15T00:00:00Z',
    });
  });

  it('retourne null avant le premier run publié', async () => {
    await expect(createCalibrationRepo(asSupabase(fake)).latest('stamp')).resolves.toBeNull();
  });

  it('rend une panne PostgREST visible', async () => {
    fake.offline = true;
    await expect(createCalibrationRepo(asSupabase(fake)).latest('art')).rejects.toSatisfy(
      (cause: unknown) => isVelumError(cause) && cause.code === 'SOURCE_UNAVAILABLE',
    );
  });

  it('refuse les couvertures, dates et statuts malformés', () => {
    const base = {
      domain: 'wine',
      n: 30,
      coverage80: 0.8,
      coverage95: 0.95,
      status: 'well_calibrated',
      computed_at: '2026-07-15T00:00:00Z',
    };

    expect(() => rowToCalibrationRun({ ...base, coverage80: 1.2 })).toThrow();
    expect(() => rowToCalibrationRun({ ...base, status: 'excellent' })).toThrow();
    expect(() => rowToCalibrationRun({ ...base, computed_at: 'demain' })).toThrow();
    expect(() => rowToCalibrationRun({ ...base, n: 3.5 })).toThrow();
  });
});
