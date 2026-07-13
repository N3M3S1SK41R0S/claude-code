/**
 * Plugin VELUM Timbres (philatélie) — implémente DomainPlugin<StampAnalysisPayload>.
 * Module à part entière (décision produit juillet 2026). Moteur d'analyse : `phila_v1`.
 */
import {
  VelumError,
  type AnalysisResult,
  type AnalyzeDeps,
  type Candidate,
  type CaptureInput,
  type CaptureMedia,
  type DomainPlugin,
  type PriceQuery,
  type RecognitionResult,
  type RecognizeDeps,
  type SourceRef,
  type StampAnalysisPayload,
  type StampAttributes,
  type StampCondition,
  type ValuateDeps,
  type ValuationResult,
} from '@velum/core';
import { normalizeCatalogNumber } from './catalog.ts';
import { clamp01, isRecord, parseLooseJson } from './json.ts';
import { PHILA_SYSTEM_PROMPT } from './phila.ts';

export const PHILA_ENGINE = 'phila_v1';

/** Caveat OBLIGATOIRE attaché à tout état proposé automatiquement. */
export const CONDITION_CAVEAT =
  'estimation visuelle — une expertise (Calves, Brun…) fait foi pour les fortes valeurs';

/** Avertissement de base, commun à tous les domaines VELUM. */
const BASE_DISCLAIMER = 'Estimation indicative — ni expertise légale, ni conseil en investissement.';

/** Avertissements systématiques du domaine timbres. */
const STAMP_DISCLAIMERS: readonly string[] = [
  BASE_DISCLAIMER,
  'État estimé visuellement — une expertise (Calves, Brun…) fait foi pour les fortes valeurs.',
  "L'authenticité du timbre (gomme d'origine, surcharge, oblitération) n'est pas vérifiée : en cas de doute, consultez un expert philatélique.",
];

/** Références éditoriales par défaut si le moteur n'en cite aucune. */
const DEFAULT_ANALYSIS_SOURCES: readonly SourceRef[] = [
  { name: 'Catalogue Yvert & Tellier', kind: 'official_quote', url: 'https://www.yvert.com' },
  { name: 'Colnect — catalogue collaboratif', kind: 'official_quote', url: 'https://colnect.com' },
];

const RARITY_LEVELS: readonly string[] = ['courante', 'peu_courante', 'rare', 'tres_rare', 'inconnue'];
const STATUS_VALUES: readonly StampCondition['status'][] = [
  'neuf_sans_charniere',
  'neuf_avec_charniere',
  'oblitere',
  'sur_lettre',
  'inconnu',
];
const GUM_VALUES: readonly NonNullable<StampCondition['gum']>[] = [
  'intacte',
  'alteree',
  'sans_gomme',
  'inconnue',
];
const CENTERING_VALUES: readonly NonNullable<StampCondition['centering']>[] = [
  'parfait',
  'bon',
  'decale',
  'tres_decale',
];
const CATALOG_VALUES: readonly NonNullable<StampAttributes['catalog']>[] = [
  'yvert_tellier',
  'michel',
  'stanley_gibbons',
  'scott',
  'autre',
];

/** Sous ce seuil de confiance, on bascule sur la saisie assistée (§3.3). */
const ASSISTED_ENTRY_THRESHOLD = 0.35;

/** Prompt système de l'étape de RECONNAISSANCE (étage 1, §10.1). */
export const STAMP_RECOGNITION_SYSTEM_PROMPT = `Tu es l'assistant d'identification philatélique VELUM. Tu identifies des timbres-poste à partir de photos (recto, verso-gomme, détails) ou d'une description libre, éventuellement floue ou partielle. Tu proposes au plus 3 candidats plausibles avec une confiance honnête entre 0 et 1 — jamais de fausse certitude : en cas de doute, baisse la confiance. Pour la France, privilégie la numérotation Yvert & Tellier. Réponds UNIQUEMENT en JSON strict, sans texte hors du JSON et sans fences markdown.`;

