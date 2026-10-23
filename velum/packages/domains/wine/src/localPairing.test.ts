import { describe, expect, it } from 'vitest';
import type { CellarWineEntry } from '@velum/core';
import {
  classifyWine,
  dishCategories,
  LOCAL_PAIRING_MAX_SCORE,
  localPairing,
  localPairingReason,
  normalizeDishText,
} from './localPairing.ts';

const YEAR = 2026;

const BANDOL: CellarWineEntry = {
  itemId: 'bandol',
  label: 'Bandol Domaine Tempier 2015',
  vintage: 2015,
  color: 'rouge',
  appellation: 'Bandol',
  storageLocation: 'Rangée 2 · Colonne 4 · Place 1',
  quantity: 3,
  drinkWindow: { from: 2020, to: 2026 },
  foodPairings: ['gigot d’agneau', 'daube provençale'],
};
const SANCERRE: CellarWineEntry = {
  itemId: 'sancerre',
  label: 'Sancerre Vacheron 2022',
  color: 'blanc',
  drinkWindow: { from: 2024, to: 2029 },
  foodPairings: ['crottin de Chavignol', 'fruits de mer'],
};
const SAUTERNES: CellarWineEntry = {
  itemId: 'sauternes',
  label: 'Château Suduiraut 2011',
  appellation: 'Sauternes',
  color: 'blanc',
  drinkWindow: { from: 2018, to: 2045 },
  foodPairings: ['foie gras poêlé', 'roquefort'],
};
const YOUNG_BEAUJOLAIS: CellarWineEntry = {
  itemId: 'morgon-young',
  label: 'Morgon Côte du Py 2024',
  color: 'rouge',
  drinkWindow: { from: 2029, to: 2036 },
};
const READY_BEAUJOLAIS: CellarWineEntry = {
  itemId: 'morgon-ready',
  label: 'Morgon Côte du Py 2019',
  color: 'rouge',
  drinkWindow: { from: 2022, to: 2028 },
};
const MYSTERY: CellarWineEntry = { itemId: 'mystery', label: 'Cuvée de la maison' };

const CELLAR = [SANCERRE, BANDOL, SAUTERNES, YOUNG_BEAUJOLAIS, READY_BEAUJOLAIS, MYSTERY];

describe('normalisation et catégories de plats', () => {
  it('normalise accents, ligatures et apostrophes', () => {
    expect(normalizeDishText('Bœuf  bourguignon à l’ancienne !')).toBe('boeuf bourguignon a l ancienne');
  });

  it('reconnaît l’ingrédient principal, au pluriel comme au singulier', () => {
    expect(dishCategories('gigot d’agneau')).toEqual(['lamb']);
    expect(dishCategories('Huîtres de Marennes')).toEqual(['shellfish']);
    expect(dishCategories('Bœuf bourguignon')).toEqual(['red_meat']);
    expect(dishCategories('crottin de chèvre chaud en salade')).toEqual(['goat_cheese']);
  });

  it('une garniture ou un dessert ne détourne pas un plat salé', () => {
    expect(dishCategories('Magret de canard aux figues')).toEqual(['duck']);
    expect(dishCategories('canard glacé au miel')).toEqual(['duck']);
    expect(dishCategories('saucisse et pommes de terre sautées')).toEqual(['pork']);
    expect(dishCategories('steak bleu')).toEqual(['red_meat']);
  });

  it('desserts, styles et garnitures seules sont reconnus à défaut', () => {
    expect(dishCategories('tarte aux pommes')).toEqual(['fruit_dessert']);
    expect(dishCategories('fondant au chocolat')).toEqual(['chocolate']);
    expect(dishCategories('poulet au curry')).toEqual(['poultry', 'spicy_asian']);
    expect(dishCategories('risotto aux cèpes')).toEqual(['risotto', 'mushroom']);
    expect(dishCategories('ratatouille')).toEqual(['vegetable']);
  });

  it('ne reconnaît rien plutôt que d’inventer', () => {
    expect(dishCategories('')).toEqual([]);
    expect(dishCategories('kouign-amann')).toEqual([]);
    expect(dishCategories('barbapapa')).toEqual([]); // « bar » n'est pas un préfixe
  });
});

