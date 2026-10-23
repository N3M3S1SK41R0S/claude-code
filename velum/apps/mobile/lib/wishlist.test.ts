import { describe, expect, it } from 'vitest';
import { VelumError, type Candidate, type VelumItem, type WishlistEntry } from '@velum/core';

import {
  WISHLIST_NOTES_MAX_LENGTH,
  WISHLIST_TITLE_MAX_LENGTH,
  buildWishlistInput,
  classifyCommunityError,
  communitySearchText,
  draftToNewEntry,
  emptyWishlistForm,
  entryFromCandidate,
  entryFromItem,
  filterWishlist,
  findDuplicate,
  formFromEntry,
  formatPriceInput,
  formatTargetPrice,
  groupByDomain,
  identityDetails,
  newItemFromEntry,
  notesExcerpt,
  parseDomainParam,
  parseTargetPriceInput,
  removeEntry,
  searchHints,
  segmentCounts,
  segmentOf,
  sortWishlist,
  statsByDomain,
  upsertEntry,
  wishlistRoutes,
  wishlistStats,
  withDomain,
  type WishlistFilter,
} from './wishlist';

function entry(overrides: Partial<WishlistEntry> & Pick<WishlistEntry, 'id'>): WishlistEntry {
  return {
    ownerId: 'o',
    domain: 'wine',
    kind: 'wish',
    title: 'Sans titre',
    notes: null,
    attributes: {},
    source: 'manual',
    sourceItemId: null,
    targetPrice: null,
    priority: 'medium',
    acquired: false,
    acquiredAt: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function item(overrides: Partial<VelumItem> = {}): VelumItem {
  return {
    id: 'itm-1',
    ownerId: 'o',
    domain: 'wine',
    title: 'Domaine Tempier Bandol 2019',
    attributes: {
      producer: 'Domaine Tempier',
      vintage: 2019,
      appellation: 'Bandol',
      analysis: { tasting: { robe: 'grenat' } },
      analysisEngine: 'zappa_vini',
      disclaimers: ['Estimation indicative'],
      corrections: [{ field: 'vintage', from: 2018, to: 2019, at: '2026-01-01T00:00:00Z' }],
      quickEstimate: { central: 50 },
    },
    confidence: 0.9,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: 'Cave A3',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const TEMPIER = entry({
  id: 'w1',
  title: 'Domaine Tempier Bandol 2019',
  notes: 'Goûté chez des amis — superbe sur un gigot',
  attributes: { producer: 'Domaine Tempier', appellation: 'Bandol', vintage: 2019 },
  priority: 'high',
  targetPrice: 60,
  createdAt: '2026-07-10T00:00:00Z',
});
const PRADEAUX = entry({
  id: 'w2',
  title: 'Château Pradeaux Bandol',
  priority: 'low',
  targetPrice: 45,
  createdAt: '2026-08-02T00:00:00Z',
});
const JURA = entry({ id: 'w3', kind: 'idea', title: 'Vins orange du Jura', createdAt: '2026-06-15T00:00:00Z' });
const TALBOT = entry({
  id: 'w4',
  title: 'Château Talbot 2010',
  acquired: true,
  acquiredAt: '2026-09-12T00:00:00Z',
  createdAt: '2026-05-20T00:00:00Z',
  targetPrice: 70,
});
const COIN = entry({
  id: 'w5',
  domain: 'coin',
  title: 'Napoléon III 20 Francs Or',
  priority: 'high',
  targetPrice: 350,
  createdAt: '2026-07-01T00:00:00Z',
});
const STAMP_IDEA = entry({ id: 'w6', domain: 'stamp', kind: 'idea', title: 'Semeuses lignées', createdAt: '2026-06-01T00:00:00Z' });

const ALL = [TEMPIER, PRADEAUX, JURA, TALBOT, COIN, STAMP_IDEA];

const filter = (overrides: Partial<WishlistFilter> = {}): WishlistFilter => ({
  domain: null,
  segment: 'wish',
  query: '',
  sort: 'priority',
  ...overrides,
});

describe('routes et paramètres', () => {
  it('construit les sous-routes et valide le paramètre de catégorie', () => {
    expect(wishlistRoutes.entry('a b')).toBe('/wishlist/a%20b');
    expect(wishlistRoutes.create('wine')).toBe('/wishlist/new?domain=wine');
    expect(wishlistRoutes.create(null)).toBe('/wishlist/new');
    expect(parseDomainParam('coin', ['wine', 'coin'])).toBe('coin');
    expect(parseDomainParam(['stamp', 'wine'], ['stamp'])).toBe('stamp');
    expect(parseDomainParam('watch', ['wine', 'coin'])).toBeNull();
    expect(parseDomainParam(undefined, ['wine'])).toBeNull();
  });
});

describe('segments, tri et filtres', () => {
  it('segmentOf : obtenue prime sur le type', () => {
    expect(segmentOf(TEMPIER)).toBe('wish');
    expect(segmentOf(JURA)).toBe('idea');
    expect(segmentOf({ kind: 'idea', acquired: true })).toBe('acquired');
  });

  it('trie par priorité puis récence, par récence, par prix cible (sans prix en dernier)', () => {
    expect(sortWishlist(ALL, 'priority').map((e) => e.id)).toEqual(['w1', 'w5', 'w4', 'w3', 'w6', 'w2']);
    expect(sortWishlist(ALL, 'recent').map((e) => e.id)).toEqual(['w4', 'w2', 'w1', 'w5', 'w3', 'w6']);
    expect(sortWishlist(ALL, 'targetPrice').map((e) => e.id)).toEqual(['w2', 'w1', 'w4', 'w5', 'w3', 'w6']);
  });

  it('ne modifie pas la liste d’origine', () => {
    const copy = [...ALL];
    sortWishlist(ALL, 'recent');
    expect(ALL).toEqual(copy);
  });

  it('filtre par catégorie et segment', () => {
    expect(filterWishlist(ALL, filter({ domain: 'wine' })).map((e) => e.id)).toEqual(['w1', 'w2']);
    expect(filterWishlist(ALL, filter({ segment: 'idea' })).map((e) => e.id)).toEqual(['w3', 'w6']);
    expect(filterWishlist(ALL, filter({ segment: 'acquired' })).map((e) => e.id)).toEqual(['w4']);
  });

  it('recherche dans le titre, les notes et les attributs, sans accents', () => {
    expect(filterWishlist(ALL, filter({ query: 'gigot' })).map((e) => e.id)).toEqual(['w1']);
    expect(filterWishlist(ALL, filter({ query: 'bandol' })).map((e) => e.id)).toEqual(['w1', 'w2']);
    expect(filterWishlist(ALL, filter({ query: 'napoleon' })).map((e) => e.id)).toEqual(['w5']);
    expect(filterWishlist(ALL, filter({ query: 'introuvable' }))).toEqual([]);
  });

  it('la recherche ignore les données techniques des attributs', () => {
    const technical = entry({ id: 't', title: 'X', attributes: { analysisEngine: 'zappa_vini' } });
    expect(filterWishlist([technical], filter({ query: 'zappa' }))).toEqual([]);
  });

  it('searchHints signale les correspondances hors du segment affiché', () => {
    const hints = searchHints(ALL, filter({ domain: 'wine', segment: 'idea', query: 'chateau' }));
    expect(hints.otherSegments).toEqual([
      { segment: 'wish', count: 1 },
      { segment: 'acquired', count: 1 },
    ]);
    expect(hints.everywhere).toBe(2);
    expect(searchHints(ALL, filter({ query: '  ' }))).toEqual({ otherSegments: [], everywhere: 0 });
  });

  it('compte les segments par catégorie', () => {
    expect(segmentCounts(ALL, 'wine')).toEqual({ wish: 2, idea: 1, acquired: 1 });
    expect(segmentCounts(ALL, null)).toEqual({ wish: 3, idea: 2, acquired: 1 });
    expect(segmentCounts([], 'art')).toEqual({ wish: 0, idea: 0, acquired: 0 });
  });

  it('regroupe par catégorie dans l’ordre fourni, catégories vides omises', () => {
    const groups = groupByDomain(ALL, ['coin', 'wine', 'art']);
    expect(groups.map((g) => g.domain)).toEqual(['coin', 'wine', 'stamp']);
    expect(groups[1]?.entries.map((e) => e.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
  });
});

describe('statistiques', () => {
  it('compte envies, idées, obtenues et le budget cible des envies en cours', () => {
    expect(wishlistStats(ALL, 'wine')).toEqual({
      wishes: 2,
      ideas: 1,
      acquired: 1,
      total: 4,
      targetBudget: 105,
    });
    expect(wishlistStats(ALL).total).toBe(6);
    expect(wishlistStats([entry({ id: 'p', targetPrice: 0.1 }), entry({ id: 'q', targetPrice: 0.2 })]).targetBudget).toBe(0.3);
  });

  it('statsByDomain couvre chaque catégorie présente', () => {
    const stats = statsByDomain(ALL, ['wine', 'coin', 'stamp']);
    expect(stats.map((s) => [s.domain, s.stats.total])).toEqual([
      ['wine', 4],
      ['coin', 1],
      ['stamp', 1],
    ]);
  });
});

describe('doublons', () => {
  it('détecte une envie en cours de même catégorie et même titre normalisé', () => {
    expect(findDuplicate(ALL, { domain: 'wine', title: '  domaine TEMPIER bandol 2019 ' })?.id).toBe('w1');
    expect(findDuplicate(ALL, { domain: 'coin', title: 'Napoleon III 20 francs or' })?.id).toBe('w5');
  });

  it('ignore les envies obtenues, les autres catégories, l’entrée exclue et les titres vides', () => {
    expect(findDuplicate(ALL, { domain: 'wine', title: 'Château Talbot 2010' })).toBeNull();
    expect(findDuplicate(ALL, { domain: 'coin', title: 'Domaine Tempier Bandol 2019' })).toBeNull();
    expect(findDuplicate(ALL, { domain: 'wine', title: 'Domaine Tempier Bandol 2019' }, 'w1')).toBeNull();
    expect(findDuplicate(ALL, { domain: 'wine', title: '  ' })).toBeNull();
  });
});

describe('conversions', () => {
  it('entryFromItem ne copie que l’identité et garde le lien vers l’objet', () => {
    const draft = entryFromItem(item());
    expect(draft).toEqual({
      domain: 'wine',
      title: 'Domaine Tempier Bandol 2019',
      attributes: { producer: 'Domaine Tempier', vintage: 2019, appellation: 'Bandol' },
      source: 'item',
      sourceItemId: 'itm-1',
      notes: null,
    });
  });

  it('entryFromItem depuis une dégustation : source tasting et note reprise', () => {
    const draft = entryFromItem(item({ title: null }), { source: 'tasting', notes: '  Superbe  ' });
    expect(draft.source).toBe('tasting');
    expect(draft.notes).toBe('Superbe');
    // Sans titre : libellé composé des champs principaux.
    expect(draft.title).toBe('Domaine Tempier 2019 Bandol');
  });

  it('entryFromCandidate : source scan, sans lien objet, identité seule', () => {
    const candidate: Candidate = {
      id: 'c1',
      domain: 'stamp',
      label: 'Cérès 20c noir 1849',
      confidence: 0.7,
      attributes: { country: 'France', year: 1849, analysis: { x: 1 } },
    };
    expect(entryFromCandidate(candidate)).toEqual({
      domain: 'stamp',
      title: 'Cérès 20c noir 1849',
      attributes: { country: 'France', year: 1849 },
      source: 'scan',
      sourceItemId: null,
      notes: null,
    });
  });

  it('draftToNewEntry applique des défauts neutres', () => {
    const created = draftToNewEntry(entryFromItem(item()));
    expect(created).toMatchObject({ kind: 'wish', priority: 'medium', targetPrice: null, source: 'item' });
    expect(draftToNewEntry(entryFromItem(item()), { kind: 'idea', targetPrice: 40 })).toMatchObject({
      kind: 'idea',
      targetPrice: 40,
    });
  });

  it('newItemFromEntry : fiche complète à charger, confiance et prix payés inconnus', () => {
    const newItem = newItemFromEntry(
      { ...TEMPIER, acquired: true, acquiredAt: '2026-09-12T18:30:00Z', attributes: { ...TEMPIER.attributes, analysis: { x: 1 } } },
      'owner-1',
    );
    expect(newItem).toEqual({
      ownerId: 'owner-1',
      domain: 'wine',
      title: 'Domaine Tempier Bandol 2019',
      attributes: { producer: 'Domaine Tempier', appellation: 'Bandol', vintage: 2019, analysisStatus: 'pending' },
      confidence: null,
      acquiredAt: '2026-09-12',
      acquiredPrice: null,
      notes: 'Goûté chez des amis — superbe sur un gigot',
    });
    expect(newItemFromEntry(PRADEAUX, 'o').acquiredAt).toBeNull();
  });
});

describe('communauté', () => {
  it('communitySearchText garde le cœur du titre (5 mots max)', () => {
    expect(communitySearchText({ title: '10 Francs Coq or — compléter la série' })).toBe('10 Francs Coq or');
    expect(communitySearchText({ title: 'Domaine Tempier Bandol La Tourtine 2019' })).toBe(
      'Domaine Tempier Bandol La Tourtine',
    );
    expect(communitySearchText({ title: 'Napoléon III 20 Francs Or' })).toBe('Napoléon III 20 Francs Or');
    expect(communitySearchText({ title: '(lot) Semeuses' })).toBe('(lot) Semeuses');
  });

  it('classe les échecs : offre, pas encore disponible, panne, autre', () => {
    expect(classifyCommunityError(new VelumError('PLAN_REQUIRED', 'x'))).toBe('plan');
    expect(classifyCommunityError(new VelumError('SOURCE_UNAVAILABLE', 'Communauté réservée Platine'))).toBe('plan');
    expect(
      classifyCommunityError(new VelumError('SOURCE_UNAVAILABLE', 'Catalogue par catégorie : fonction pas encore disponible')),
    ).toBe('notYet');
    expect(classifyCommunityError(new VelumError('SOURCE_UNAVAILABLE', 'timeout'))).toBe('unavailable');
    expect(classifyCommunityError(new Error('Network request failed'))).toBe('unavailable');
    expect(classifyCommunityError(new VelumError('INVALID_INPUT', 'x'))).toBe('generic');
  });
});

describe('cache local', () => {
  it('upsertEntry insère en tête ou remplace en place ; removeEntry retire', () => {
    const updated = { ...PRADEAUX, priority: 'high' as const };
    expect(upsertEntry([TEMPIER, PRADEAUX], updated).map((e) => [e.id, e.priority])).toEqual([
      ['w1', 'high'],
      ['w2', 'high'],
    ]);
    expect(upsertEntry([TEMPIER], JURA).map((e) => e.id)).toEqual(['w3', 'w1']);
    expect(removeEntry([TEMPIER, JURA], 'w1').map((e) => e.id)).toEqual(['w3']);
  });
});

describe('affichage', () => {
  it('formatTargetPrice : centimes seulement s’ils existent, FR et EN', () => {
    const flat = (s: string) => s.replace(/\s/g, ' ');
    expect(flat(formatTargetPrice(60))).toBe('60 €');
    expect(flat(formatTargetPrice(59.9))).toBe('59,90 €');
    expect(flat(formatTargetPrice(1200, 'fr'))).toBe('1 200 €');
    expect(formatTargetPrice(59.9, 'en')).toBe('€59.90');
    expect(formatTargetPrice(60, 'en-US')).toBe('€60');
  });

  it('notesExcerpt : une ligne, coupée sur un mot', () => {
    expect(notesExcerpt(null)).toBeNull();
    expect(notesExcerpt('  \n ')).toBeNull();
    expect(notesExcerpt('Court\net net')).toBe('Court et net');
    expect(notesExcerpt('un deux trois quatre cinq six', 15)).toBe('un deux trois…');
  });

  it('identityDetails : champs connus renseignés, dans l’ordre du domaine', () => {
    expect(identityDetails(TEMPIER)).toEqual([
      { key: 'producer', labelKey: 'candidates.fields.wineProducer', value: 'Domaine Tempier' },
      { key: 'vintage', labelKey: 'candidates.fields.wineVintage', value: '2019' },
      { key: 'appellation', labelKey: 'candidates.fields.wineAppellation', value: 'Bandol' },
    ]);
  });
});

describe('formulaire', () => {
  it('parseTargetPriceInput accepte les saisies françaises et refuse le reste', () => {
    expect(parseTargetPriceInput('')).toEqual({ ok: true, value: null });
    expect(parseTargetPriceInput('59,90')).toEqual({ ok: true, value: 59.9 });
    expect(parseTargetPriceInput('1 200 €')).toEqual({ ok: true, value: 1200 });
    expect(parseTargetPriceInput('12,345')).toEqual({ ok: true, value: 12.35 });
    expect(parseTargetPriceInput('-5')).toEqual({ ok: false });
    expect(parseTargetPriceInput('cher')).toEqual({ ok: false });
  });

  it('formatPriceInput / formFromEntry pré-remplissent l’édition', () => {
    expect(formatPriceInput(59.9)).toBe('59,9');
    expect(formatPriceInput(59.9, '.')).toBe('59.9');
    expect(formatPriceInput(null)).toBe('');
    const form = formFromEntry({ ...TEMPIER, attributes: { ...TEMPIER.attributes, cuvee: 'La Tourtine' } });
    expect(form).toMatchObject({ domain: 'wine', title: 'Domaine Tempier Bandol 2019', targetPrice: '60', priority: 'high' });
    // Seuls les champs PRINCIPAUX sont éditables dans le formulaire.
    expect(form.identity).toEqual({ producer: 'Domaine Tempier', vintage: '2019', appellation: 'Bandol' });
  });

  it('withDomain remet à zéro les champs d’identification', () => {
    const form = { ...emptyWishlistForm('wine'), title: 'Garde', identity: { producer: 'X', vintage: '', appellation: '' } };
    const coin = withDomain(form, 'coin');
    expect(coin.title).toBe('Garde');
    expect(Object.keys(coin.identity)).toEqual(['country', 'type', 'year']);
    expect(withDomain(form, 'wine')).toBe(form);
  });

  it('buildWishlistInput valide et normalise une création', () => {
    const result = buildWishlistInput({
      ...emptyWishlistForm('wine'),
      title: '  Domaine Tempier  ',
      notes: '  pourquoi je l’ai aimé ',
      targetPrice: '60',
      priority: 'high',
      identity: { producer: 'Domaine Tempier', vintage: '2019', appellation: '' },
    });
    expect(result).toEqual({
      ok: true,
      input: {
        domain: 'wine',
        kind: 'wish',
        title: 'Domaine Tempier',
        notes: 'pourquoi je l’ai aimé',
        attributes: { producer: 'Domaine Tempier', vintage: 2019 },
        targetPrice: 60,
        priority: 'high',
      },
    });
  });

  it('buildWishlistInput : titre déduit de l’identification, sinon erreur', () => {
    const fromIdentity = buildWishlistInput({
      ...emptyWishlistForm('coin'),
      identity: { country: 'France', type: '20 Francs Or', year: '1868' },
    });
    expect(fromIdentity.ok && fromIdentity.input.title).toBe('France 20 Francs Or 1868');
    expect(buildWishlistInput(emptyWishlistForm('coin'))).toEqual({
      ok: false,
      errors: { title: 'wishlist.errors.titleRequired' },
    });
  });

  it('buildWishlistInput signale chaque champ invalide', () => {
    const result = buildWishlistInput({
      ...emptyWishlistForm('wine'),
      title: 'x'.repeat(WISHLIST_TITLE_MAX_LENGTH + 1),
      notes: 'n'.repeat(WISHLIST_NOTES_MAX_LENGTH + 1),
      targetPrice: 'beaucoup',
      identity: { producer: '', vintage: 'deux mille', appellation: '' },
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        title: 'wishlist.errors.titleTooLong',
        notes: 'wishlist.errors.notesTooLong',
        targetPrice: 'wishlist.errors.priceInvalid',
        vintage: 'identity.errors.notANumber',
      },
    });
  });

  it('buildWishlistInput en modification : conserve les attributs hors formulaire, pas si la catégorie change', () => {
    const base = {
      domain: 'wine' as const,
      attributes: { producer: 'Old', cuvee: 'La Tourtine', vintage: 2018, analysisStatus: 'pending' },
    };
    const same = buildWishlistInput(
      { ...emptyWishlistForm('wine'), title: 'T', identity: { producer: 'New', vintage: '', appellation: '' } },
      base,
    );
    expect(same.ok && same.input.attributes).toEqual({ producer: 'New', cuvee: 'La Tourtine' });

    const moved = buildWishlistInput(
      { ...emptyWishlistForm('coin'), title: 'T', identity: { country: 'France', type: '', year: '' } },
      base,
    );
    expect(moved.ok && moved.input.attributes).toEqual({ country: 'France' });
  });
});