/** Schéma JSON exigé pour la reconnaissance — rappelé dans chaque prompt. */
const RECOGNITION_JSON_SPEC = `Réponds UNIQUEMENT avec un JSON strict de la forme :
{"candidates":[{"label":string,"confidence":number entre 0 et 1,"attributes":{"country"?:string,"catalogNumber"?:string,"catalog"?:"yvert_tellier"|"michel"|"stanley_gibbons"|"scott"|"autre","title"?:string,"year"?:number,"faceValue"?:string,"color"?:string,"perforation"?:string,"watermark"?:string,"printingMethod"?:string,"status"?:"neuf_sans_charniere"|"neuf_avec_charniere"|"oblitere"|"sur_lettre"}}]}
Au plus 3 candidats, triés par confiance décroissante. Aucun texte hors du JSON, pas de fences markdown.`;

const ROLE_LABELS_FR: Record<string, string> = {
  front: 'recto',
  back: 'verso (gomme)',
  detail: 'détail',
};

let candidateSeq = 0;
function nextCandidateId(): string {
  candidateSeq += 1;
  return `stamp-${candidateSeq}`;
}

/** Convertit un média de capture en image vision (gère les data URLs). */
function toVisionImage(media: CaptureMedia): { base64: string; mediaType: string } {
  const b64 = media.base64 ?? '';
  const dataUrl = /^data:([^;,]+);base64,(.*)$/s.exec(b64);
  if (dataUrl !== null) {
    return { base64: dataUrl[2] ?? '', mediaType: dataUrl[1] ?? 'image/jpeg' };
  }
  return { base64: b64, mediaType: 'image/jpeg' };
}

function photoPrompt(input: CaptureInput): string {
  const withImage = (input.media ?? []).filter((m) => m.base64);
  const roles = withImage
    .map((m, i) => `image ${i + 1} : ${ROLE_LABELS_FR[m.role] ?? m.role}`)
    .join(' ; ');
  const hint = input.text !== undefined && input.text.trim() !== ''
    ? `\nIndication de l'utilisateur (peut être imprécise) : « ${input.text.trim()} »`
    : '';
  return `Identifie le timbre-poste photographié (${roles || 'photos fournies'}).${hint}
${RECOGNITION_JSON_SPEC}`;
}

function textPrompt(text: string): string {
  return `Identifie le timbre-poste décrit ci-dessous. La description peut être floue, partielle ou approximative — propose les candidats les plus plausibles avec une confiance honnête.
Description : « ${text} »
${RECOGNITION_JSON_SPEC}`;
}

/** Libellé lisible d'une ligne d'import (label/title/name + année, ou n° de catalogue). */
function fileRowLabel(row: Record<string, unknown>): string {
  for (const key of ['label', 'title', 'name', 'designation']) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() !== '') {
      const year = row['year'] ?? row['annee'];
      if (key === 'title' && (typeof year === 'number' || typeof year === 'string')) {
        return `${v.trim()} ${String(year)}`;
      }
      return v.trim();
    }
  }
  const cat = row['catalogNumber'] ?? row['numero'];
  if (typeof cat === 'string' && cat.trim() !== '') {
    return normalizeCatalogNumber(cat)?.catalogNumber ?? cat.trim();
  }
  return 'Timbre importé (à préciser)';
}

/** Parse la réponse de reconnaissance ; null si totalement illisible. */
function parseCandidates(raw: string): Candidate[] | null {
  const parsed = parseLooseJson(raw);
  if (!isRecord(parsed) || !Array.isArray(parsed['candidates'])) return null;
  const out: Candidate[] = [];
  for (const entry of parsed['candidates']) {
    if (!isRecord(entry)) continue;
    const label = typeof entry['label'] === 'string' ? entry['label'].trim() : '';
    if (label === '') continue;
    const rawConfidence = entry['confidence'];
    const confidence = clamp01(typeof rawConfidence === 'number' ? rawConfidence : 0);
    const attributes = isRecord(entry['attributes']) ? entry['attributes'] : {};
    out.push({ id: nextCandidateId(), domain: 'stamp', label, confidence, attributes });
  }
  // Tri par confiance décroissante, top 3 au plus.
  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, 3);
}

function recognitionFrom(candidates: Candidate[]): RecognitionResult {
  const best = candidates[0]?.confidence ?? 0;
  return {
    candidates,
    stage: 'llm_vision',
    needsAssistedEntry: candidates.length === 0 || best < ASSISTED_ENTRY_THRESHOLD,
  };
}

const UNREADABLE_RECOGNITION: RecognitionResult = {
  candidates: [],
  stage: 'llm_vision',
  needsAssistedEntry: true,
};

// ── Statut philatélique ───────────────────────────────────────────────────

