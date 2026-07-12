/**
 * Fixtures PostgREST (colonnes snake_case, comme renvoyées par Supabase) pour
 * rendre les écrans authentifiés hors-ligne dans Playwright. Alignées sur
 * supabase/seed.sql : compte Platine, un objet par module, le vin porte son
 * analyse ZAPPA (apogée + accords) pour activer carnet, « à boire » et fiche.
 */
const OWNER = '11111111-1111-4111-8111-111111111111';

export const WINE_ANALYSIS = {
  identification: {
    producer: 'Domaine Tempier',
    winemaker: 'Daniel Ravier',
    appellation: 'Bandol',
    vintage: 2016,
    color: 'rouge',
    region: 'Provence',
    country: 'France',
    grapes: [{ name: 'Mourvèdre', percent: 75 }, { name: 'Grenache', percent: 15 }],
  },
  tasting: {
    robe: 'Grenat profond aux reflets tuilés',
    nose: ['garrigue', 'fruits noirs', 'épices', 'cuir'],
    noseFirst: ['fruits noirs', 'mûre', 'violette'],
    noseSecond: ['garrigue', 'cuir', 'tabac blond'],
    palate: { structure: 'ample', tannins: 'fondus', acidity: 'fraîche', alcohol: '14 %' },
    palateAttack: 'Ample et charnue, sur le fruit mûr',
    palateEvolution: 'Évolue sur les épices douces et la réglisse, finale légèrement saline',
    length: 'longue (18 caudalies)',
    cellarTemperatureC: [12, 14],
    serviceTemperatureC: [16, 18],
    decanting: { recommended: true, durationMinutes: 60, note: 'Ouvre le second nez sur la garrigue.' },
    agingPotentialYears: [8, 20],
    drinkWindow: { from: 2022, to: 2032 },
  },
  ratings: { rvf: '16,5/20', bettaneDesseauve: '16/20', positioning: 'classique' },
  market: { averagePriceEUR: 51, marketTension: 'moyenne', speculativeScore: 6, assetClass: 'cave' },
  comparisons: {
    foodPairings: ['gigot d’agneau aux herbes', 'daube provençale', 'fromages affinés'],
    regionalEquivalents: ['Château Pradeaux', 'La Bastide Blanche'],
    neighborVintages: [{ vintage: 2015, note: 'Solaire, plus opulent' }],
  },
  uncertainties: ['Niveau et conservation de la bouteille non vérifiés.'],
};

// Deuxième vin (Bourgogne blanc) : donne à la cave ≥ 2 bouteilles pour la
// dégustation à l'aveugle. Fenêtre d'apogée FUTURE (2028+) → n'entre pas dans
// « à boire », donc n'altère pas les captures existantes.
export const WINE_ANALYSIS_2 = {
  identification: {
    producer: 'Domaine Leflaive',
    winemaker: 'Pierre Vincent',
    appellation: 'Puligny-Montrachet',
    vintage: 2020,
    color: 'blanc',
    region: 'Bourgogne',
    country: 'France',
    grapes: [{ name: 'Chardonnay', percent: 100 }],
  },
  tasting: {
    robe: 'Or pâle aux reflets verts',
    nose: ['agrumes', 'fleurs blanches', 'noisette', 'silex'],
    noseFirst: ['citron', 'aubépine'],
    noseSecond: ['noisette', 'beurre frais', 'silex'],
    palate: { structure: 'tendue', acidity: 'vive', alcohol: '13 %' },
    palateAttack: 'Vive et saline',
    palateEvolution: 'Gagne en gras sur un milieu de bouche minéral, finale sur les agrumes confits',
    length: 'longue',
    cellarTemperatureC: [11, 13],
    serviceTemperatureC: [12, 14],
    decanting: { recommended: false, note: 'À servir directement, frais.' },
    agingPotentialYears: [5, 15],
    drinkWindow: { from: 2028, to: 2038 },
  },
  ratings: { rvf: '17/20', positioning: 'collector' },
  market: { averagePriceEUR: 180, marketTension: 'forte', speculativeScore: 8, assetClass: 'collection' },
  comparisons: {
    foodPairings: ['homard', 'volaille à la crème', 'fromages de chèvre'],
    regionalEquivalents: ['Domaine Sauzet', 'Étienne Sauzet'],
  },
  uncertainties: ['Provenance et conservation à confirmer.'],
};

export const PROFILE = {
  id: OWNER,
  display_name: 'Compte Démo VELUM',
  locale: 'fr',
  a11y_mode: false,
  plan: 'platine',
  created_at: '2024-01-01T00:00:00Z',
};

