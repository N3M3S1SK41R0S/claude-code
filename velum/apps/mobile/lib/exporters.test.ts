import { describe, expect, it } from 'vitest';
import type { AnalysisResult, ValuationRecord, VelumItem } from '@velum/core';
import {
  buildBlindTastingHtml,
  buildCellarShareHtml,
  buildCollectionCsv,
  buildInsuranceReportHtml,
  buildItemSheetHtml,
  CSV_HEADERS,
  escapeCsvField,
  escapeHtml,
} from './exporters';
import { buildBlindTastingSession } from '@velum/domain-wine';

/** Traducteur factice : renvoie la clé (suffisant pour tester la structure). */
const t = (key: string, options?: Record<string, unknown>): string =>
  options ? `${key}:${JSON.stringify(options)}` : key;

function makeItem(overrides: Partial<VelumItem> = {}): VelumItem {
  return {
    id: 'itm-1',
    ownerId: 'usr-1',
    domain: 'wine',
    title: 'Château Margaux 2015',
    attributes: { vintage: 2015, producer: 'Château Margaux' },
    confidence: 0.92,
    acquiredAt: '2020-06-01',
    acquiredPrice: 450,
    condition: 'excellent',
    notes: null,
    storageLocation: 'Cave A',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function makeValuation(overrides: Partial<ValuationRecord> = {}): ValuationRecord {
  return {
    id: 'val-1',
    itemId: 'itm-1',
    central: 620,
    ci80Low: 540,
    ci80High: 700,
    ci95Low: 480,
    ci95High: 760,
    reliability: 78,
    sources: [
      {
        price: 610,
        currency: 'EUR',
        ageDays: 12,
        sourceWeight: 1,
        source: { name: 'Drouot', kind: 'auction_realized' },
      },
    ],
    valuedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

const analysis: AnalysisResult = {
  engine: 'zappa_vini',
  payload: {},
  confidence: 0.9,
  sources: [{ name: 'Wine-Searcher', kind: 'official_quote' }],
  disclaimers: ['Estimation indicative'],
};

describe('escapeCsvField', () => {
  it('laisse intactes les valeurs simples', () => {
    expect(escapeCsvField('simple')).toBe('simple');
  });

  it('encadre et double les guillemets', () => {
    expect(escapeCsvField('dit "grand" vin')).toBe('"dit ""grand"" vin"');
  });

  it('encadre les valeurs contenant des virgules', () => {
    expect(escapeCsvField('rouge, corsé')).toBe('"rouge, corsé"');
  });

  it('encadre les retours à la ligne', () => {
    expect(escapeCsvField('ligne1\nligne2')).toBe('"ligne1\nligne2"');
  });
});

describe('escapeHtml', () => {
  it('échappe les caractères dangereux', () => {
    expect(escapeHtml('<b>"vin" & co</b>')).toBe('&lt;b&gt;&quot;vin&quot; &amp; co&lt;/b&gt;');
  });
});

describe('buildCollectionCsv', () => {
  it('produit un en-tête stable puis une ligne par objet', () => {
    const csv = buildCollectionCsv([makeItem()]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CSV_HEADERS.join(','));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Château Margaux 2015');
    expect(lines[1]).toContain('wine');
  });

  it('échappe virgules et guillemets dans les champs', () => {
    const csv = buildCollectionCsv([
      makeItem({ title: 'Vin "rare", millésimé', notes: 'à boire, vite' }),
    ]);
    const dataLine = csv.split('\n')[1] ?? '';
    expect(dataLine).toContain('"Vin ""rare"", millésimé"');
    expect(dataLine).toContain('"à boire, vite"');
  });

  it('gère la collection vide (en-tête seul)', () => {
    expect(buildCollectionCsv([])).toBe(CSV_HEADERS.join(','));
  });
});

describe('buildItemSheetHtml', () => {
  it('contient les sections clés : titre, domaine, attributs, valorisation, disclaimer', () => {
    const html = buildItemSheetHtml(makeItem(), analysis, makeValuation(), t);
    expect(html).toContain('export.sheetTitle');
    expect(html).toContain('Château Margaux 2015');
    expect(html).toContain('export.attributes');
    expect(html).toContain('export.valuation');
    expect(html).toContain('export.central');
    expect(html).toContain('Drouot');
    expect(html).toContain('export.disclaimer');
    expect(html).toContain('zappa_vini');
  });

  it('échappe le HTML injecté dans le titre', () => {
    const html = buildItemSheetHtml(makeItem({ title: '<script>x</script>' }), null, null, t);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('affiche « non valorisé » sans valorisation', () => {
    const html = buildItemSheetHtml(makeItem(), null, null, t);
    expect(html).toContain('export.noValuation');
  });
});

describe('buildCellarShareHtml', () => {
  it('rend un snapshot lecture seule : vins, valeur totale, avertissement', () => {
    const wines = [
      makeItem({ id: 'w1', title: 'Bandol 2016', attributes: { region: 'Provence', vintage: 2016 }, storageLocation: 'Casier B3' }),
      makeItem({ id: 'w2', title: 'Puligny 2020', attributes: { region: 'Bourgogne', vintage: 2020 }, storageLocation: null }),
    ];
    const latest = { w1: makeValuation({ itemId: 'w1', central: 50 }), w2: null };
    const html = buildCellarShareHtml(wines, latest, t, '2026-07-12T00:00:00Z');
    expect(html).toContain('cellarShare.title');
    expect(html).toContain('Bandol 2016');
    expect(html).toContain('Provence');
    expect(html).toContain('Puligny 2020');
    expect(html).toContain('cellarShare.total');
    expect(html).toContain('cellarShare.disclaimer');
    expect(html).toContain('2026-07-12');
  });

  it('échappe le HTML injecté dans un titre de vin', () => {
    const html = buildCellarShareHtml([makeItem({ title: '<script>x</script>' })], {}, t);
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('buildBlindTastingHtml', () => {
  const cave = [
    { itemId: 'a', label: 'Bandol Tempier', vintage: 2018 },
    { itemId: 'b', label: 'Sancerre Vacheron', vintage: 2022 },
  ];

  it('rend une carte par bouteille avec le déroulé guidé et une page de réponses', () => {
    const session = buildBlindTastingSession(cave, { seed: 5 });
    const html = buildBlindTastingHtml(session, t);
    expect(html).toContain('blind.sheetTitle');
    expect(html).toContain('blind.wineNumber');
    expect(html).toContain('blind.steps.robe');
    expect(html).toContain('blind.steps.guessRegion');
    expect(html).toContain('blind.answersTitle');
    // Les réponses (noms des bouteilles) figurent sur la page de réponses.
    expect(html).toContain('Bandol Tempier');
    expect(html).toContain('Sancerre Vacheron');
    expect(html).toContain('blind.sheetDisclaimer');
  });

  it('échappe le HTML injecté dans un libellé de bouteille', () => {
    const session = buildBlindTastingSession([{ itemId: 'x', label: '<script>x</script>' }], {
      seed: 1,
    });
    const html = buildBlindTastingHtml(session, t);
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('buildInsuranceReportHtml', () => {
  it('contient méthodologie §7, date, total et sources', () => {
    const html = buildInsuranceReportHtml(
      [{ item: makeItem(), valuation: makeValuation() }],
      t,
      '2026-07-10T12:00:00Z',
    );
    expect(html).toContain('export.insuranceTitle');
    expect(html).toContain('export.methodologyTitle');
    expect(html).toContain('export.methodology');
    expect(html).toContain('2026-07-10');
    expect(html).toContain('export.totalTitle');
    expect(html).toContain('Drouot (auction_realized)');
    expect(html).toContain('export.disclaimer');
  });

  it('additionne les valeurs centrales et ignore les objets non valorisés', () => {
    const html = buildInsuranceReportHtml(
      [
        { item: makeItem(), valuation: makeValuation({ central: 1000 }) },
        { item: makeItem({ id: 'itm-2', title: 'Pièce' }), valuation: null },
      ],
      t,
    );
    expect(html).toContain('export.noValuation');
    // 1000 € formaté fr-FR (espace insécable) : on vérifie la présence du montant.
    expect(html.replace(/[  \s]/g, '')).toContain('1000€');
  });
});
