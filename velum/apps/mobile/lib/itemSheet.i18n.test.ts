/**
 * Garde-fou i18n de la fiche objet : toute clé littérale `t('…')` utilisée
 * par l'écran, ses sections et les sheets de domaine existe en FR ET en EN
 * (une clé absente s'afficherait brute à l'utilisateur), ainsi que les clés
 * produites par la logique pure (libellés de champs, erreurs).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { VelumDomain } from '@velum/core';

import fr from '../locales/fr.json';
import en from '../locales/en.json';
import { IDENTITY_FIELDS } from './identityFields';
import { TITLE_FIELD_LABEL_KEY, TITLE_REQUIRED_ERROR_KEY, validateIdentityForm } from './itemSheet';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function lookup(catalog: unknown, key: string): unknown {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function sourcesOf(dir: string, filter: (name: string) => boolean): string[] {
  return readdirSync(join(APP_ROOT, dir))
    .filter(filter)
    .map((name) => join(APP_ROOT, dir, name));
}

/** Clés littérales `t('a.b')` (les clés construites dynamiquement sont ignorées). */
function literalKeys(file: string): string[] {
  const source = readFileSync(file, 'utf-8');
  return [...source.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)].map((match) => match[1] ?? '');
}

/** Clés construites à l'exécution (ternaires, gabarits) : listées à la main. */
const DYNAMIC_KEYS = [
  'item.alert.above',
  'item.alert.below',
  'item.alert.activeAbove',
  'item.alert.activeBelow',
  'item.section.expandHint',
  'item.section.collapseHint',
];

const FILES = [
  join(APP_ROOT, 'app/item/[id].tsx'),
  ...sourcesOf('components/item', (name) => name.endsWith('.tsx')),
  ...sourcesOf('components/sheets', (name) => name.endsWith('.tsx')),
];

describe('i18n de la fiche objet', () => {
  const keys = [...new Set([...FILES.flatMap(literalKeys), ...DYNAMIC_KEYS])].sort();

  it('trouve bien des clés dans les sources', () => {
    expect(keys.length).toBeGreaterThan(50);
    expect(keys).toContain('item.identity.title');
    expect(keys).toContain('item.fullSheet.load');
  });

  it.each(['fr', 'en'] as const)('chaque clé littérale existe en %s', (lang) => {
    const catalog = lang === 'fr' ? fr : en;
    const missing = keys.filter((key) => typeof lookup(catalog, key) !== 'string');
    expect(missing).toEqual([]);
  });

  it('les clés produites par la logique pure existent dans les deux langues', () => {
    const domains = Object.keys(IDENTITY_FIELDS) as VelumDomain[];
    const produced = [
      TITLE_FIELD_LABEL_KEY,
      TITLE_REQUIRED_ERROR_KEY,
      ...domains.flatMap((domain) => IDENTITY_FIELDS[domain].map((field) => field.labelKey)),
      ...Object.values(validateIdentityForm('watch', 'x', { year: 'abc', caseDiameterMm: '500' }).fields),
    ];
    for (const catalog of [fr, en]) {
      expect(produced.filter((key) => typeof lookup(catalog, key) !== 'string')).toEqual([]);
    }
  });

  it('les nouveaux textes français utilisent l’apostrophe typographique', () => {
    const blocks = ['quick', 'alert', 'valuation', 'identity', 'followUp', 'fullSheet', 'danger', 'section'];
    const strings: string[] = [];
    const collect = (node: unknown): void => {
      if (typeof node === 'string') strings.push(node);
      else if (node && typeof node === 'object') Object.values(node).forEach(collect);
    };
    for (const block of blocks) collect(lookup(fr, `item.${block}`));
    expect(strings.length).toBeGreaterThan(40);
    expect(strings.filter((s) => s.includes("'"))).toEqual([]);
  });
});
