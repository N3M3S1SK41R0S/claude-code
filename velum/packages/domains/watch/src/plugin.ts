/**
 * Plugin VELUM Montres — implémente DomainPlugin<WatchAnalysisPayload>.
 * 5e module (décision produit juillet 2026). Moteur d'analyse : `watch_v1`.
 */
import {
  VelumError,
  type AnalysisResult,
  type AnalyzeDeps,
  type Candidate,
  type CaptureInput,
  type CaptureMedia,
  type DomainPlugin,
  type HeritageProfile,
  type PriceQuery,
  type RecognitionResult,
  type RecognizeDeps,
  type SourceRef,
  type ValuateDeps,
  type ValuationResult,
  type WatchAnalysisPayload,
  type WatchAttributes,
  type WatchCondition,
  type WatchMovement,
  type WatchStory,
} from '@velum/core';
import { clamp01, isRecord, parseLooseJson } from './json.ts';
import { WATCH_SYSTEM_PROMPT } from './horo.ts';

export const WATCH_ENGINE = 'watch_v1';

/** Caveat OBLIGATOIRE attaché à tout état proposé automatiquement. */
export const CONDITION_CAVEAT =
  'estimation visuelle — seul un horloger ouvrant le boîtier peut attester du mouvement et de l’authenticité';

/** Avertissement de base, commun à tous les domaines VELUM. */
const BASE_DISCLAIMER = 'Estimation indicative — ni expertise légale, ni conseil en investissement.';

/** Avertissements systématiques du domaine montres. */
export const WATCH_DISCLAIMERS: readonly string[] = [
  BASE_DISCLAIMER,
  'État et mouvement estimés visuellement — une révision par un horloger fait foi.',
  "L'authenticité (mouvement, cadran, pièces d'origine) n'est PAS vérifiée : le marché horloger est exposé aux contrefaçons et aux montres recomposées — en cas de doute, consultez un expert.",
];

/** Références éditoriales par défaut si le moteur n'en cite aucune. */
const DEFAULT_ANALYSIS_SOURCES: readonly SourceRef[] = [
  { name: 'WatchCharts — cotes de marché', kind: 'official_quote', url: 'https://watchcharts.com' },
  { name: 'Archives constructeurs (Rolex, Omega…)', kind: 'official_quote' },
];

const GENDER_VALUES: readonly NonNullable<WatchAttributes['gender']>[] = ['homme', 'femme', 'mixte'];
const BOX_PAPERS_VALUES: readonly NonNullable<WatchAttributes['boxPapers']>[] = [
  'full_set',
  'boite_seule',
  'papiers_seuls',
  'montre_seule',
  'inconnu',
];
const MOVEMENT_TYPES: readonly WatchMovement['type'][] = [
  'automatique',
  'manuel',
  'quartz',
  'squelette',
  'inconnu',
];
const POLISHED_VALUES: readonly NonNullable<WatchCondition['polished']>[] = [
  'non',
  'leger',
  'important',
  'inconnu',
];

/** Sous ce seuil de confiance, on bascule sur la saisie assistée (§3.3). */
const ASSISTED_ENTRY_THRESHOLD = 0.35;

/** Prompt système de l'étape de RECONNAISSANCE (étage 1, §10.1). */
export const WATCH_RECOGNITION_SYSTEM_PROMPT = `Tu es l'assistant d'identification horlogère VELUM. Tu identifies des montres de collection (hommes et femmes) à partir de photos (cadran, fond de boîte, fermoir, mouvement) ou d'une description libre, éventuellement floue ou partielle. Tu proposes au plus 3 candidats plausibles avec une confiance honnête entre 0 et 1 — jamais de fausse certitude : les hommages et contrefaçons abondent, en cas de doute baisse la confiance. Précise la référence constructeur quand elle est déterminable. Réponds UNIQUEMENT en JSON strict, sans texte hors du JSON et sans fences markdown.`;

/** Schéma JSON exigé pour la reconnaissance — rappelé dans chaque prompt. */
const RECOGNITION_JSON_SPEC = `Réponds UNIQUEMENT avec un JSON strict de la forme :
{"candidates":[{"label":string,"confidence":number entre 0 et 1,"attributes":{"brand"?:string,"model"?:string,"reference"?:string,"year"?:number,"gender"?:"homme"|"femme"|"mixte","caseMaterial"?:string,"caseDiameterMm"?:number,"dialColor"?:string,"bracelet"?:string}}]}
Au plus 3 candidats, triés par confiance décroissante. Aucun texte hors du JSON, pas de fences markdown.`;

const ROLE_LABELS_FR: Record<string, string> = {
  dial: 'cadran',
  caseback: 'fond de boîte',
  movement: 'mouvement',
  clasp: 'fermoir / bracelet',
  detail: 'détail',
};

