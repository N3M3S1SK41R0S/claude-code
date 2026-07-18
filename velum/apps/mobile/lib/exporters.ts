/**
 * Exports PURS (testés par vitest) : fiche objet HTML (→ PDF via expo-print),
 * rapport assurance/succession HTML, CSV de collection. Aucune dépendance
 * React Native ici — uniquement des chaînes.
 */
import type { AnalysisResult, ValuationRecord, VelumItem } from '@velum/core';
import type { BlindTastingSession } from '@velum/domain-wine';
import { resolveReliabilityForResult } from '@velum/valuation';
import { itemNumber, itemString } from './itemAttributes';

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

function resolvedReliability(valuation: ValuationRecord): number {
  return resolveReliabilityForResult({
    central: valuation.central,
    ci80: [valuation.ci80Low, valuation.ci80High],
    reliability: valuation.reliability,
    observations: valuation.sources,
  }).value;
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
    <tr><th>${escapeHtml(t('export.reliability'))}</th><td>${escapeHtml(`${resolvedReliability(valuation)} / 100`)}</td></tr>
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
      const reliability = valuation ? `${resolvedReliability(valuation)} / 100` : '—';
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

// ── Feuille de dégustation à l'aveugle (→ PDF, pour jouer entre amis) ────────

/** Styles additionnels de la feuille aveugle (cartes + page de réponses séparée). */
function blindStyles(): string {
  return `
    <style>
      .cards { display: flex; flex-wrap: wrap; gap: 16px; }
      .card { border: 1px solid #C9A227; border-radius: 8px; padding: 14px 16px; width: 45%; box-sizing: border-box; page-break-inside: avoid; }
      .card h2 { margin: 0 0 8px; border: 0; }
      ol.steps { margin: 0; padding-left: 18px; }
      ol.steps li { margin: 6px 0; font-size: 13px; }
      ol.steps li .rule { display: block; border-bottom: 1px dotted #9a8f7d; height: 14px; }
      .guess-tag { color: #7A2230; font-size: 11px; font-style: italic; }
      .answers-page { page-break-before: always; }
      .answers-page .num { font-weight: bold; width: 40px; text-align: center; }
      .hints { color: #6b5f4d; font-size: 12px; margin-top: 2px; }
    </style>`;
}

/**
 * Feuille de dégustation à l'aveugle : une page de cartes anonymes (« Vin n°X »
 * + déroulé guidé à remplir) et une page de RÉPONSES séparée (numéro → bouteille
 * + indices). Les libellés d'étape sont traduits via `blind.steps.<key>`.
 */
export function buildBlindTastingHtml(session: BlindTastingSession, t: Translator): string {
  const cards = session.cards
    .map((card) => {
      const steps = card.steps
        .map((step) => {
          const tag =
            step.kind === 'guess'
              ? ` <span class="guess-tag">${escapeHtml(t('blind.guessTag'))}</span>`
              : '';
          return `<li>${escapeHtml(t(`blind.steps.${step.key}`))}${tag}<span class="rule"></span></li>`;
        })
        .join('\n');
      return `<section class="card">
        <h2>${escapeHtml(t('blind.wineNumber', { number: card.number }))}</h2>
        <ol class="steps">${steps}</ol>
      </section>`;
    })
    .join('\n');

  const answerRows = session.answers
    .map((answer) => {
      const vintage = answer.vintage !== undefined ? ` ${answer.vintage}` : '';
      const hints =
        answer.hints.length > 0
          ? `<div class="hints">${escapeHtml(t('blind.hintsLabel'))} ${escapeHtml(answer.hints.join(' · '))}</div>`
          : '';
      return `<tr>
        <td class="num">${answer.number}</td>
        <td>${escapeHtml(`${answer.label}${vintage}`)}${hints}</td>
      </tr>`;
    })
    .join('\n');

  return `
${baseStyles()}
${blindStyles()}
<h1>${escapeHtml(t('blind.sheetTitle'))}</h1>
<p class="meta">${escapeHtml(t('blind.sheetIntro'))}</p>
<div class="cards">${cards}</div>
<div class="answers-page">
  <h1>${escapeHtml(t('blind.answersTitle'))}</h1>
  <table>${answerRows}</table>
</div>
<div class="disclaimer">${escapeHtml(t('blind.sheetDisclaimer'))}</div>
`;
}

// ── Partage de cave (snapshot lecture seule → PDF) ──────────────────────────

/** Valeur d'affichage (chaîne ou nombre) depuis attributs ou analyse, sinon ''. */
function readItemString(item: VelumItem, key: string): string {
  const text = itemString(item, key);
  if (text !== null) return text;
  const num = itemNumber(item, key);
  return num !== null ? String(num) : '';
}

/**
 * Snapshot LECTURE SEULE de la cave à partager (à un ami, un caviste) :
 * vins, région, millésime, emplacement et valeur estimée, sans aucune donnée
 * de compte ni lien d'édition. C'est une photo à un instant t, pas un accès.
 */
export function buildCellarShareHtml(
  wines: VelumItem[],
  latestByItem: Record<string, ValuationRecord | null>,
  t: Translator,
  generatedAtIso: string = new Date().toISOString(),
): string {
  let total = 0;
  const rows = wines
    .map((item) => {
      const latest = latestByItem[item.id] ?? null;
      if (latest) total += latest.central;
      const value = latest ? formatEUR(latest.central) : '—';
      return `<tr>
        <td>${escapeHtml(item.title ?? t('common.unknown'))}</td>
        <td>${escapeHtml(readItemString(item, 'region'))}</td>
        <td>${escapeHtml(readItemString(item, 'vintage'))}</td>
        <td>${escapeHtml(item.storageLocation ?? '')}</td>
        <td>${escapeHtml(value)}</td>
      </tr>`;
    })
    .join('\n');

  return `
${baseStyles()}
<h1>${escapeHtml(t('cellarShare.title'))}</h1>
<p class="meta">${escapeHtml(t('export.generatedAt', { date: generatedAtIso.slice(0, 10) }))}</p>
<p>${escapeHtml(t('cellarShare.intro'))}</p>
<table>
  <tr>
    <th>${escapeHtml(t('cellarShare.colWine'))}</th>
    <th>${escapeHtml(t('cellarShare.colRegion'))}</th>
    <th>${escapeHtml(t('cellarShare.colVintage'))}</th>
    <th>${escapeHtml(t('cellarShare.colLocation'))}</th>
    <th>${escapeHtml(t('cellarShare.colValue'))}</th>
  </tr>
  ${rows}
</table>
<h2>${escapeHtml(t('cellarShare.total'))}</h2>
<p><strong>${escapeHtml(formatEUR(total))}</strong></p>
<div class="disclaimer">${escapeHtml(t('cellarShare.disclaimer'))}</div>
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