/** Alias usuels → statut philatélique canonique. */
const STATUS_ALIASES: Record<string, StampCondition['status']> = {
  '**': 'neuf_sans_charniere',
  'neuf sans charniere': 'neuf_sans_charniere',
  'neuf sans charnière': 'neuf_sans_charniere',
  mnh: 'neuf_sans_charniere',
  '*': 'neuf_avec_charniere',
  'neuf avec charniere': 'neuf_avec_charniere',
  'neuf avec charnière': 'neuf_avec_charniere',
  mh: 'neuf_avec_charniere',
  o: 'oblitere',
  obl: 'oblitere',
  'oblitere': 'oblitere',
  'oblitéré': 'oblitere',
  used: 'oblitere',
  'sur lettre': 'sur_lettre',
  'on cover': 'sur_lettre',
};

/** Normalise un statut saisi librement ('**', 'oblitéré', 'MNH'…) ; null si inconnu. */
export function normalizeStampStatus(input: string): StampCondition['status'] | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (raw === '') return null;
  if ((STATUS_VALUES as readonly string[]).includes(raw)) {
    return raw as StampCondition['status'];
  }
  return STATUS_ALIASES[raw] ?? null;
}

// ── Mapping robuste du payload d'analyse ──────────────────────────────────

function toIdentification(v: unknown, fallback: Record<string, unknown>): StampAttributes {
  const src = isRecord(v) ? v : fallback;
  const id: StampAttributes = {};
  if (typeof src['country'] === 'string') id.country = src['country'];
  const rawCatalogNumber = typeof src['catalogNumber'] === 'string' ? src['catalogNumber'].trim() : '';
  if (rawCatalogNumber !== '') {
    // Référence normalisée quand elle est reconnue ("yt 130" → "YT 130").
    const normalized = normalizeCatalogNumber(rawCatalogNumber);
    id.catalogNumber = normalized?.catalogNumber ?? rawCatalogNumber;
    if (normalized !== null) id.catalog = normalized.catalog;
  }
  const rawCatalog = src['catalog'];
  if (
    id.catalog === undefined &&
    typeof rawCatalog === 'string' &&
    (CATALOG_VALUES as readonly string[]).includes(rawCatalog)
  ) {
    id.catalog = rawCatalog as StampAttributes['catalog'];
  }
  if (typeof src['title'] === 'string') id.title = src['title'];
  if (typeof src['year'] === 'number' && Number.isFinite(src['year'])) id.year = src['year'];
  if (typeof src['faceValue'] === 'string') id.faceValue = src['faceValue'];
  if (typeof src['color'] === 'string') id.color = src['color'];
  if (typeof src['perforation'] === 'string') id.perforation = src['perforation'];
  if (typeof src['watermark'] === 'string') id.watermark = src['watermark'];
  if (typeof src['printingMethod'] === 'string') id.printingMethod = src['printingMethod'];
  return id;
}

function toCondition(v: unknown): StampCondition {
  const src = isRecord(v) ? v : {};
  const rawStatus = typeof src['status'] === 'string' ? src['status'] : '';
  const status = normalizeStampStatus(rawStatus) ?? 'inconnu';
  const gum =
    typeof src['gum'] === 'string' && (GUM_VALUES as readonly string[]).includes(src['gum'])
      ? (src['gum'] as StampCondition['gum'])
      : undefined;
  const centering =
    typeof src['centering'] === 'string' &&
    (CENTERING_VALUES as readonly string[]).includes(src['centering'])
      ? (src['centering'] as StampCondition['centering'])
      : undefined;
  const faults = toStringArray(src['faults']);
  const confidence = clamp01(typeof src['confidence'] === 'number' ? src['confidence'] : 0.3);
  const rawCaveat = typeof src['caveat'] === 'string' ? src['caveat'].trim() : '';
  // Le caveat d'expertise est OBLIGATOIRE — on l'impose s'il manque.
  const caveat = /expertise/i.test(rawCaveat) ? rawCaveat : CONDITION_CAVEAT;
  return {
    status,
    ...(gum !== undefined ? { gum } : {}),
    ...(centering !== undefined ? { centering } : {}),
    faults,
    confidence,
    caveat,
  };
}