let candidateSeq = 0;
function nextCandidateId(): string {
  candidateSeq += 1;
  return `watch-${candidateSeq}`;
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
  return `Identifie la montre photographiée (${roles || 'photos fournies'}).${hint}
${RECOGNITION_JSON_SPEC}`;
}

function textPrompt(text: string): string {
  return `Identifie la montre décrite ci-dessous. La description peut être floue, partielle ou approximative — propose les candidats les plus plausibles avec une confiance honnête.
Description : « ${text} »
${RECOGNITION_JSON_SPEC}`;
}

/** Libellé lisible d'une ligne d'import (marque + modèle + référence/année). */
function fileRowLabel(row: Record<string, unknown>): string {
  for (const key of ['label', 'title', 'name', 'designation']) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  const brand = typeof row['brand'] === 'string' ? row['brand'].trim() : '';
  const model = typeof row['model'] === 'string' ? row['model'].trim() : '';
  const reference = typeof row['reference'] === 'string' ? row['reference'].trim() : '';
  const parts = [brand, model, reference].filter((p) => p !== '');
  if (parts.length > 0) return parts.join(' ');
  return 'Montre importée (à préciser)';
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
    out.push({ id: nextCandidateId(), domain: 'watch', label, confidence, attributes });
  }
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

// ── Mapping robuste du payload d'analyse ──────────────────────────────────

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
}

function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
}

function toIdentification(v: unknown, fallback: Record<string, unknown>): WatchAttributes {
  const src = isRecord(v) ? v : fallback;
  const id: WatchAttributes = {};
  if (typeof src['brand'] === 'string') id.brand = src['brand'];
  if (typeof src['model'] === 'string') id.model = src['model'];
  if (typeof src['reference'] === 'string' && src['reference'].trim() !== '') {
    id.reference = src['reference'].trim();
  }
  if (typeof src['year'] === 'number' && Number.isFinite(src['year'])) id.year = src['year'];
  if (typeof src['gender'] === 'string' && (GENDER_VALUES as readonly string[]).includes(src['gender'])) {
    id.gender = src['gender'] as WatchAttributes['gender'];
  }
  if (typeof src['caseMaterial'] === 'string') id.caseMaterial = src['caseMaterial'];
  const diameter = finitePositive(src['caseDiameterMm']);
  if (diameter !== undefined) id.caseDiameterMm = diameter;
  if (typeof src['dialColor'] === 'string') id.dialColor = src['dialColor'];
  if (typeof src['bracelet'] === 'string') id.bracelet = src['bracelet'];
  if (typeof src['crystal'] === 'string') id.crystal = src['crystal'];
  const water = finitePositive(src['waterResistanceM']);
  if (water !== undefined) id.waterResistanceM = water;
  if (
    typeof src['boxPapers'] === 'string' &&
    (BOX_PAPERS_VALUES as readonly string[]).includes(src['boxPapers'])
  ) {
    id.boxPapers = src['boxPapers'] as WatchAttributes['boxPapers'];
  }
  if (typeof src['limitedEdition'] === 'string') id.limitedEdition = src['limitedEdition'];
  return id;
}

function toMovement(v: unknown): WatchMovement {
  const src = isRecord(v) ? v : {};
  const rawType = src['type'];
  const type = (
    typeof rawType === 'string' && (MOVEMENT_TYPES as readonly string[]).includes(rawType)
      ? rawType
      : 'inconnu'
  ) as WatchMovement['type'];
  const movement: WatchMovement = { type, complications: toStringArray(src['complications']) };
  if (typeof src['calibre'] === 'string' && src['calibre'].trim() !== '') {
    movement.calibre = src['calibre'].trim();
  }
  const reserve = finitePositive(src['powerReserveHours']);
  if (reserve !== undefined) movement.powerReserveHours = reserve;
  const vph = finitePositive(src['frequencyVph']);
  if (vph !== undefined) movement.frequencyVph = vph;
  const jewels = finitePositive(src['jewels']);
  if (jewels !== undefined) movement.jewels = jewels;
  if (typeof src['certification'] === 'string') movement.certification = src['certification'];
  if (typeof src['note'] === 'string') movement.note = src['note'];
  return movement;
}

function toStory(v: unknown): WatchStory {
  const src = isRecord(v) ? v : {};
  const story: WatchStory = {};
  if (typeof src['why'] === 'string') story.why = src['why'];
  if (typeof src['byWhom'] === 'string') story.byWhom = src['byWhom'];
  if (typeof src['modelLaunchYear'] === 'number' && Number.isFinite(src['modelLaunchYear'])) {
    story.modelLaunchYear = src['modelLaunchYear'];
  }
  if (Array.isArray(src['milestones'])) {
    const milestones: { year: number; note: string }[] = [];
    for (const m of src['milestones']) {
      if (isRecord(m) && typeof m['year'] === 'number' && typeof m['note'] === 'string') {
        milestones.push({ year: m['year'], note: m['note'] });
      }
    }
    if (milestones.length > 0) story.milestones = milestones;
  }
  return story;
}