describe('classifyWine — familles d’un vin de la cave', () => {
  it('lit couleur, appellation et cépages', () => {
    expect(classifyWine(BANDOL).family).toBe('red_structured');
    expect(classifyWine(SANCERRE).family).toBe('white_crisp');
    expect(classifyWine({ label: 'Sancerre rouge 2020', color: 'rouge' }).family).toBe('red_light');
    expect(classifyWine(SAUTERNES).family).toBe('sweet');
    expect(classifyWine({ label: 'Banyuls Rimage 2019', color: 'rouge' }).family).toBe('fortified');
    expect(classifyWine({ label: 'Champagne Brut Réserve', color: 'effervescent' }).family).toBe('sparkling');
    expect(classifyWine({ label: 'Côtes de Provence 2024', color: 'rosé' }).family).toBe('rose');
    expect(classifyWine({ label: 'Jurançon sec 2022', color: 'blanc' }).family).toBe('white_aromatic');
    expect(classifyWine({ label: 'Cuvée X', color: 'rouge', grapes: ['syrah'] }).family).toBe('red_structured');
  });

  it('le mot-clé le plus long l’emporte (Crozes-Hermitage ≠ Hermitage)', () => {
    expect(classifyWine({ label: 'Crozes-Hermitage 2020', color: 'rouge' }).family).toBe('red_medium');
    expect(classifyWine({ label: 'Hermitage 2015', color: 'rouge' }).family).toBe('red_structured');
  });

  it('la région ne sert qu’à défaut ; sans couleur, l’incertitude minore les poids', () => {
    expect(classifyWine({ label: 'Clos des Fées', color: 'rouge', region: 'Bourgogne' }).family).toBe('red_light');
    const noColor = classifyWine({ label: 'Pauillac 2016' });
    expect(noColor.family).toBe('red_structured');
    expect(noColor.weights.red_structured).toBeCloseTo(0.75);
    expect(classifyWine(MYSTERY)).toEqual({ weights: {}, family: null });
  });
});

