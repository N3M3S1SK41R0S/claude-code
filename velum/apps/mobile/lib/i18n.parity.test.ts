/**
 * Garde-fou i18n : les catalogues FR et EN doivent avoir EXACTEMENT le même
 * jeu de clés (feuilles). Une clé manquante d'un côté = chaîne non traduite
 * en production → rejet stores (métadonnées/localisation) et mauvaise UX.
 */
import { describe, expect, it } from 'vitest';
import fr from '../locales/fr.json';
import en from '../locales/en.json';

type Json = { [k: string]: Json } | string | number | boolean | null;

function leafKeys(node: Json, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [prefix];
  return Object.entries(node).flatMap(([k, v]) =>
    leafKeys(v as Json, prefix ? `${prefix}.${k}` : k),
  );
}

describe('parité des catalogues i18n', () => {
  const frKeys = new Set(leafKeys(fr as Json));
  const enKeys = new Set(leafKeys(en as Json));

  it('aucune clé présente en FR et absente en EN', () => {
    expect([...frKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it('aucune clé présente en EN et absente en FR', () => {
    expect([...enKeys].filter((k) => !frKeys.has(k))).toEqual([]);
  });

  it('aucune valeur vide (chaîne non traduite)', () => {
    const empties: string[] = [];
    const scan = (node: Json, prefix = ''): void => {
      if (typeof node === 'string') {
        if (node.trim().length === 0) empties.push(prefix);
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) scan(v as Json, prefix ? `${prefix}.${k}` : k);
      }
    };
    scan(fr as Json);
    scan(en as Json);
    expect(empties).toEqual([]);
  });
});