const RARITY_LEVELS: readonly string[] = [
  'courante',
  'peu_courante',
  'rare',
  'tres_rare',
  'exceptionnelle',
  'inconnue',
];

function toHeritage(v: unknown): HeritageProfile | undefined {
  const src = isRecord(v) ? v : {};
  const heritage: HeritageProfile = {};
  if (typeof src['history'] === 'string' && src['history'].trim() !== '') {
    heritage.history = src['history'];
  }
  const rawRarity = src['rarity'];
  if (isRecord(rawRarity) && typeof rawRarity['level'] === 'string' && RARITY_LEVELS.includes(rawRarity['level'])) {
    heritage.rarity = {
      level: rawRarity['level'] as NonNullable<HeritageProfile['rarity']>['level'],
      ...(typeof rawRarity['note'] === 'string' ? { note: rawRarity['note'] } : {}),
    };
  }
  const rawEdition = src['editionSize'];
  if (isRecord(rawEdition)) {
    const count = finitePositive(rawEdition['count']);
    const unit = typeof rawEdition['unit'] === 'string' ? rawEdition['unit'] : 'exemplaires';
    heritage.editionSize = {
      ...(count !== undefined ? { count } : {}),
      unit,
      ...(typeof rawEdition['note'] === 'string' ? { note: rawEdition['note'] } : {}),
    };
  }
  return Object.keys(heritage).length > 0 ? heritage : undefined;
}

function toCondition(v: unknown): WatchCondition {
  const src = isRecord(v) ? v : {};
  const summary =
    typeof src['summary'] === 'string' && src['summary'].trim() !== ''
      ? src['summary']
      : 'État non déterminé depuis les photos.';
  const polished =
    typeof src['polished'] === 'string' && (POLISHED_VALUES as readonly string[]).includes(src['polished'])
      ? (src['polished'] as WatchCondition['polished'])
      : undefined;
  const nonOriginal = toStringArray(src['nonOriginalParts']);
  const confidence = clamp01(typeof src['confidence'] === 'number' ? src['confidence'] : 0.3);
  const rawCaveat = typeof src['caveat'] === 'string' ? src['caveat'].trim() : '';
  // Le caveat horloger est OBLIGATOIRE — on l'impose s'il manque.
  const caveat = /horloger|expert/i.test(rawCaveat) ? rawCaveat : CONDITION_CAVEAT;
  return {
    summary,
    ...(typeof src['serviceHistory'] === 'string' ? { serviceHistory: src['serviceHistory'] } : {}),
    ...(polished !== undefined ? { polished } : {}),
    ...(nonOriginal.length > 0 ? { nonOriginalParts: nonOriginal } : {}),
    issues: toStringArray(src['issues']),
    confidence,
    caveat,
  };
}