describe('localPairing — plat → vins de ma cave, sans IA', () => {
  it('gigot d’agneau → le Bandol (structure + accord ZAPPA + dernière année d’apogée)', () => {
    const result = localPairing('Gigot d’agneau', CELLAR, YEAR);
    expect(result.categories).toEqual(['lamb']);
    expect(result.wantedFamilies[0]).toBe('red_structured');
    const top = result.suggestions[0];
    expect(top).toMatchObject({
      itemId: 'bandol',
      family: 'red_structured',
      dishCategory: 'lamb',
      matchedPairing: 'gigot d’agneau',
      peakStatus: 'closing',
      storageLocation: 'Rangée 2 · Colonne 4 · Place 1',
      quantity: 3,
    });
    expect(top?.score).toBeLessThanOrEqual(LOCAL_PAIRING_MAX_SCORE);
    expect(top?.score).toBeGreaterThan(0.85);
    expect(top?.reason).toBe(
      'Rouge structuré, accord classique avec l’agneau ; sa fiche cite « gigot d’agneau » ; dernière année d’apogée.',
    );
    expect(result.suggestions.some((s) => s.itemId === 'sancerre')).toBe(false);
  });

  it('chèvre → Sancerre ; foie gras → Sauternes', () => {
    expect(localPairing('crottin de chèvre rôti', CELLAR, YEAR).suggestions[0]?.itemId).toBe('sancerre');
    expect(localPairing('foie gras mi-cuit', CELLAR, YEAR).suggestions[0]?.itemId).toBe('sauternes');
  });

  it('un vin prêt passe devant le même style encore trop jeune', () => {
    const ids = localPairing('poulet rôti', CELLAR, YEAR).suggestions.map((s) => s.itemId);
    expect(ids.indexOf('morgon-ready')).toBeGreaterThanOrEqual(0);
    const young = ids.indexOf('morgon-young');
    if (young !== -1) expect(ids.indexOf('morgon-ready')).toBeLessThan(young);
  });

  it('rien de convenable en cave → aucune suggestion forcée, idées d’achat', () => {
    const result = localPairing('pizza margherita', [SANCERRE, SAUTERNES], YEAR);
    expect(result.categories).toEqual(['pasta_pizza']);
    expect(result.suggestions).toEqual([]);
    expect(result.purchaseIdeas).toContain('Chianti Classico');
    expect(result.purchaseIdeas.length).toBeLessThanOrEqual(4);
  });

  it('plat non reconnu : seul un accord cité par la fiche ZAPPA compte, avec un score modeste', () => {
    const breton: CellarWineEntry = {
      itemId: 'breton',
      label: 'Cidre ou vin ?',
      foodPairings: ['kig ha farz'],
      drinkWindow: { from: 2020, to: 2030 },
    };
    const result = localPairing('Kig ha farz', [breton, ...CELLAR], YEAR);
    expect(result.categories).toEqual([]);
    expect(result.purchaseIdeas).toEqual([]);
    expect(result.suggestions.map((s) => s.itemId)).toEqual(['breton']);
    expect(result.suggestions[0]?.score).toBeLessThanOrEqual(0.7);
    expect(localPairing('kouign-amann', CELLAR, YEAR).suggestions).toEqual([]);
  });

  it('plat vide, cave vide, limite : déterministe et sans erreur', () => {
    expect(localPairing('   ', CELLAR, YEAR)).toEqual({
      dish: '',
      categories: [],
      wantedFamilies: [],
      suggestions: [],
      purchaseIdeas: [],
    });
    expect(localPairing('gigot', [], YEAR).suggestions).toEqual([]);
    expect(localPairing('poulet rôti', CELLAR, YEAR, { limit: 1 }).suggestions).toHaveLength(1);
    expect(localPairing('poulet rôti', CELLAR, YEAR)).toEqual(localPairing('poulet rôti', CELLAR, YEAR));
  });

  it('les scores restent dans [0, 0.95] et au-dessus du seuil', () => {
    for (const dish of ['gigot', 'huîtres', 'roquefort', 'curry de légumes', 'tarte tatin', 'côte de bœuf']) {
      for (const s of localPairing(dish, CELLAR, YEAR).suggestions) {
        expect(s.score).toBeGreaterThanOrEqual(0.5);
        expect(s.score).toBeLessThanOrEqual(LOCAL_PAIRING_MAX_SCORE);
      }
    }
  });
});