export const ITEMS = [
  {
    id: 'demo-wine',
    owner_id: OWNER,
    domain: 'wine',
    title: 'Bandol Domaine Tempier 2016',
    attributes: {
      producer: 'Domaine Tempier',
      appellation: 'Bandol',
      vintage: 2016,
      color: 'rouge',
      region: 'Provence',
      analysis: WINE_ANALYSIS,
    },
    confidence: 0.94,
    acquired_at: '2019-06-15',
    acquired_price: 38,
    condition: 'excellent',
    notes: null,
    storage_location: 'Cave — casier B3',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'demo-wine-2',
    owner_id: OWNER,
    domain: 'wine',
    title: 'Puligny-Montrachet Leflaive 2020',
    attributes: {
      producer: 'Domaine Leflaive',
      appellation: 'Puligny-Montrachet',
      vintage: 2020,
      color: 'blanc',
      region: 'Bourgogne',
      analysis: WINE_ANALYSIS_2,
    },
    confidence: 0.9,
    acquired_at: '2022-05-01',
    acquired_price: 150,
    condition: 'excellent',
    notes: null,
    storage_location: 'Cave — casier A1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-06-15T00:00:00Z',
  },
  {
    id: 'demo-coin',
    owner_id: OWNER,
    domain: 'coin',
    title: '5 Francs Semeuse argent 1960',
    attributes: { country: 'France', type: '5 Francs Semeuse', year: 1960, metal: 'argent 835‰', grade: 'SUP' },
    confidence: 0.91,
    acquired_at: '2021-03-10',
    acquired_price: 12,
    condition: 'SUP',
    notes: null,
    storage_location: 'Médaillier — plateau 2',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'demo-art',
    owner_id: OWNER,
    domain: 'art',
    title: 'École provençale — Paysage aux oliviers',
    attributes: { attributionQualifier: 'ecole_de', technique: 'huile sur toile', estimatedPeriod: 'début XXe', school: 'École provençale' },
    confidence: 0.62,
    acquired_at: '2020-09-01',
    acquired_price: 450,
    condition: 'bon état',
    notes: null,
    storage_location: 'Salon',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'demo-stamp',
    owner_id: OWNER,
    domain: 'stamp',
    title: 'Semeuse lignée 15c vert — YT 130',
    attributes: { country: 'France', catalog: 'yvert_tellier', catalogNumber: 'YT 130', year: 1903, condition: 'neuf_avec_charniere' },
    confidence: 0.88,
    acquired_at: '2022-11-20',
    acquired_price: 8,
    condition: 'neuf avec charnière',
    notes: null,
    storage_location: 'Album 1 — page 12',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  },
];

export const VALUATIONS = {
  'demo-wine': [
    { id: 'v1', item_id: 'demo-wine', central: 51, ci80_low: 45, ci80_high: 58, ci95_low: 42, ci95_high: 63, reliability: 81, sources: [], valued_at: '2026-07-03T00:00:00Z' },
    { id: 'v2', item_id: 'demo-wine', central: 46, ci80_low: 41, ci80_high: 52, ci95_low: 38, ci95_high: 57, reliability: 78, sources: [], valued_at: '2026-04-05T00:00:00Z' },
    { id: 'v3', item_id: 'demo-wine', central: 42, ci80_low: 38, ci80_high: 47, ci95_low: 35, ci95_high: 52, reliability: 74, sources: [], valued_at: '2026-01-05T00:00:00Z' },
  ],
  'demo-coin': [
    { id: 'v4', item_id: 'demo-coin', central: 14, ci80_low: 11, ci80_high: 18, ci95_low: 9, ci95_high: 22, reliability: 55, sources: [], valued_at: '2026-06-10T00:00:00Z' },
  ],
  'demo-art': [
    { id: 'v5', item_id: 'demo-art', central: 620, ci80_low: 480, ci80_high: 780, ci95_low: 350, ci95_high: 1100, reliability: 48, sources: [], valued_at: '2026-05-02T00:00:00Z' },
  ],
  'demo-stamp': [
    { id: 'v6', item_id: 'demo-stamp', central: 9, ci80_low: 7, ci80_high: 12, ci95_low: 5, ci95_high: 16, reliability: 52, sources: [], valued_at: '2026-04-02T00:00:00Z' },
  ],
};

export const ALERTS = [
  { id: 'a1', item_id: 'demo-wine', type: 'drink_window', config: {}, active: true },
  { id: 'a2', item_id: 'demo-coin', type: 'price_threshold', config: { direction: 'above', thresholdEUR: 20 }, active: true },
];

export const NOTIFICATIONS = [
  { id: 'n1', title: 'À boire — apogée atteinte', body: 'Bandol Domaine Tempier 2016 est dans sa fenêtre de consommation optimale (jusqu’en 2032). Accord suggéré : gigot d’agneau aux herbes.', created_at: '2026-07-04T09:00:00Z' },
];

/**
 * Session Supabase factice à semer dans le stockage web avant le boot, pour
 * que `useSession()` soit truthy (certains écrans, comme Profil, gardent
 * leurs requêtes derrière `enabled: session !== null`). expires_at en 2100
 * pour éviter tout rafraîchissement réseau.
 */
export const SESSION = {
  access_token: 'demo-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'demo-refresh-token',
  user: {
    id: OWNER,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@velum.app',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'Compte Démo VELUM', locale: 'fr' },
    created_at: '2024-01-01T00:00:00Z',
  },
};

export const PAIRING = {
  recommendations: [
    { itemId: 'demo-wine', label: 'Bandol Domaine Tempier 2016', score: 0.93, reasoning: 'Le mourvèdre puissant et la garrigue épousent le gras du magret ; les tanins fondus tiennent tête aux figues.', serveAt: '17 °C, carafé 1 h' },
  ],
  fallbackAdvice: undefined,
};
