/**
 * Garde-fous statiques des écrans « Échanges & ventes » (sources TSX non
 * exécutables sous Vitest) : chaque accès aux plateformes passe par la
 * source UNIQUE du drapeau produit, marketplaceEnabled() (lib/features).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
