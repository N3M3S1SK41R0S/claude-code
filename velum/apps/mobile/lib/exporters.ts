/**
 * Exports PURS (testés par vitest) : fiche objet HTML (→ PDF via expo-print),
 * rapport assurance/succession HTML, CSV de collection. Aucune dépendance
 * React Native ici — uniquement des chaînes.
 */
import type { AnalysisResult, ValuationRecord, VelumItem } from '@velum/core';

/** Fonction de traduction minimale (compatible TFunction i18next). */
export type Translator = (key: string, options?: Record<string, unknown>) => string;

// ── Helpers purs ─────────────────────────────────────────────────────────────

/** Échappe une valeur pour insertion dans du HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Échappe un champ CSV : encadre si virgule, guillemet ou retour ligne. */
export function escapeCsvField(value: string): string {
  if (/[",\n\r;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function baseStyles(): string {
  return `
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; color: #14090B; margin: 32px; }
      h1 { color: #7A2230; border-bottom: 2px solid #C9A227; padding-bottom: 8px; }
      h2 { color: #7A2230; margin-top: 24px; }
      table { border-collapse: collapse; width: 100%; margin-top: 8px; }
      th, td { border: 1px solid #CBBFA9; padding: 6px 10px; text-align: left; font-size: 13px; }
      th { background: #F2E7D5; }
      .disclaimer { margin-top: 24px; padding: 12px; border: 1px solid #C9A227; background: #FBF6EC; font-size: 12px; }
      .meta { color: #6b5f4d; font-size: 12px; }
    </style>`;
}

function renderAttributeRows(attributes: Record<string, unknown>): string {
  return Object.entries(attributes)
    .filter(([key, value]) => key !== 'analysis' && value !== null && typeof value !== 'object')
    .map(
      ([key, value]) =>
        `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`,
    )
    .join('\n');
}

function renderValuationBlock(valuation: ValuationRecord, t: Translator): string {
  return `
  <h2>${escapeHtml(t('export.valuation'))}</h2>
  <table>
    <tr><th>${escapeHtml(t('export.central'))}</th><td>${escapeHtml(formatEUR(valuation.central))}</td></tr>
    <tr><th>${escapeHtml(t('export.ci80'))}</th><td>${escapeHtml(`${formatEUR(valuation.ci80Low)} – ${formatEUR(valuation.ci80High)}`)}</td></tr>
    <tr><th>${escapeHtml(t('export.ci95'))}</th><td>${escapeHtml(`${formatEUR(valuation.ci95Low)} – ${formatEUR(valuation.ci95High)}`)}</td></tr>
    <tr><th>${escapeHtml(t('export.reliability'))}</th><td>${escapeHtml(`${Math.round(valuation.reliability)} / 100`)}</td></tr>
  </table>
  <h2>${escapeHtml(t('export.sources'))}</h2>
  <table>
    ${valuation.sources
      .map(
        (obs) =>
          `<tr><td>${escapeHtml(obs.source.name)}</td><td>${escapeHtml(obs.source.kind)}</td><td>${escapeHtml(formatEUR(obs.price))}</td></tr>`,
      )
      .join('\n')}
  </table>`;
}

// ── Fiche objet (→ PDF) ──────────────────────────────────────────────────────

export function buildItemSheetHtml(
  item: VelumItem,
  analysis: AnalysisResult | null,
  valuation: ValuationRecord | null,
  t: Translator,
): string {
  const title = item.title ?? t('common.unknown');
  const analysisBlock = analysis
    ? `
  <h2>${escapeHtml(t('export.analysis'))}</h2>
  <p class="meta">${escapeHtml(analysis.engine)}</p>
  ${
    analysis.disclaimers.length > 0
      ? `<ul>${analysis.disclaimers.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
      : ''
  }`
    : '';

  return `
${baseStyles()}
<h1>${escapeHtml(t('export.sheetTitle'))} — ${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(t('export.generatedAt', { date: new Date().toISOString().slice(0, 10) }))}</p>
<table>
  <tr><th>${escapeHtml(t('export.domain'))}</th><td>${escapeHtml(t(`domains.${item.domain}.name`))}</td></tr>
  <tr><th>${escapeHtml(t('export.confidence'))}</th><td>${escapeHtml(
    item.confidence === null ? t('common.unknown') : `${Math.round(item.confidence * 100)} %`,
  )}</td></tr>
</table>
<h2>${escapeHtml(t('export.attributes'))}</h2>
<table>
${renderAttributeRows(item.attributes)}
</table>
${analysisBlock}
${valuation ? renderValuationBlock(valuation, t) : `<p>${escapeHtml(t('export.noValuation'))}</p>`}
<div class="disclaimer">${escapeHtml(t('export.disclaimer'))}</div>
`;
}

// ── Rapport assurance / succession ──────────────────────────────────────────

export interface InsuranceEntry {
  item: VelumItem;
  valuation: ValuationRecord | null;
}

export function buildInsuranceReportHtml(
  entries: InsuranceEntry[],
  t: Translator,
  generatedAtIso: string = new Date().toISOString(),
): string {
  const total = entries.reduce((sum, e) => sum + (e.valuation?.central ?? 0), 0);
  const rows = entries
    .map(({ item, valuation }) => {
      const value = valuation ? formatEUR(valuation.central) : t('export.noValuation');
      const range = valuation
        ? `${formatEUR(valuation.ci80Low)} – ${formatEUR(valuation.ci80High)}`
        : '—';
      const reliability = valuation ? `${Math.round(valuation.reliability)} / 100` : '—';
      return `<tr>
        <td>${escapeHtml(item.title ?? t('common.unknown'))}</td>
        <td>${escapeHtml(t(`domains.${item.domain}.name`))}</td>
        <td>${escapeHtml(value)}</td>
        <td>${escapeHtml(range)}</td>
        <td>${escapeHtml(reliability)}</td>
      </tr>`;
    })
    .join('\n');

  const allSources = new Set<string>();
  for (const entry of entries) {
    for (const obs of entry.valuation?.sources ?? []) {
      allSources.add(`${obs.source.name} (${obs.source.kind})`);
    }
  }

  return `
${baseStyles()}
<h1>${escapeHtml(t('export.insuranceTitle'))}</h1>
<p class="meta">${escapeHtml(t('export.generatedAt', { date: generatedAtIso.slice(0, 10) }))}</p>
<p>${escapeHtml(t('export.insuranceIntro'))}</p>
<h2>${escapeHtml(t('export.methodologyTitle'))}</h2>
<p>${escapeHtml(t('export.methodology'))}</p>
<h2>${escapeHtml(t('export.itemsTitle'))}</h2>
<table>
  <tr>
    <th>${escapeHtml(t('export.csv.title'))}</th>
    <th>${escapeHtml(t('export.domain'))}</th>
    <th>${escapeHtml(t('export.central'))}</th>
    <th>${escapeHtml(t('export.ci80'))}</th>
    <th>${escapeHtml(t('export.reliability'))}</th>
  </tr>
  ${rows}
</table>
<h2>${escapeHtml(t('export.totalTitle'))}</h2>
<p><strong>${escapeHtml(formatEUR(total))}</strong></p>
${
  allSources.size > 0
    ? `<h2>${escapeHtml(t('export.sources'))}</h2><ul>${[...allSources]
        .map((s) => `<li>${escapeHtml(s)}</li>`)
        .join('')}</ul>`
    : ''
}
<div class="disclaimer">${escapeHtml(t('export.disclaimer'))}</div>
`;
}

// ── CSV de collection ────────────────────────────────────────────────────────

/** En-têtes CSV stables (français, sans accents pour la portabilité tableur). */
export const CSV_HEADERS = [
  'id',
  'domaine',
  'titre',
  'confiance',
  'date_acquisition',
  'prix_acquisition_eur',
  'etat',
  'emplacement',
  'notes',
  'mis_a_jour_le',
] as const;

export function buildCollectionCsv(items: VelumItem[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const item of items) {
    const fields = [
      item.id,
      item.domain,
      item.title ?? '',
      item.confidence === null ? '' : String(item.confidence),
      item.acquiredAt ?? '',
      item.acquiredPrice === null ? '' : String(item.acquiredPrice),
      item.condition ?? '',
      item.storageLocation ?? '',
      item.notes ?? '',
      item.updatedAt,
    ];
    lines.push(fields.map(escapeCsvField).join(','));
  }
  return lines.join('\n');
}
