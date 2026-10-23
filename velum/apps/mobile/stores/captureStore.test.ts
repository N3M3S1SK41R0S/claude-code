/**
 * Brouillon de capture : le scan éclair n'envoie jamais à la reconnaissance
 * (ni ne rattache à l'objet) les clichés d'une capture précédente.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { useCaptureStore, type DraftMedia } from './captureStore';

function shot(role: DraftMedia['role'], name: string): DraftMedia {
  return { role, base64: `data:${name}`, uri: `file://${name}.jpg` };
}

describe('captureStore — clichés du brouillon', () => {
  beforeEach(() => {
    useCaptureStore.getState().setDomain('wine');
  });

  it('replaceMedia remplace TOUS les clichés (scan éclair : une photo = un objet)', () => {
    const store = useCaptureStore.getState();
    // Saisie complète abandonnée : étiquette et capsule de la bouteille A.
    store.addMedia(shot('label', 'etiquette-A'));
    store.addMedia(shot('capsule', 'capsule-A'));
    // Scan éclair de la bouteille B : seule sa photo reste.
    useCaptureStore.getState().replaceMedia([shot('label', 'etiquette-B')]);
    expect(useCaptureStore.getState().media.map((m) => m.base64)).toEqual(['data:etiquette-B']);
  });

  it('retainRoles retire les rôles secondaires (passage en scan éclair)', () => {
    const store = useCaptureStore.getState();
    store.addMedia(shot('label', 'etiquette-A'));
    store.addMedia(shot('capsule', 'capsule-A'));
    useCaptureStore.getState().retainRoles(['label']);
    expect(useCaptureStore.getState().media.map((m) => m.role)).toEqual(['label']);
    // Rien à retirer : même tableau (pas de rendu inutile).
    const before = useCaptureStore.getState().media;
    useCaptureStore.getState().retainRoles(['label']);
    expect(useCaptureStore.getState().media).toBe(before);
  });
});
