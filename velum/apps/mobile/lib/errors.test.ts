import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { VelumError } from '@velum/core';
import { businessRefusalReason, errorMessage } from './errors';

const t = ((key: string) => `[${key}]`) as unknown as TFunction;

describe('errorMessage', () => {
  it('traduit les codes connus, y compris PLAN_REQUIRED', () => {
    expect(errorMessage(new VelumError('PLAN_REQUIRED', 'x'), t)).toBe('[errors.PLAN_REQUIRED]');
    expect(errorMessage(new Error('boom'), t)).toBe('[errors.generic]');
  });

  it('ajoute le motif d’un refus métier serveur (P0001), sans le contexte technique', () => {
    const refusal = new VelumError('INVALID_INPUT', 'Achat impossible : Annonce déjà réservée par un autre membre', {
      sqlstate: 'P0001',
    });
    expect(businessRefusalReason(refusal)).toBe('Annonce déjà réservée par un autre membre');
    expect(errorMessage(refusal, t)).toBe('[errors.INVALID_INPUT] — Annonce déjà réservée par un autre membre');
  });

  it('ne détaille jamais une erreur de contrainte ou technique', () => {
    const constraint = new VelumError('INVALID_INPUT', 'Achat impossible : violates check constraint "x"', {
      sqlstate: '23514',
    });
    expect(businessRefusalReason(constraint)).toBeNull();
    expect(errorMessage(constraint, t)).toBe('[errors.INVALID_INPUT]');
    expect(businessRefusalReason(new VelumError('SOURCE_UNAVAILABLE', 'a : b', { sqlstate: 'P0001' }))).toBeNull();
  });
});
