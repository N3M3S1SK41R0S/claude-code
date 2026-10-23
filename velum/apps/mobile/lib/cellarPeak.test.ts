import { describe, expect, it } from 'vitest';
import type { CellarPeakEntry, LocalPairingSuggestion } from '@velum/core';

import fr from '../locales/fr.json';
import en from '../locales/en.json';
import {
  availableColorGroups,
  colorGroupOf,
  describePosition,
  filterPeakEntries,
  formatPosition,
  localSuggestionReason,
  peakStatusTone,
  peakSummary,
  positionFormError,
  positionFormFrom,
  positionFormToLocation,
  positionLabel,
  quickSuggestionA11yLabel,
  vintageToShow,
  wishlistIdeaTitle,
  type Translate,
} from './cellarPeak';

/** Mini-traducteur fondé sur les VRAIS catalogues (interpolation {{x}}). */
function translator(catalog: unknown): Translate {
  return (key, opts) => {
    let node: unknown = catalog;
    for (const part of key.split('.')) {
      node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
    }
    if (typeof node !== 'string') return `!${key}`;
    return node.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(opts?.[name] ?? ''));
  };
}
const tFr = translator(fr);
const tEn = translator(en);

function entry(partial: Partial<CellarPeakEntry> & { itemId: string }): CellarPeakEntry {
  return {
    label: `Vin ${partial.itemId}`,
    windowFrom: 2020,
    windowTo: 2030,
    status: 'peak',
    suggestedDishes: [],
    ...partial,
  };
}

describe('position de la bouteille', () => {
  it('format canonique → libellé localisé, complet ou abrégé', () => {
    const view = describePosition(' Rangée 2 · Colonne 4 · Place 1 ');
    expect(view).toEqual({ kind: 'slot', slot: { row: 2, column: 4, place: 1 } });
    expect(formatPosition(view, tFr)).toBe('Rangée 2 · Colonne 4 · Place 1');
    expect(formatPosition(view, tFr, { short: true })).toBe('Rangée 2 · Col. 4 · Pl. 1');
    expect(formatPosition(view, tEn)).toBe('Row 2 · Column 4 · Slot 1');
  });

  it('texte libre conservé, absence explicite', () => {
    expect(positionLabel('Cave — casier B3', tFr)).toBe('Cave — casier B3');
    expect(describePosition('   ')).toEqual({ kind: 'none' });
    expect(positionLabel(null, tFr)).toBeNull();
  });
});

describe('saisie de la position', () => {
  it('pré-remplit selon le format existant', () => {
    expect(positionFormFrom('Rangée 3 · Place 2')).toEqual({ mode: 'slot', row: '3', column: '', place: '2', text: '' });
    expect(positionFormFrom('Casier B3')).toEqual({ mode: 'text', row: '', column: '', place: '', text: 'Casier B3' });
    expect(positionFormFrom(null).mode).toBe('slot');
  });

  it('produit le format canonique du carnet, ou null pour effacer', () => {
    const base = { mode: 'slot' as const, row: '2', column: ' 4 ', place: '', text: '' };
    expect(positionFormToLocation(base)).toBe('Rangée 2 · Colonne 4');
    expect(positionFormToLocation({ ...base, row: '', column: '' })).toBeNull();
    expect(positionFormToLocation({ ...base, mode: 'text', text: '  Casier   B3 ' })).toBe('Casier B3');
    expect(positionFormToLocation({ ...base, mode: 'text', text: '   ' })).toBeNull();
  });

  it('signale une saisie invalide plutôt que de l’ignorer en silence', () => {
    const base = { mode: 'slot' as const, row: '2', column: '', place: '', text: '' };
    expect(positionFormError(base)).toBe(false);
    expect(positionFormError({ ...base, column: 'B' })).toBe(true);
    expect(positionFormError({ ...base, place: '0' })).toBe(true);
    expect(positionFormError({ ...base, mode: 'text', row: 'x' })).toBe(false);
  });
});

