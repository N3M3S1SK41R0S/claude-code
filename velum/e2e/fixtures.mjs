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
  heritage: {
    history:
      'Fief historique du mourvèdre à Bandol, sur restanques calcaires face à la Méditerranée. Cuvée de garde façonnée par la même famille depuis l’après-guerre — une référence de l’appellation.',
    rarity: { level: 'peu_courante', note: 'cuvée de propriété, allocation limitée' },
    editionSize: { count: 30000, unit: 'bottles', note: 'production estimée du millésime' },
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
    attributes: {
      country: 'France',
      type: '5 Francs Semeuse',
      year: 1960,
      metal: 'argent 835‰',
      grade: 'SUP',
      analysis: {
        identification: { country: 'France', issuer: 'République française', type: '5 Francs Semeuse', year: 1960, mintMark: 'A', metal: 'argent 835‰', weightGrams: 12, diameterMm: 29, mintage: 20000000 },
        grade: { scale: 'fr', value: 'SUP', confidence: 0.82, caveat: 'Grade visuel — seule une gradation PCGS/NGC fait foi.' },
        rarity: { level: 'courante', note: 'millésime courant, recherché en qualité choisie (SUP/FDC)' },
        varieties: ['Différent corne d’abondance (atelier de Paris)'],
        neighborYears: [{ year: 1959, note: 'Millésime voisin, cote comparable' }, { year: 1969, note: 'Dernière année de frappe du type' }],
        heritage: {
          history:
            "Frappée de 1960 à 1969, la 5 Francs Semeuse en argent 835‰ reprend le célèbre motif de la Semeuse gravé par Oscar Roty en 1897. Émise dès l'introduction du nouveau franc sous la Ve République, elle circula durant les années 1960 avant que sa frappe ne cesse en 1969. Le millésime 1960 correspond à la toute première année d'émission de ce type.",
          rarity: { level: 'courante', note: 'Tirage massif ; valeur portée par la teneur en argent et surtout recherchée en qualité choisie (SUP/FDC).' },
          editionSize: { unit: 'exemplaires', count: 20000000, note: 'Tirage 1960, atelier de Paris (différent corne d’abondance).' },
        },
        uncertainties: ['Niveau de conservation exact à confirmer sous loupe.'],
      },
    },
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
    attributes: {
      attributionQualifier: 'ecole_de',
      technique: 'huile sur toile',
      estimatedPeriod: 'début XXe',
      school: 'École provençale',
      analysis: {
        identification: { attributionQualifier: 'ecole_de', title: 'Paysage aux oliviers', technique: 'huile sur toile', support: 'toile', estimatedPeriod: 'début XXe', school: 'École provençale', signatureDetected: false },
        condition: { summary: 'Bon état général, léger encrassement', issues: ['Vernis oxydé'] },
        provenance: { evidence: ['Collection particulière, Provence'], note: 'Chaîne de possession incomplète.' },
        comparables: [{ description: 'Paysages provençaux aux oliviers, école du début du XXe siècle' }],
        heritage: {
          history:
            "Au tournant du XXe siècle, l'école provençale réunit des peintres attachés à la lumière méditerranéenne et aux paysages ruraux, dans le sillage de l'impressionnisme et du plein air autour de Marseille, Aix et Avignon. Les oliveraies, motif rendu célèbre par Van Gogh à Saint-Rémy, y deviennent un sujet de prédilection largement décliné par de nombreux suiveurs régionaux. Cette huile relève d'une production abondante mais souvent anonyme, d'où une attribution prudente « école de » qui reste à confirmer.",
          rarity: { level: 'inconnue', note: 'Attribution « école de » non ferme ; valeur conditionnée par une expertise confirmant l’auteur.' },
          editionSize: { unit: 'unique', note: 'Œuvre unique, huile sur toile.' },
        },
        uncertainties: ['Attribution « école de » non ferme — expertise requise pour toute valeur significative.'],
        expertiseRecommended: true,
      },
    },
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
    attributes: {
      country: 'France',
      catalog: 'yvert_tellier',
      catalogNumber: 'YT 130',
      year: 1903,
      condition: 'neuf_avec_charniere',
      analysis: {
        identification: { country: 'France', catalog: 'yvert_tellier', catalogNumber: 'YT 130', title: 'Semeuse lignée 15c vert', year: 1903, faceValue: '15c', color: 'vert', perforation: '14 × 13½', printingMethod: 'typographie' },
        condition: { status: 'neuf_avec_charniere', gum: 'intacte', centering: 'bon', faults: [], confidence: 0.78, caveat: 'Estimation visuelle — une expertise fait foi pour les fortes valeurs.' },
        rarity: { level: 'courante', note: 'usuel à fort tirage ; variétés de dentelure plus rares' },
        varieties: ['Nuances de vert', 'Variétés de dentelure'],
        neighborIssues: [{ catalogNumber: 'YT 137', note: 'Semeuse camée, type voisin' }],
        heritage: {
          history:
            "Créé par le graveur Louis-Oscar Roty à partir de son allégorie de la Semeuse déjà présente sur les monnaies de la IIIe République, ce type dit « lignée » (fond de fines lignes horizontales) est mis en circulation à partir de 1903, gravé pour la poste par Louis-Eugène Mouchon. La valeur 15c vert compte parmi les usuels les plus répandus de la Belle Époque. Son très fort tirage en fait aujourd'hui un timbre abondant, seules certaines variétés de dentelure ou de nuance étant recherchées.",
          rarity: { level: 'courante', note: 'Usuel à très fort tirage ; seules les variétés de dentelure ou nuances rares atteignent une cote supérieure.' },
          editionSize: { unit: 'stamps', count: 120000000, note: 'Tirage estimé très important (usage courant), typographie — Atelier du timbre de Paris.' },
        },
        uncertainties: ['Dentelure et gomme à vérifier au dentimètre.'],
      },
    },
    confidence: 0.88,
    acquired_at: '2022-11-20',
    acquired_price: 8,
    condition: 'neuf avec charnière',
    notes: null,
    storage_location: 'Album 1 — page 12',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'demo-watch',
    owner_id: OWNER,
    domain: 'watch',
    title: 'Omega Speedmaster Professional 3570.50',
    attributes: {
      brand: 'Omega',
      model: 'Speedmaster Professional',
      reference: '3570.50',
      year: 1998,
      analysis: {
        identification: { brand: 'Omega', model: 'Speedmaster Professional', reference: '3570.50', year: 1998, gender: 'homme', caseMaterial: 'acier', caseDiameterMm: 42, dialColor: 'noir', bracelet: 'acier', crystal: 'hésalite (plexiglas)', waterResistanceM: 50, boxPapers: 'montre_seule' },
        movement: { type: 'manuel', calibre: 'Omega 1861', powerReserveHours: 48, frequencyVph: 21600, jewels: 18, complications: ['chronographe', 'petite seconde'], certification: 'qualifiée NASA pour les vols habités' },
        condition: { summary: 'Bel état général, patine homogène du boîtier.', polished: 'leger', issues: ['rayures superficielles sur le verre'], confidence: 0.7, caveat: 'Estimation visuelle — seul un horloger ouvrant le boîtier peut attester du mouvement et de l’authenticité.' },
        story: {
          why: 'Chronographe conçu en 1957 pour la course automobile et l’ingénierie, devenu la montre des missions Apollo après les tests de qualification de la NASA.',
          byWhom: 'Omega — calibre chronographe développé avec Lemania (321, puis 861/1861).',
          modelLaunchYear: 1957,
          milestones: [
            { year: 1965, note: 'Qualifiée par la NASA pour tous les vols spatiaux habités' },
            { year: 1969, note: 'Première montre portée sur la Lune (Apollo 11)' },
          ],
        },
        heritage: {
          history:
            'La « Moonwatch » : lancée en 1957 dans la trilogie des montres professionnelles Omega, elle accompagne toutes les missions Apollo à partir de 1965. Production continue depuis, ce qui en fait l’un des chronographes les plus documentés du marché de collection.',
          rarity: { level: 'courante', note: 'Grande série ; références anciennes, cadrans particuliers et full sets recherchés.' },
          editionSize: { unit: 'exemplaires', note: 'Production continue, non limitée.' },
        },
        neighborReferences: [{ reference: '145.022', note: 'Génération calibre 861 précédente, cote proche' }],
        uncertainties: ['Référence et année exactes à confirmer par le numéro de série (fond de boîte).'],
      },
    },
    confidence: 0.84,
    acquired_at: '2021-03-15',
    acquired_price: 3200,
    condition: 'bel état, révisée en 2023',
    notes: null,
    storage_location: 'Écrin — emplacement 1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-06-15T00:00:00Z',
  },
];