function toRarity(v: unknown): StampAnalysisPayload['rarity'] {
  const src = isRecord(v) ? v : {};
  const rawLevel = src['level'];
  const level = (
    typeof rawLevel === 'string' && RARITY_LEVELS.includes(rawLevel) ? rawLevel : 'inconnue'
  ) as StampAnalysisPayload['rarity']['level'];
  const note = typeof src['note'] === 'string' ? src['note'] : undefined;
  return note === undefined ? { level } : { level, note };
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
}

function toNeighborIssues(v: unknown): { catalogNumber: string; note: string }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: { catalogNumber: string; note: string }[] = [];
  for (const entry of v) {
    if (!isRecord(entry)) continue;
    if (typeof entry['catalogNumber'] === 'string' && typeof entry['note'] === 'string') {
      out.push({ catalogNumber: entry['catalogNumber'], note: entry['note'] });
    }
  }
  return out;
}

function toSourceRefs(v: unknown): SourceRef[] {
  if (!Array.isArray(v)) return [];
  const out: SourceRef[] = [];
  for (const entry of v) {
    if (typeof entry === 'string' && entry.trim() !== '') {
      out.push({ name: entry.trim(), kind: 'official_quote' });
      continue;
    }
    if (isRecord(entry) && typeof entry['name'] === 'string' && entry['name'].trim() !== '') {
      const ref: SourceRef = { name: entry['name'].trim(), kind: 'official_quote' };
      if (typeof entry['url'] === 'string') ref.url = entry['url'];
      out.push(ref);
    }
  }
  return out;
}

function analysisPrompt(candidate: Candidate): string {
  return `Analyse le timbre suivant et produis la fiche phila_v1 complète.

Timbre : ${candidate.label}
Attributs déjà connus : ${JSON.stringify(candidate.attributes)}

Réponds UNIQUEMENT avec un JSON strict conforme au schéma StampAnalysisPayload :
{
  "identification": {"country"?:string, "catalogNumber"?:string, "catalog"?:"yvert_tellier"|"michel"|"stanley_gibbons"|"scott"|"autre", "title"?:string, "year"?:number, "faceValue"?:string, "color"?:string, "perforation"?:string, "watermark"?:string, "printingMethod"?:string},
  "condition": {"status":"neuf_sans_charniere"|"neuf_avec_charniere"|"oblitere"|"sur_lettre"|"inconnu", "gum"?:"intacte"|"alteree"|"sans_gomme"|"inconnue", "centering"?:"parfait"|"bon"|"decale"|"tres_decale", "faults":string[], "confidence":number entre 0 et 1, "caveat":string},
  "rarity": {"level":"courante"|"peu_courante"|"rare"|"tres_rare"|"inconnue", "note"?:string},
  "varieties": string[],
  "neighborIssues"?: [{"catalogNumber":string, "note":string}],
  "uncertainties": string[],
  "confidence": number entre 0 et 1,
  "sources"?: [{"name":string, "url"?:string}]
}
Aucun texte hors du JSON, pas de fences markdown.`;
}

// ── Le plugin ─────────────────────────────────────────────────────────────

export class StampDomainPlugin implements DomainPlugin<StampAnalysisPayload> {
  readonly domain = 'stamp' as const;

  async recognize(input: CaptureInput, deps: RecognizeDeps): Promise<RecognitionResult> {
    if (input.kind === 'file') {
      // Import inventaire : chaque ligne devient un candidat de saisie assistée.
      const rows = input.fileRows ?? [];
      const candidates: Candidate[] = rows.map((row) => ({
        id: nextCandidateId(),
        domain: 'stamp' as const,
        label: fileRowLabel(row),
        confidence: 0.95,
        attributes: row,
      }));
      return { candidates, stage: 'assisted', needsAssistedEntry: candidates.length === 0 };
    }

    let raw: string;
    try {
      if (input.kind === 'photo') {
        raw = await deps.vision.complete({
          system: STAMP_RECOGNITION_SYSTEM_PROMPT,
          prompt: photoPrompt(input),
          images: input.media?.filter((m) => m.base64).map((m) => toVisionImage(m)),
          maxTokens: 1024,
        });
      } else {
        raw = await deps.vision.complete({
          system: STAMP_RECOGNITION_SYSTEM_PROMPT,
          prompt: textPrompt(input.text ?? ''),
          maxTokens: 1024,
        });
      }
    } catch {
      // Vision indisponible → saisie assistée plutôt qu'une erreur bloquante.
      return { ...UNREADABLE_RECOGNITION };
    }

    const candidates = parseCandidates(raw);
    if (candidates === null) return { ...UNREADABLE_RECOGNITION };
    return recognitionFrom(candidates);
  }

