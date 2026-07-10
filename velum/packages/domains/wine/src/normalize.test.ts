import { describe, expect, it } from 'vitest';
import { normalizeWineLabel, parseVintage } from './normalize';

const NOW = new Date('2026-07-10T00:00:00Z');

describe('normalizeWineLabel', () => {
  it('passe en minuscules, retire accents, ponctuation et mots vides', () => {
    expect(normalizeWineLabel('Grand Vin de Bordeaux — Château Margaux 2015')).toBe(
      'grand vin bordeaux chateau margaux 2015',
    );
  });

  it('gère les apostrophes et les articles élidés', () => {
    expect(normalizeWineLabel("Domaine de l'Ermite, Cuvée du Père")).toBe(
      'domaine ermite cuvee pere',
    );
  });

  it('renvoie une chaîne vide pour une entrée composée uniquement de mots vides', () => {
    expect(normalizeWineLabel('de la des du')).toBe('');
  });
});

describe('parseVintage', () => {
  it('extrait un millésime plausible d’un texte flou', () => {
    expect(parseVintage('grand vin de Bordeaux bio 2019', NOW)).toBe(2019);
  });

  it('accepte l’année courante + 1 (primeurs)', () => {
    expect(parseVintage('en primeur 2027', NOW)).toBe(2027);
  });

  it('rejette les années hors bornes [1900, année courante + 1]', () => {
    expect(parseVintage('Cuvée 1899', NOW)).toBeNull();
    expect(parseVintage('futur 2031', NOW)).toBeNull();
  });

  it('ignore les nombres qui ne sont pas des années isolées', () => {
    expect(parseVintage('75012 Paris', NOW)).toBeNull();
  });

  it('renvoie null sans année', () => {
    expect(parseVintage('vin rouge sans étiquette', NOW)).toBeNull();
  });
});
