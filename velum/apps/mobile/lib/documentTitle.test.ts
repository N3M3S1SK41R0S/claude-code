import { describe, expect, it } from 'vitest';
import { documentTitleFor } from './documentTitle';

describe('documentTitleFor', () => {
  it('mappe les routes connues, suffixe « — VELUM »', () => {
    expect(documentTitleFor('/carnet')).toBe('Mon carnet — VELUM');
    expect(documentTitleFor('/collection')).toBe('Ma collection — VELUM');
    expect(documentTitleFor('/privacy')).toBe('Confidentialité — VELUM');
    expect(documentTitleFor('/community')).toBe('Communauté — VELUM');
    expect(documentTitleFor('/blind-tasting')).toBe('Dégustation à l’aveugle — VELUM');
    expect(documentTitleFor('/event-sommelier')).toBe('Sommelier d’événement — VELUM');
  });

  it('gère les routes dynamiques par préfixe', () => {
    expect(documentTitleFor('/item/demo-wine')).toBe('Fiche — VELUM');
    expect(documentTitleFor('/capture/wine')).toBe('Capturer — VELUM');
    expect(documentTitleFor('/arbiter/demo-wine')).toBe('Arbitre patrimonial — VELUM');
  });

  it('jamais vide : repli sur le titre de base', () => {
    expect(documentTitleFor('/')).toContain('VELUM');
    expect(documentTitleFor('/inconnu')).toContain('VELUM');
    expect(documentTitleFor('/').length).toBeGreaterThan(0);
  });
});
