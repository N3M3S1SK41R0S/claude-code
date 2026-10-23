/**
 * Garde-fous statiques des écrans « Échanges & ventes » (sources TSX non
 * exécutables sous Vitest) :
 *  - chaque accès aux plateformes passe par la source UNIQUE du drapeau
 *    produit, marketplaceEnabled() (lib/features) ;
 *  - toute clé i18n de ces écrans existe en FR ET en EN (une clé absente
 *    s'afficherait brute), apostrophe typographique en français.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { commissionBasisNoticeKey } from './marketCommission';
import { amountProblemMessage } from './marketForms';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (path: string) => readFileSync(join(APP_ROOT, path), 'utf-8');

describe('drapeau marketplaceEnabled() : source unique des accès aux plateformes', () => {
  it.each([
    'components/item/SellButton.tsx',
    'components/wishlist/CommunityAvailability.tsx',
    'components/market/CommunityGate.tsx',
    'app/wishlist/[id].tsx',
    'app/(tabs)/market/index.tsx',
  ])('%s consulte marketplaceEnabled()', (path) => {
    expect(source(path)).toMatch(/\bmarketplaceEnabled\(\)/);
  });

  it('aucun calcul local du drapeau (enableMarketplace || isDemoMode) dans ces écrans', () => {
    for (const path of ['app/(tabs)/market/index.tsx', 'components/market/CommunityGate.tsx']) {
      expect(source(path)).not.toMatch(/enableMarketplace/);
    }
  });

  it('CommunityGate annonce « bientôt disponible » quand les plateformes sont coupées', () => {
    expect(source('components/market/CommunityGate.tsx')).toMatch(/t\('community\.comingSoon'\)/);
  });

  it('la fiche d’une envie ne propose « Chercher dans la communauté » que si le drapeau est actif', () => {
    const wishlist = source('app/wishlist/[id].tsx');
    const flag = wishlist.indexOf('marketplaceEnabled() ?');
    const button = wishlist.indexOf("t('wishlist.actions.searchCommunity')");
    expect(flag).toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(flag);
  });
});

// ── i18n ─────────────────────────────────────────────────────────────────────

function lookup(catalog: unknown, key: string): unknown {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** Fichiers TSX d'un dossier (récursif), chemins relatifs à l'app. */
function tsxFiles(dir: string): string[] {
  return readdirSync(join(APP_ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? tsxFiles(join(dir, entry.name))
      : entry.name.endsWith('.tsx')
        ? [join(dir, entry.name)]
        : [],
  );
}

/** Clés littérales `t('a.b')` (les clés construites à l'exécution sont listées à part). */
function literalKeys(path: string): string[] {
  return [...source(path).matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)].map((match) => match[1] ?? '');
}

/** Clés produites à l'exécution par la logique pure ou des tables de motifs. */
const DYNAMIC_KEYS = [
  ...(['loading', 'offline', 'unavailable'] as const).map((status) => commissionBasisNoticeKey(status) ?? ''),
  ...(['invalid', 'belowMin', 'aboveMax'] as const).map((problem) => amountProblemMessage(problem, 'fr').key),
  'community.picker.blockedOpen',
  'community.picker.blockedCeded',
  'community.sellForm.blockedOpen',
  'community.sellForm.blockedCeded',
];

describe('i18n des écrans « Échanges & ventes »', () => {
  const files = [
    ...tsxFiles('components/market'),
    ...tsxFiles('app/community'),
    'components/item/SellButton.tsx',
    'components/wishlist/CommunityAvailability.tsx',
    'app/(tabs)/market/index.tsx',
  ];
  const keys = [...new Set([...files.flatMap(literalKeys), ...DYNAMIC_KEYS])].sort();

  it('trouve bien des clés dans les sources', () => {
    expect(keys.length).toBeGreaterThan(50);
    expect(keys).toContain('community.commissions.title');
  });

  it('chaque clé existe en FR et en EN (aucune clé brute affichée)', () => {
    const missing = keys.filter((key) => typeof lookup(fr, key) !== 'string' || typeof lookup(en, key) !== 'string');
    expect(missing).toEqual([]);
  });

  it('chaînes françaises des plateformes : apostrophe typographique (’), jamais droite', () => {
    const straight = keys.filter((key) => {
      const value = lookup(fr, key);
      return key.startsWith('community.') && typeof value === 'string' && value.includes("'");
    });
    expect(straight).toEqual([]);
  });
});
