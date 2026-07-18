import { describe, expect, it } from 'vitest';
import { documentTitleFor, documentTitleLocale } from './documentTitle';

describe('documentTitleLocale', () => {
  it('normalise les variantes anglaises et replie les autres langues sur le français', () => {
    expect(documentTitleLocale('en')).toBe('en');
    expect(documentTitleLocale('en-US')).toBe('en');
    expect(documentTitleLocale('FR-fr')).toBe('fr');
    expect(documentTitleLocale(undefined)).toBe('fr');
  });
});

describe('documentTitleFor', () => {
  it('mappe les routes françaises connues, suffixe « — VELUM »', () => {
    expect(documentTitleFor('/carnet')).toBe('Mon carnet — VELUM');
    expect(documentTitleFor('/collection')).toBe('Ma collection — VELUM');
    expect(documentTitleFor('/privacy')).toBe('Confidentialité — VELUM');
    expect(documentTitleFor('/community')).toBe('Communauté — VELUM');
    expect(documentTitleFor('/blind-tasting')).toBe('Dégustation à l’aveugle — VELUM');
    expect(documentTitleFor('/event-sommelier')).toBe('Sommelier d’événement — VELUM');
  });

  it('gère les routes dynamiques par préfixe en français', () => {
    expect(documentTitleFor('/item/demo-wine')).toBe('Fiche — VELUM');
    expect(documentTitleFor('/capture/wine')).toBe('Capturer — VELUM');
    expect(documentTitleFor('/arbiter/demo-wine')).toBe('Arbitre patrimonial — VELUM');
  });

  it('rend les mêmes routes en anglais', () => {
    expect(documentTitleFor('/profile', 'en')).toBe('Profile — VELUM');
    expect(documentTitleFor('/blind-tasting', 'en-GB')).toBe('Blind tasting — VELUM');
    expect(documentTitleFor('/item/demo-watch', 'en')).toBe('Object sheet — VELUM');
    expect(documentTitleFor('/arbiter/demo-watch', 'en')).toBe('Collection arbiter — VELUM');
  });

  it('reste non vide et localisé pour une route inconnue', () => {
    expect(documentTitleFor('/')).toBe('VELUM — analyse & valorisation');
    expect(documentTitleFor('/inconnu', 'en')).toBe('VELUM — analysis & valuation');
  });
});