export const VALUATIONS = {
  'demo-wine': [
    { id: 'v1', item_id: 'demo-wine', central: 51, ci80_low: 45, ci80_high: 58, ci95_low: 42, ci95_high: 63, reliability: 81, valued_at: '2026-07-03T00:00:00Z',
      sources: [
        { price: 58, currency: 'EUR', ageDays: 12, sourceWeight: 1, source: { name: 'iDealwine', kind: 'auction_realized' }, matchedLabel: 'Bandol Domaine Tempier 2016 — lot 2 bt.' },
        { price: 54, currency: 'EUR', ageDays: 40, sourceWeight: 0.9, source: { name: 'Wine-Searcher', kind: 'official_quote' }, matchedLabel: 'Bandol Tempier 2016 (cote marchande)' },
        { price: 49, currency: 'EUR', ageDays: 76, sourceWeight: 0.7, source: { name: 'eBay (vendu)', kind: 'marketplace_sold' }, matchedLabel: 'Domaine Tempier Bandol 2016' },
        { price: 62, currency: 'EUR', ageDays: 128, sourceWeight: 1, source: { name: 'iDealwine', kind: 'auction_realized' }, matchedLabel: 'Bandol Tempier 2016 — caisse bois' },
      ] },
    { id: 'v2', item_id: 'demo-wine', central: 46, ci80_low: 41, ci80_high: 52, ci95_low: 38, ci95_high: 57, reliability: 78, sources: [], valued_at: '2026-04-05T00:00:00Z' },
    { id: 'v3', item_id: 'demo-wine', central: 42, ci80_low: 38, ci80_high: 47, ci95_low: 35, ci95_high: 52, reliability: 74, sources: [], valued_at: '2026-01-05T00:00:00Z' },
  ],
  'demo-coin': [
    { id: 'v4', item_id: 'demo-coin', central: 14, ci80_low: 11, ci80_high: 18, ci95_low: 9, ci95_high: 22, reliability: 55, valued_at: '2026-06-10T00:00:00Z',
      sources: [
        { price: 15, currency: 'EUR', ageDays: 45, sourceWeight: 1, source: { name: 'CGB Numismatique Paris', kind: 'auction_realized' }, matchedLabel: '5 Francs Semeuse argent 1960, atelier de Paris, SUP' },
        { price: 13, currency: 'EUR', ageDays: 210, sourceWeight: 0.9, source: { name: 'Numista', kind: 'official_quote' }, matchedLabel: '5 Francs Semeuse argent 1960 — cote catalogue état SUP' },
        { price: 12, currency: 'EUR', ageDays: 90, sourceWeight: 0.7, source: { name: 'eBay (vendu)', kind: 'marketplace_sold' }, matchedLabel: 'Pièce 5 Francs Semeuse argent 1960 TTB/SUP (vendue)' },
        { price: 18, currency: 'EUR', ageDays: 15, sourceWeight: 0.4, source: { name: 'Catawiki', kind: 'listing' }, matchedLabel: '5 Francs Semeuse 1960 argent, qualité collection (annonce en cours)' },
      ] },
  ],
  'demo-art': [
    { id: 'v5', item_id: 'demo-art', central: 620, ci80_low: 480, ci80_high: 780, ci95_low: 350, ci95_high: 1100, reliability: 48, valued_at: '2026-05-02T00:00:00Z',
      sources: [
        { price: 650, currency: 'EUR', ageDays: 45, sourceWeight: 1, source: { name: 'Drouot', kind: 'auction_realized' }, matchedLabel: 'École provençale, début XXe s. — Paysage aux oliviers, huile sur toile (adjugé, frais compris)' },
        { price: 580, currency: 'EUR', ageDays: 120, sourceWeight: 1, source: { name: 'Millon', kind: 'auction_realized' }, matchedLabel: 'Attribué à l’école de Provence — Oliviers dans la lumière du Midi, huile sur toile' },
        { price: 620, currency: 'EUR', ageDays: 210, sourceWeight: 0.9, source: { name: 'Artprice', kind: 'official_quote' }, matchedLabel: 'Cote indicative — paysage provençal aux oliviers, école début XXe' },
        { price: 690, currency: 'EUR', ageDays: 30, sourceWeight: 0.7, source: { name: 'Catawiki', kind: 'marketplace_sold' }, matchedLabel: 'Paysage aux oliviers, école provençale début XXe — huile sur toile (vendu)' },
        { price: 540, currency: 'EUR', ageDays: 260, sourceWeight: 0.7, source: { name: 'eBay (vendu)', kind: 'marketplace_sold' }, matchedLabel: 'Huile sur toile — oliviers en Provence, école début XXe, cadre bois doré (vendu)' },
      ] },
  ],
  'demo-stamp': [
    { id: 'v6', item_id: 'demo-stamp', central: 9, ci80_low: 7, ci80_high: 12, ci95_low: 5, ci95_high: 16, reliability: 52, valued_at: '2026-04-02T00:00:00Z',
      sources: [
        { price: 11, currency: 'EUR', ageDays: 62, sourceWeight: 1, source: { name: 'Catawiki', kind: 'auction_realized' }, matchedLabel: 'France 1903 — Semeuse lignée 15c vert (Y&T n°130), neuf charnière (adjugé)' },
        { price: 8, currency: 'EUR', ageDays: 28, sourceWeight: 0.7, source: { name: 'Delcampe (vendu)', kind: 'marketplace_sold' }, matchedLabel: 'Semeuse lignée 15c vert YT 130 neuf* charnière TB (vendu)' },
        { price: 7.5, currency: 'EUR', ageDays: 134, sourceWeight: 0.7, source: { name: 'eBay (vendu)', kind: 'marketplace_sold' }, matchedLabel: 'France n°130 Semeuse 15c vert neuf charnière (*) — lot vendu' },
        { price: 10, currency: 'EUR', ageDays: 221, sourceWeight: 0.9, source: { name: 'Yvert & Tellier', kind: 'official_quote' }, matchedLabel: 'Cote catalogue Y&T n°130 — Semeuse lignée 15c vert, neuf avec charnière (*)' },
        { price: 9, currency: 'EUR', ageDays: 301, sourceWeight: 0.9, source: { name: 'Colnect', kind: 'official_quote' }, matchedLabel: 'Valeur estimée Semeuse lignée 15c vert (Y&T 130), neuf avec charnière' },
      ] },
  ],
  'demo-watch': [
    { id: 'v7', item_id: 'demo-watch', central: 4250, ci80_low: 3900, ci80_high: 4650, ci95_low: 3600, ci95_high: 5100, reliability: 72, valued_at: '2026-06-20T00:00:00Z',
      sources: [
        { price: 4380, currency: 'EUR', ageDays: 21, sourceWeight: 1, source: { name: 'Heritage Auctions', kind: 'auction_realized' }, matchedLabel: 'Omega Speedmaster Professional 3570.50, 1998 — adjugé, frais compris' },
        { price: 4200, currency: 'EUR', ageDays: 9, sourceWeight: 0.9, source: { name: 'WatchCharts', kind: 'official_quote' }, matchedLabel: 'Cote de marché — Speedmaster Professional 3570.50, montre seule' },
        { price: 4050, currency: 'EUR', ageDays: 47, sourceWeight: 0.7, source: { name: 'eBay (vendu)', kind: 'marketplace_sold' }, matchedLabel: 'Omega Speedmaster Moonwatch 3570.50 calibre 1861 (vendu)' },
        { price: 4450, currency: 'EUR', ageDays: 88, sourceWeight: 0.7, source: { name: 'Catawiki', kind: 'marketplace_sold' }, matchedLabel: 'Omega — Speedmaster Professional — 3570.50 — Homme — 1990-1999 (adjugé)' },
        { price: 4790, currency: 'EUR', ageDays: 3, sourceWeight: 0.4, source: { name: 'Chrono24', kind: 'listing' }, matchedLabel: 'Speedmaster Professional 3570.50 full set (annonce en cours)' },
      ] },
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

// Communauté : deux annonces actives d'AUTRES vendeurs (achetables) + aucune
// commande en cours. Titres/domaines dénormalisés (migration 0006).
export const LISTINGS = [
  { id: 'lst-1', item_id: 'x1', seller_id: '22222222-2222-4222-8222-222222222222', ask_price: 320, currency: 'EUR', status: 'active', title: 'Napoléon III 20 Francs Or 1868', domain: 'coin', created_at: '2026-07-08T00:00:00Z' },
  { id: 'lst-2', item_id: 'x2', seller_id: '33333333-3333-4333-8333-333333333333', ask_price: 780, currency: 'EUR', status: 'active', title: 'Bloc CITEX 1949 neuf — authentifié', domain: 'stamp', created_at: '2026-07-03T00:00:00Z' },
];
export const ORDERS = [];

/** Signal d'arbitre (Edge `arbiter`) — verdict de démonstration réaliste. */
export const ARBITER = {
  verdict: 'drink',
  confidence: 0.55,
  trend: 'flat',
  sellWindow: false,
  reasons: [
    'À son apogée (fenêtre 2022–2032) — à boire.',
    'Tendance de valeur non séparée de plat : pas de signal de vente (anti-faux-signal).',
  ],
};

/** Dernier run de calibration publié (table calibration_runs, maybeSingle). */
export const CALIBRATION_RUN = {
  domain: 'wine',
  n: 124,
  coverage80: 0.81,
  coverage95: 0.95,
  status: 'well_calibrated',
  computed_at: '2026-07-15T06:00:00Z',
};