describe('statuts, couleurs et filtres', () => {
  const entries = [
    entry({ itemId: 'r', label: 'Bandol 2015', color: 'rouge', status: 'closing', storageLocation: 'Rangée 2 · Colonne 4' }),
    entry({ itemId: 'w', label: 'Sancerre 2022', color: 'Blanc', suggestedDishes: ['crottin de chèvre'] }),
    entry({ itemId: 's', label: 'Pauillac 2019', color: 'red', status: 'soon' }),
    entry({ itemId: 'x', label: 'Mystère' }),
  ];

  it('teintes de badge et groupes de couleur FR/EN', () => {
    expect(peakStatusTone('past')).toBe('danger');
    expect(peakStatusTone('closing')).toBe('warning');
    expect(peakStatusTone('peak')).toBe('success');
    expect(peakStatusTone('soon')).toBe('neutral');
    expect(colorGroupOf('Rosé')).toBe('rose');
    expect(colorGroupOf('effervescent')).toBe('sparkling');
    expect(colorGroupOf('liquoreux')).toBe('sweet');
    expect(colorGroupOf(undefined)).toBe('other');
    expect(availableColorGroups(entries)).toEqual(['red', 'white', 'other']);
  });

  it('filtre « l’an prochain », couleur et recherche (plats, position)', () => {
    const all = { query: '', color: null, includeSoon: true };
    expect(filterPeakEntries(entries, all).map((e) => e.itemId)).toEqual(['r', 'w', 's', 'x']);
    expect(filterPeakEntries(entries, { ...all, includeSoon: false }).map((e) => e.itemId)).toEqual(['r', 'w', 'x']);
    expect(filterPeakEntries(entries, { ...all, color: 'red' }).map((e) => e.itemId)).toEqual(['r', 's']);
    expect(filterPeakEntries(entries, { ...all, query: 'chevre' }).map((e) => e.itemId)).toEqual(['w']);
    expect(filterPeakEntries(entries, { ...all, query: 'rangée 2' }).map((e) => e.itemId)).toEqual(['r']);
    expect(peakSummary(entries)).toEqual({ past: 0, closing: 1, peak: 2, soon: 1 });
  });

  it('millésime affiché seulement s’il manque au libellé', () => {
    expect(vintageToShow({ label: 'Bandol 2015', vintage: 2015 })).toBeNull();
    expect(vintageToShow({ label: 'Domaine Tempier', vintage: 2015 })).toBe(2015);
    expect(vintageToShow({ label: 'X' })).toBeNull();
  });
});

describe('raison localisée d’une suggestion rapide', () => {
  const suggestion: LocalPairingSuggestion = {
    itemId: 'b',
    label: 'Bandol',
    score: 0.9,
    family: 'red_structured',
    dishCategory: 'lamb',
    matchedPairing: 'gigot d’agneau',
    peakStatus: 'closing',
    reason: '…',
  };

  it('compose famille, plat, accord ZAPPA et apogée en FR et en EN', () => {
    expect(localSuggestionReason(suggestion, tFr)).toBe(
      'Rouge structuré, accord classique avec l’agneau · cité par sa fiche : « gigot d’agneau » · dernière année d’apogée',
    );
    const en = localSuggestionReason(suggestion, tEn);
    expect(en).not.toContain('!');
    expect(en).toContain('lamb');
  });

  it('toutes les familles, catégories et statuts ont une traduction', () => {
    const families = ['white_crisp', 'white_rich', 'white_aromatic', 'rose', 'red_light', 'red_medium', 'red_structured', 'sparkling', 'sweet', 'fortified'];
    const categories = ['shellfish', 'fish', 'poultry', 'duck', 'pork', 'charcuterie', 'veal', 'red_meat', 'lamb', 'game', 'goat_cheese', 'blue_cheese', 'hard_cheese', 'soft_cheese', 'alpine_cheese', 'cheese', 'foie_gras', 'spicy_asian', 'north_african', 'alsatian', 'pasta_pizza', 'risotto', 'mushroom', 'grill', 'vegetable', 'aperitif', 'fruit_dessert', 'chocolate'];
    for (const t of [tFr, tEn]) {
      for (const f of families) expect(t(`cellar.family.${f}`)).not.toMatch(/^!/);
      for (const c of categories) expect(t(`cellar.dishCategory.${c}`)).not.toMatch(/^!/);
      for (const s of ['past', 'closing', 'peak', 'soon', 'young']) expect(t(`cellar.peakReason.${s}`)).not.toMatch(/^!/);
      for (const s of ['past', 'closing', 'peak', 'soon']) expect(t(`cellarPeak.status.${s}`)).not.toMatch(/^!/);
    }
  });

  it('libellé accessible complet : vin, emplacement, pertinence, raison et quantité (rien n’est masqué)', () => {
    const located = { ...suggestion, storageLocation: 'Rangée 2 · Colonne 4 · Place 1', quantity: 3 };
    expect(quickSuggestionA11yLabel(located, tFr, { label: 'Bandol Tempier 2015', score: '91 %' })).toBe(
      'Bandol Tempier 2015. Emplacement : Rangée 2 · Colonne 4 · Place 1. Pertinence : 91 %. ' +
        'Rouge structuré, accord classique avec l’agneau · cité par sa fiche : « gigot d’agneau » · dernière année d’apogée. ' +
        '3 bouteille(s)',
    );
    // Forme compacte (menu d'événement) : sans raison ni quantité, emplacement toujours lu.
    expect(quickSuggestionA11yLabel(located, tEn, { label: 'Bandol', score: '91 %', compact: true })).toBe(
      'Bandol. Location: Row 2 · Column 4 · Slot 1. Relevance: 91 %',
    );
    // Sans emplacement : aucune mention vide.
    expect(quickSuggestionA11yLabel(suggestion, tFr, { label: 'Bandol', score: '90 %', compact: true })).toBe(
      'Bandol. Pertinence : 90 %',
    );
  });

  it('titre d’idée d’envie borné, avec repli', () => {
    expect(wishlistIdeaTitle(['Madiran', 'Cahors', 'Saint-Émilion', 'Pomerol'], 'x')).toBe('Madiran · Cahors · Saint-Émilion');
    expect(wishlistIdeaTitle([], 'Vin pour gigot')).toBe('Vin pour gigot');
    expect(wishlistIdeaTitle(['y'.repeat(200)], 'x').length).toBe(120);
  });
});