function toNeighborReferences(v: unknown): { reference: string; note: string }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: { reference: string; note: string }[] = [];
  for (const entry of v) {
    if (!isRecord(entry)) continue;
    if (typeof entry['reference'] === 'string' && typeof entry['note'] === 'string') {
      out.push({ reference: entry['reference'], note: entry['note'] });
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
  return `Analyse la montre suivante et produis la fiche watch_v1 complète.

Montre : ${candidate.label}
Attributs déjà connus : ${JSON.stringify(candidate.attributes)}

Réponds UNIQUEMENT avec un JSON strict conforme au schéma WatchAnalysisPayload :
{
  "identification": {"brand"?:string, "model"?:string, "reference"?:string, "year"?:number, "gender"?:"homme"|"femme"|"mixte", "caseMaterial"?:string, "caseDiameterMm"?:number, "dialColor"?:string, "bracelet"?:string, "crystal"?:string, "waterResistanceM"?:number, "boxPapers"?:"full_set"|"boite_seule"|"papiers_seuls"|"montre_seule"|"inconnu", "limitedEdition"?:string},
  "movement": {"type":"automatique"|"manuel"|"quartz"|"squelette"|"inconnu", "calibre"?:string, "powerReserveHours"?:number, "frequencyVph"?:number, "jewels"?:number, "complications":string[], "certification"?:string, "note"?:string},
  "condition": {"summary":string, "serviceHistory"?:string, "polished"?:"non"|"leger"|"important"|"inconnu", "nonOriginalParts"?:string[], "issues":string[], "confidence":number entre 0 et 1, "caveat":string},
  "story": {"why"?:string, "byWhom"?:string, "modelLaunchYear"?:number, "milestones"?:[{"year":number,"note":string}]},
  "heritage"?: {"history"?:string, "rarity"?:{"level":"courante"|"peu_courante"|"rare"|"tres_rare"|"exceptionnelle"|"inconnue","note"?:string}, "editionSize"?:{"count"?:number,"unit":string,"note"?:string}},
  "neighborReferences"?: [{"reference":string, "note":string}],
  "uncertainties": string[],
  "confidence": number entre 0 et 1,
  "sources"?: [{"name":string, "url"?:string}]
}
Aucun texte hors du JSON, pas de fences markdown.`;
}

// ── Le plugin ─────────────────────────────────────────────────────────────

export class WatchDomainPlugin implements DomainPlugin<WatchAnalysisPayload> {
  readonly domain = 'watch' as const;

  async recognize(input: CaptureInput, deps: RecognizeDeps): Promise<RecognitionResult> {
    if (input.kind === 'file') {
      const rows = input.fileRows ?? [];
      const candidates: Candidate[] = rows.map((row) => ({
        id: nextCandidateId(),
        domain: 'watch' as const,
        label: fileRowLabel(row),
        confidence: 0.95,
        attributes: row,
      }));
      return { candidates, stage: 'assisted', needsAssistedEntry: candidates.length === 0 };
    }

    let raw: string;
    if (input.kind === 'photo') {
      raw = await deps.vision.complete({
        system: WATCH_RECOGNITION_SYSTEM_PROMPT,
        prompt: photoPrompt(input),
        images: input.media?.filter((m) => m.base64).map((m) => toVisionImage(m)),
        maxTokens: 1024,
      });
    } else {
      raw = await deps.vision.complete({
        system: WATCH_RECOGNITION_SYSTEM_PROMPT,
        prompt: textPrompt(input.text ?? ''),
        maxTokens: 1024,
      });
    }

    const candidates = parseCandidates(raw);
    if (candidates === null) return { ...UNREADABLE_RECOGNITION };
    return recognitionFrom(candidates);
  }

  async analyze(candidate: Candidate, deps: AnalyzeDeps): Promise<AnalysisResult<WatchAnalysisPayload>> {
    const raw = await deps.vision.complete({
      system: WATCH_SYSTEM_PROMPT,
      prompt: analysisPrompt(candidate),
      maxTokens: 2048,
    });
    const parsed = parseLooseJson(raw);
    if (!isRecord(parsed)) {
      throw new VelumError('ANALYSIS_FAILED', 'Réponse du moteur horloger illisible', {
        engine: WATCH_ENGINE,
      });
    }

    const condition = toCondition(parsed['condition']);
    const uncertainties = toStringArray(parsed['uncertainties']);
    if (uncertainties.length === 0) {
      // Jamais de fiche sans réserve explicite (§3.3).
      uncertainties.push(
        'Analyse automatique non exhaustive : référence, mouvement et authenticité à confirmer par un horloger.',
      );
    }

    const heritage = toHeritage(parsed['heritage']);
    const neighborReferences = toNeighborReferences(parsed['neighborReferences']);
    const payload: WatchAnalysisPayload = {
      identification: toIdentification(parsed['identification'], candidate.attributes),
      movement: toMovement(parsed['movement']),
      condition,
      story: toStory(parsed['story']),
      ...(heritage !== undefined ? { heritage } : {}),
      ...(neighborReferences !== undefined ? { neighborReferences } : {}),
      uncertainties,
    };

    const rawConfidence = parsed['confidence'];
    const confidence = clamp01(typeof rawConfidence === 'number' ? rawConfidence : condition.confidence);
    const cited = toSourceRefs(parsed['sources']);

    return {
      engine: WATCH_ENGINE,
      payload,
      confidence,
      sources: cited.length > 0 ? cited : [...DEFAULT_ANALYSIS_SOURCES],
      disclaimers: [...WATCH_DISCLAIMERS],
    };
  }

  buildPriceQuery(candidate: Candidate): PriceQuery {
    const attrs = candidate.attributes;
    const brand = typeof attrs['brand'] === 'string' ? attrs['brand'].trim() : undefined;
    const model = typeof attrs['model'] === 'string' ? attrs['model'].trim() : undefined;
    const reference = typeof attrs['reference'] === 'string' ? attrs['reference'].trim() : undefined;

    // Libellé canonique : "marque modèle référence" — la référence constructeur
    // est le meilleur discriminant du marché horloger.
    const label =
      brand !== undefined || reference !== undefined
        ? [brand, model, reference].filter((p): p is string => p !== undefined && p !== '').join(' ')
        : candidate.label;

    const query: PriceQuery = {
      domain: 'watch',
      label,
      attributes: attrs,
      limit: 20,
    };

    const rawCondition = attrs['condition'] ?? attrs['etat'];
    if (typeof rawCondition === 'string' && rawCondition.trim() !== '') {
      query.condition = rawCondition.trim();
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

/** Instance partagée du plugin montres. */
export const watchPlugin = new WatchDomainPlugin();