  async analyze(candidate: Candidate, deps: AnalyzeDeps): Promise<AnalysisResult<StampAnalysisPayload>> {
    const raw = await deps.vision.complete({
      system: PHILA_SYSTEM_PROMPT,
      prompt: analysisPrompt(candidate),
      maxTokens: 2048,
    });
    const parsed = parseLooseJson(raw);
    if (!isRecord(parsed)) {
      throw new VelumError('ANALYSIS_FAILED', 'Réponse du moteur philatélique illisible', {
        engine: PHILA_ENGINE,
      });
    }

    const condition = toCondition(parsed['condition']);
    const uncertainties = toStringArray(parsed['uncertainties']);
    if (uncertainties.length === 0) {
      // Jamais de fiche sans réserve explicite (§3.3).
      uncertainties.push(
        'Analyse automatique non exhaustive : identification et état à confirmer par un expert philatélique.',
      );
    }

    const neighborIssues = toNeighborIssues(parsed['neighborIssues']);
    const payload: StampAnalysisPayload = {
      identification: toIdentification(parsed['identification'], candidate.attributes),
      condition,
      rarity: toRarity(parsed['rarity']),
      varieties: toStringArray(parsed['varieties']),
      ...(neighborIssues !== undefined ? { neighborIssues } : {}),
      uncertainties,
    };

    const rawConfidence = parsed['confidence'];
    const confidence = clamp01(typeof rawConfidence === 'number' ? rawConfidence : condition.confidence);
    const cited = toSourceRefs(parsed['sources']);

    return {
      engine: PHILA_ENGINE,
      payload,
      confidence,
      sources: cited.length > 0 ? cited : [...DEFAULT_ANALYSIS_SOURCES],
      disclaimers: [...STAMP_DISCLAIMERS],
    };
  }

  buildPriceQuery(candidate: Candidate): PriceQuery {
    const attrs = candidate.attributes;
    const country = typeof attrs['country'] === 'string' ? attrs['country'] : undefined;
    const title = typeof attrs['title'] === 'string' ? attrs['title'] : undefined;
    const faceValue = typeof attrs['faceValue'] === 'string' ? attrs['faceValue'] : undefined;
    const year =
      typeof attrs['year'] === 'number' || typeof attrs['year'] === 'string'
        ? String(attrs['year'])
        : undefined;
    const rawCatalogNumber =
      typeof attrs['catalogNumber'] === 'string' && attrs['catalogNumber'].trim() !== ''
        ? attrs['catalogNumber'].trim()
        : undefined;
    const catalogNumber =
      rawCatalogNumber !== undefined
        ? normalizeCatalogNumber(rawCatalogNumber)?.catalogNumber ?? rawCatalogNumber
        : undefined;

    // Libellé canonique : "pays série valeur faciale année n° catalogue" si la
    // série ou la référence est connue, sinon le libellé du candidat tel quel.
    const label =
      title !== undefined || catalogNumber !== undefined
        ? [country, title, faceValue, year, catalogNumber]
            .filter((p): p is string => p !== undefined)
            .join(' ')
        : candidate.label;

    const query: PriceQuery = {
      domain: 'stamp',
      label,
      attributes: attrs,
      limit: 20,
    };

    // condition = statut philatélique (ex. 'neuf_sans_charniere') si présent.
    for (const key of ['status', 'condition', 'etat']) {
      const rawStatus = attrs[key];
      if (typeof rawStatus === 'string' && rawStatus.trim() !== '') {
        const normalized = normalizeStampStatus(rawStatus);
        if (normalized === 'inconnu') break; // un statut inconnu n'apporte rien
        query.condition = normalized ?? rawStatus.trim();
        break;
      }
    }
    return query;
  }

  async valuate(candidate: Candidate, deps: ValuateDeps): Promise<ValuationResult> {
    const query = this.buildPriceQuery(candidate);
    const results = await Promise.allSettled(deps.sources.map((s) => s.fetch(query)));
    const obs = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    // Le moteur lève VelumError NO_OBSERVATIONS si obs est vide — on laisse remonter.
    return deps.valuate(obs, deps.fx);
  }
}

/** Instance partagée du plugin timbres. */
export const stampPlugin = new StampDomainPlugin();
