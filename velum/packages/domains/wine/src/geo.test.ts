import { describe, expect, it } from 'vitest';
import {
  FRANCE_BBOX,
  FRANCE_OUTLINE,
  WORLD_BBOX,
  bboxAspect,
  normalizePlace,
  projectNorm,
  resolveWineOrigin,
} from './geo.ts';

describe('normalizePlace', () => {
  it('retire accents, ponctuation, casse', () => {
    expect(normalizePlace('Saint-Émilion')).toBe('saint emilion');
    expect(normalizePlace('  CÔTES du Rhône ')).toBe('cotes du rhone');
  });
});

describe('resolveWineOrigin', () => {
  it('appellation française → scope france', () => {
    const o = resolveWineOrigin({ appellation: 'Pauillac', country: 'France' });
    expect(o?.scope).toBe('france');
    expect(o?.matched).toBe('pauillac');
    expect(o?.lat).toBeCloseTo(45.2, 1);
  });

  it('appellation dans une phrase (« Appellation Margaux Contrôlée »)', () => {
    const o = resolveWineOrigin({ appellation: 'Appellation Margaux Contrôlée' });
    expect(o?.matched).toBe('margaux');
    expect(o?.scope).toBe('france');
  });

  it('préfère l’appellation (plus spécifique) à la région', () => {
    const o = resolveWineOrigin({ appellation: 'Saint-Émilion', region: 'Bordeaux' });
    expect(o?.matched).toBe('saint emilion');
  });

  it('vin étranger → scope world avec libellé pays', () => {
    const o = resolveWineOrigin({ region: 'Rioja', country: 'Espagne' });
    expect(o?.scope).toBe('world');
    expect(o?.label).toMatch(/Espagne/);
  });

  it('Barolo/Piémont Italie → monde', () => {
    const o = resolveWineOrigin({ appellation: 'Piémont', country: 'Italie' });
    expect(o?.scope).toBe('world');
    expect(o?.lng).toBeGreaterThan(0);
  });

  it('France sans région reconnue → centre France', () => {
    const o = resolveWineOrigin({ country: 'France', region: 'Zone inconnue' });
    expect(o?.scope).toBe('france');
    expect(o?.matched).toBe('france');
  });

  it('rien de reconnu → null (jamais de localisation inventée)', () => {
    expect(resolveWineOrigin({ region: 'Nulle part' })).toBeNull();
    expect(resolveWineOrigin({})).toBeNull();
  });
});

describe('projectNorm', () => {
  it('coin sud-ouest de la boîte → (0, 1)', () => {
    const p = projectNorm(FRANCE_BBOX.minLat, FRANCE_BBOX.minLng, FRANCE_BBOX);
    expect(p.nx).toBeCloseTo(0, 5);
    expect(p.ny).toBeCloseTo(1, 5);
  });

  it('coin nord-est de la boîte → (1, 0)', () => {
    const p = projectNorm(FRANCE_BBOX.maxLat, FRANCE_BBOX.maxLng, FRANCE_BBOX);
    expect(p.nx).toBeCloseTo(1, 5);
    expect(p.ny).toBeCloseTo(0, 5);
  });

  it('hors-boîte → clampé dans [0,1]', () => {
    const p = projectNorm(90, 200, WORLD_BBOX);
    expect(p.nx).toBeGreaterThanOrEqual(0);
    expect(p.nx).toBeLessThanOrEqual(1);
    expect(p.ny).toBeGreaterThanOrEqual(0);
  });

  it('Paris tombe dans le quadrant nord de la France', () => {
    const p = projectNorm(48.85, 2.35, FRANCE_BBOX);
    expect(p.ny).toBeLessThan(0.5); // nord = haut
    expect(p.nx).toBeGreaterThan(0.3);
    expect(p.nx).toBeLessThan(0.75);
  });
});

describe('bboxAspect & outline', () => {
  it('la France est à peu près carrée (aspect ~1, méridiens corrigés)', () => {
    // ~1000 km × 1000 km → ratio proche de 1 après correction cos(latitude).
    expect(bboxAspect(FRANCE_BBOX)).toBeGreaterThan(0.85);
    expect(bboxAspect(FRANCE_BBOX)).toBeLessThan(1.3);
  });
  it('le contour France est fermé (premier = dernier point)', () => {
    expect(FRANCE_OUTLINE[0]).toEqual(FRANCE_OUTLINE[FRANCE_OUTLINE.length - 1]);
  });
});