describe('non-régressions : faux ingrédients dans un nom de plat composé', () => {
  const MADIRAN: CellarWineEntry = {
    itemId: 'madiran',
    label: 'Madiran Montus 2016',
    color: 'rouge',
    appellation: 'Madiran',
    foodPairings: ['magret de canard', 'cassoulet'],
  };
  const PAUILLAC: CellarWineEntry = { itemId: 'pauillac', label: 'Pauillac 2016', color: 'rouge', appellation: 'Pauillac' };
  const CHABLIS: CellarWineEntry = { itemId: 'chablis', label: 'Chablis 2022', color: 'blanc', appellation: 'Chablis' };
  const CDR: CellarWineEntry = {
    itemId: 'cdr',
    label: 'Côtes-du-Rhône 2021',
    color: 'rouge',
    appellation: 'Côtes du Rhône',
    foodPairings: ['grillades', 'pizza'],
  };
  const GEWURZ: CellarWineEntry = { itemId: 'gewurz', label: 'Gewurztraminer 2020', color: 'blanc' };
  const SUDUIRAUT: CellarWineEntry = { ...SAUTERNES, foodPairings: [] };
  const BEEF_RED: CellarWineEntry = { itemId: 'cornas', label: 'Cornas 2015', color: 'rouge' };

  it('foie gras de canard / d’oie reste du foie gras (jamais un plat de canard)', () => {
    expect(dishCategories('foie gras de canard poêlé')).toEqual(['foie_gras']);
    expect(dishCategories('Foie gras d’oie')).toEqual(['foie_gras']);
    expect(dishCategories('foie gras de canard mi-cuit')).toEqual(['foie_gras']);
    const ids = localPairing('foie gras de canard poêlé', [MADIRAN, SUDUIRAUT], YEAR).suggestions.map((s) => s.itemId);
    expect(ids[0]).toBe('sauternes');
    expect(ids).not.toContain('madiran');
  });

  it('carpaccio / steak / tartare de poisson : du poisson, pas du bœuf', () => {
    expect(dishCategories('carpaccio de saint-jacques')).toEqual(['shellfish']);
    expect(dishCategories('carpaccio de saumon')).toEqual(['fish']);
    expect(dishCategories('steak de thon')).toEqual(['fish']);
    expect(dishCategories('tartare de saumon')).toEqual(['fish']);
    expect(dishCategories('carpaccio de bœuf')).toEqual(['red_meat']);
    expect(localPairing('carpaccio de saint jacques', [PAUILLAC, CHABLIS], YEAR).suggestions.map((s) => s.itemId)).toEqual([
      'chablis',
    ]);
  });

  it('pâtés ≠ pâtes : la charcuterie ne devient pas un plat de pâtes', () => {
    expect(dishCategories('pâtés et rillettes')).toEqual(['charcuterie']);
    expect(dishCategories('Pâté de campagne')).toEqual(['charcuterie']);
    expect(dishCategories('pâté en croûte')).toEqual(['charcuterie']);
    expect(dishCategories('pâtes carbonara')).toEqual(['pasta_pizza']);
    expect(dishCategories('pates carbonara')).toEqual(['pasta_pizza']);
    expect(dishCategories('pâtisserie')).toEqual(['fruit_dessert']);
  });

  it('un mode de cuisson ne réclame jamais un rouge pour un poisson ou des fruits de mer', () => {
    for (const dish of ['dorade grillée', 'saumon grillé', 'bar à la plancha', 'brochettes de Saint-Jacques', 'pizza aux fruits de mer']) {
      const ids = localPairing(dish, [CDR, CHABLIS], YEAR).suggestions.map((s) => s.itemId);
      expect(ids, dish).toEqual(['chablis']);
    }
    // Le style garde son effet quand il est compatible avec l'ingrédient.
    expect(localPairing('poulet au curry', [GEWURZ], YEAR).suggestions.map((s) => s.itemId)).toEqual(['gewurz']);
    expect(localPairing('côte de bœuf grillée', [BEEF_RED, CDR], YEAR).suggestions.map((s) => s.itemId).sort()).toEqual([
      'cdr',
      'cornas',
    ]);
  });
});

describe('classifyWine — couleur explicite et mots-clés spéciaux', () => {
  it('un rouge sec d’appellation homonyme n’est ni liquoreux ni muté', () => {
    expect(
      classifyWine({ label: 'Château Biac 2018', color: 'rouge', appellation: 'Cadillac Côtes de Bordeaux' }).family,
    ).toBe('red_medium');
    expect(classifyWine({ label: 'Mas Amiel 2019', color: 'rouge', appellation: 'Maury sec' }).family).toBe(
      'red_structured',
    );
    // Les vrais Maury (VDN) et Cadillac (liquoreux blanc) restent reconnus.
    expect(classifyWine({ label: 'Maury grenat 2015', color: 'rouge' }).family).toBe('fortified');
    expect(classifyWine({ label: 'Cadillac 2015', color: 'blanc' }).family).toBe('sweet');
  });

  it('un Champagne déclaré blanc ou rosé reste un effervescent', () => {
    expect(classifyWine({ label: 'Champagne Brut Réserve Billecart', color: 'blanc' }).family).toBe('sparkling');
    const rose = classifyWine({ label: 'Champagne Brut Rosé', color: 'rosé' });
    expect(rose.family).toBe('sparkling');
    expect(rose.weights.rose).toBeCloseTo(0.5);
    const chablis: CellarWineEntry = { itemId: 'chablis', label: 'Chablis 2022', color: 'blanc' };
    const champagne: CellarWineEntry = { itemId: 'champ', label: 'Champagne Brut Réserve', color: 'blanc' };
    expect(localPairing('apéritif', [chablis, champagne], YEAR).suggestions[0]?.itemId).toBe('champ');
  });
});

describe('localPairingReason', () => {
  it('reste honnête quand le style est inconnu', () => {
    expect(
      localPairingReason({ family: null, dishCategory: null, matchedPairing: 'kig ha farz', peakStatus: 'unknown' }),
    ).toBe('Style du vin non déterminé ; sa fiche cite « kig ha farz ».');
  });
});
