/**
 * Plugin VELUM du domaine Tableaux (§4.2) — moteur `art_v1`.
 * Implémente le contrat DomainPlugin<ArtAnalysisPayload> :
 * recognize (photo/texte/fichier) → analyze (fiche prudente) → valuate (§7).
 * PRUDENCE ATTRIBUTION (§6.4.2) : jamais d'authentification ferme.
 */
import {
  VelumError,
  type AnalysisResult,
  type AnalyzeDeps,
  type ArtAnalysisPayload,
  type ArtAttributes,
  type AttributionQualifier,
  type Candidate,
  type CaptureInput,
  type CaptureMedia,
  type DomainPlugin,
  type PriceObservation,
  type PriceQuery,
  type RecognitionResult,
  type RecognizeDeps,
  type SourceRef,
  type ValuateDeps,
  type ValuationResult,
} from '@velum/core';
import { ART_SYSTEM_PROMPT } from './art.ts';
import { parseDimensions } from './dimensions.ts';
import { asFiniteNumber, asNonEmptyString, clamp01, isRecord, toStringArray } from './guards.ts';
import { parseModelJson } from './json.ts';

export const ART_ENGINE = 'art_v1';

/** Seuil sous lequel on bascule sur la saisie assistée (§3.3). */
const ASSISTED_ENTRY_THRESHOLD = 0.35;

/** Seuil de confiance sous lequel l'expertise humaine est TOUJOURS recommandée (§6.4.2). */
const EXPERTISE_CONFIDENCE_THRESHOLD = 0.85;

/** Avertissements obligatoires — TOUJOURS présents sur chaque fiche (§12.4). */
export const ART_DISCLAIMERS: readonly string[] = [
  'Estimation indicative — ni expertise légale, ni conseil en investissement.',
  'Hypothèse d’attribution — une expertise humaine est recommandée pour toute valeur significative.',
  'Estimation indicative, non une expertise légale : VELUM n’authentifie jamais une œuvre.',
];

/** Qualificatifs d'attribution admis — l'attribution est TOUJOURS qualifiée. */
const ATTRIBUTION_QUALIFIERS: readonly AttributionQualifier[] = [
  'attribue_a',
  'entourage_de',
  'ecole_de',
  'd_apres',
  'signe',
  'anonyme',
];

/** Références éditoriales par défaut si le moteur n'en cite aucune. */
const DEFAULT_ANALYSIS_SOURCES: readonly SourceRef[] = [
  { name: 'Artprice — banque de données du marché de l’art', kind: 'official_quote', url: 'https://www.artprice.com' },
  { name: 'Dictionnaire Bénézit', kind: 'official_quote', url: 'https://www.oxfordartonline.com/benezit' },
];

/** System prompt de l'étage de reconnaissance (photos d'œuvre ou texte libre). */
export const ART_RECOGNITION_SYSTEM_PROMPT = `Tu es l'étage d'identification du module Tableaux de VELUM.
À partir de photos — œuvre complète (role 'front'), détail signature (role 'signature'),
verso/étiquettes (role 'back'), cadre (role 'frame') — ou d'une description libre,
éventuellement floue ou incomplète ("petit paysage impressionniste signé, coin déchiré"),
tu proposes AU MAXIMUM 3 candidats d'identification plausibles, triés par confiance décroissante.

Tu réponds UNIQUEMENT avec un JSON strict de la forme :
{"candidates":[{"label":"Artiste — Titre présumé","confidence":0.0,"attributes":{
  "artist":"...","attributionQualifier":"attribue_a|entourage_de|ecole_de|d_apres|signe|anonyme",
  "title":"...","technique":"huile sur toile","support":"toile",
  "dimensionsCm":{"height":65,"width":54},"estimatedPeriod":"fin XIXe",
  "school":"École de Barbizon","signatureDetected":false}}]}

Règles :
- "confidence" est un nombre entre 0 et 1 qui reflète HONNÊTEMENT ton doute — jamais de
  fausse certitude. Une œuvre non documentée mérite une confiance basse.
- PRUDENCE ATTRIBUTION : jamais d'authentification ferme — l'attribution est toujours
  qualifiée via "attributionQualifier" ; sans artiste plausible, utilise "anonyme".
- Omets tout attribut inconnu plutôt que de l'inventer.
- Aucun texte hors du JSON, aucune fence markdown.`;

/** Libellés français des rôles de cadrage (§6.1.2). */
const ROLE_LABELS_FR: Record<string, string> = {
  front: 'œuvre complète',
  signature: 'détail signature',
  back: 'verso / étiquettes',
  frame: 'cadre',
  detail: 'détail',
};

/** Identifiant unique de candidat (UUID natif si disponible). */
function newCandidateId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `art-${cryptoApi.randomUUID()}`;
  }
  return `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Convertit une data URL (ou du base64 brut) vers le format attendu par VisionModel. */
function toVisionImage(base64OrDataUrl: string): { base64: string; mediaType: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(base64OrDataUrl);
  if (match) {
    return { mediaType: match[1] ?? 'image/jpeg', base64: match[2] ?? '' };
  }
  return { mediaType: 'image/jpeg', base64: base64OrDataUrl };
}

/** Résultat de repli : aucune identification fiable → saisie assistée (§3.3). */
function assistedFallback(): RecognitionResult {
  return { candidates: [], stage: 'llm_vision', needsAssistedEntry: true };
}

/** Mappe la réponse (déjà parsée) du LLM vers des candidats bornés/triés/tronqués. */
function toCandidates(parsed: unknown): Candidate[] {
  if (!isRecord(parsed) || !Array.isArray(parsed['candidates'])) return [];
  const candidates: Candidate[] = [];
  for (const entry of parsed['candidates']) {
    if (!isRecord(entry)) continue;
    const label = asNonEmptyString(entry['label']);
    if (!label) continue;
    const rawConfidence = asFiniteNumber(entry['confidence']) ?? 0;
    candidates.push({
      id: newCandidateId(),
      domain: 'art',
      label,
      confidence: clamp01(rawConfidence),
      attributes: isRecord(entry['attributes']) ? entry['attributes'] : {},
    });
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 3);
}

/** Mappe une ligne d'import (CSV/Excel/JSON) en candidat de saisie assistée. */
function fileRowToCandidate(row: Record<string, unknown>, index: number): Candidate {
  const direct =
    asNonEmptyString(row['label']) ??
    asNonEmptyString(row['title']) ??
    asNonEmptyString(row['name']) ??
    asNonEmptyString(row['work']);
  const artist = asNonEmptyString(row['artist']);
  const composed = [artist, asNonEmptyString(row['title']) ?? asNonEmptyString(row['technique'])]
    .filter((part): part is string => part !== undefined)
    .join(' — ');
  const label = direct ?? (composed.length > 0 ? composed : `Ligne ${index + 1}`);

  const attributes: Record<string, unknown> = { ...row };
  // Dimensions saisies en texte ("65 x 54 cm") → structurées si lisibles.
  const rawDimensions = asNonEmptyString(row['dimensions']);
  if (attributes['dimensionsCm'] === undefined && rawDimensions !== undefined) {
    const dims = parseDimensions(rawDimensions);
    if (dims !== null) attributes['dimensionsCm'] = dims;
  }
  return { id: newCandidateId(), domain: 'art', label, confidence: 0.95, attributes };
}

function photoPrompt(input: CaptureInput, images: CaptureMedia[]): string {
  const roles = images.map((m, i) => `image ${i + 1} : ${ROLE_LABELS_FR[m.role] ?? m.role}`).join(' ; ');
  const hint =
    input.text !== undefined && input.text.trim() !== ''
      ? `\nIndication de l'utilisateur (peut être imprécise) : « ${input.text.trim()} »`
      : '';
  return (
    `Identifie l'œuvre photographiée (${roles || 'photos fournies'}).${hint}\n` +
    'Réponds avec le JSON strict décrit dans tes instructions (max 3 candidats, attribution toujours qualifiée).'
  );
}

/** Construit le prompt utilisateur de l'analyse art_v1 (schéma JSON exigé rappelé). */
function buildAnalysisPrompt(candidate: Candidate): string {
  return `Analyse l'œuvre suivante et produis la fiche art_v1 complète, avec la prudence d'attribution exigée.

Œuvre : ${candidate.label}
Attributs déjà connus : ${JSON.stringify(candidate.attributes)}
Confiance d'identification : ${clamp01(candidate.confidence).toFixed(2)}

Réponds UNIQUEMENT avec un JSON strict conforme au schéma ArtAnalysisPayload :
{
  "identification": {"artist"?:string, "attributionQualifier":"attribue_a"|"entourage_de"|"ecole_de"|"d_apres"|"signe"|"anonyme", "title"?:string, "technique"?:string, "support"?:string, "dimensionsCm"?:{"height":number,"width":number}, "estimatedPeriod"?:string, "school"?:string, "signatureDetected"?:boolean},
  "condition": {"summary":string, "issues":string[]},
  "provenance": {"evidence":string[], "note"?:string},
  "comparables": [{"description":string, "note"?:string}],
  "uncertainties": string[],
  "expertiseRecommended": boolean,
  "confidence": number entre 0 et 1,
  "sources"?: [{"name":string, "url"?:string}]
}
Aucun texte hors du JSON, pas de fences markdown.`;
}

// ── Coercition défensive du payload d'analyse ────────────────────────────────

/** Identification prudente : attribution TOUJOURS qualifiée, jamais de certitude ajoutée. */
function toIdentification(
  value: unknown,
  candidate: Candidate,
  uncertainties: string[],
): ArtAttributes {
  const src = isRecord(value) ? value : candidate.attributes;
  const id: ArtAttributes = {};

  const artist = asNonEmptyString(src['artist']);
  if (artist !== undefined) id.artist = artist;
  const title = asNonEmptyString(src['title']);
  if (title !== undefined) id.title = title;
  const technique = asNonEmptyString(src['technique']);
  if (technique !== undefined) id.technique = technique;
  const support = asNonEmptyString(src['support']);
  if (support !== undefined) id.support = support;
  const estimatedPeriod = asNonEmptyString(src['estimatedPeriod']);
  if (estimatedPeriod !== undefined) id.estimatedPeriod = estimatedPeriod;
  const school = asNonEmptyString(src['school']);
  if (school !== undefined) id.school = school;
  if (typeof src['signatureDetected'] === 'boolean') id.signatureDetected = src['signatureDetected'];

  const rawDimensions = src['dimensionsCm'];
  if (isRecord(rawDimensions)) {
    const height = asFiniteNumber(rawDimensions['height']);
    const width = asFiniteNumber(rawDimensions['width']);
    if (height !== undefined && width !== undefined && height > 0 && width > 0) {
      id.dimensionsCm = { height, width };
    }
  } else if (typeof rawDimensions === 'string') {
    const dims = parseDimensions(rawDimensions);
    if (dims !== null) id.dimensionsCm = dims;
  }

  // PRUDENCE ATTRIBUTION : le qualificatif est obligatoire, jamais implicite.
  const rawQualifier = asNonEmptyString(src['attributionQualifier']);
  if (
    rawQualifier !== undefined &&
    (ATTRIBUTION_QUALIFIERS as readonly string[]).includes(rawQualifier)
  ) {
    id.attributionQualifier = rawQualifier as AttributionQualifier;
  } else if (id.artist !== undefined) {
    id.attributionQualifier = 'attribue_a';
    uncertainties.push(
      'Qualificatif d’attribution absent de l’analyse : hypothèse ramenée à « attribué à », à confirmer par un expert.',
    );
  } else {
    id.attributionQualifier = 'anonyme';
  }
  return id;
}

function toCondition(value: unknown, uncertainties: string[]): ArtAnalysisPayload['condition'] {
  if (isRecord(value)) {
    const summary = asNonEmptyString(value['summary']);
    if (summary !== undefined) {
      return { summary, issues: toStringArray(value['issues']) };
    }
  }
  uncertainties.push('État de conservation non évalué : examen direct de l’œuvre nécessaire.');
  return { summary: 'État de conservation non évalué.', issues: [] };
}

function toProvenance(value: unknown): ArtAnalysisPayload['provenance'] {
  if (!isRecord(value)) return { evidence: [] };
  const note = asNonEmptyString(value['note']);
  return {
    evidence: toStringArray(value['evidence']),
    ...(note !== undefined ? { note } : {}),
  };
}

function toComparables(value: unknown): ArtAnalysisPayload['comparables'] {
  if (!Array.isArray(value)) return [];
  const comparables: ArtAnalysisPayload['comparables'] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const description = asNonEmptyString(entry['description']);
    if (description === undefined) continue;
    const note = asNonEmptyString(entry['note']);
    comparables.push({ description, ...(note !== undefined ? { note } : {}) });
  }
  return comparables;
}

/** Références éditoriales citées par le moteur ; défauts vérifiables sinon. */
function toSourceRefs(value: unknown): SourceRef[] {
  if (!Array.isArray(value)) return [];
  const refs: SourceRef[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim() !== '') {
      refs.push({ name: entry.trim(), kind: 'official_quote' });
      continue;
    }
    if (isRecord(entry)) {
      const name = asNonEmptyString(entry['name']);
      if (name === undefined) continue;
      const url = asNonEmptyString(entry['url']);
      refs.push({ name, kind: 'official_quote', ...(url !== undefined ? { url } : {}) });
    }
  }
  return refs;
}

// ── Le plugin ────────────────────────────────────────────────────────────────

export class ArtDomainPlugin implements DomainPlugin<ArtAnalysisPayload> {
  readonly domain = 'art' as const;

  async recognize(input: CaptureInput, deps: RecognizeDeps): Promise<RecognitionResult> {
    // Import de fichier : mapping direct des lignes, sans passage par le LLM.
    if (input.kind === 'file') {
      const rows = input.fileRows ?? [];
      const candidates = rows.map((row, index) => fileRowToCandidate(row, index));
      return { candidates, stage: 'assisted', needsAssistedEntry: candidates.length === 0 };
    }

    let prompt: string;
    let images: { base64: string; mediaType: string }[] | undefined;
    if (input.kind === 'photo') {
      const withImage = input.media?.filter((media) => media.base64);
      images = withImage?.map((media) => toVisionImage(media.base64 as string));
      if (!withImage || !images || images.length === 0) return assistedFallback();
      prompt = photoPrompt(input, withImage);
    } else {
      const text = asNonEmptyString(input.text);
      if (!text) return assistedFallback();
      prompt =
        `Identifie l'œuvre décrite par cette saisie libre, éventuellement floue ou incomplète : « ${text} ». ` +
        'Propose les candidats les plus plausibles avec une confiance honnête et une attribution toujours qualifiée. ' +
        'Réponds avec le JSON strict décrit dans tes instructions (max 3 candidats).';
    }

    let raw: string;
    try {
      raw = await deps.vision.complete({
        system: ART_RECOGNITION_SYSTEM_PROMPT,
        prompt,
        ...(images ? { images } : {}),
        maxTokens: 1024,
      });
    } catch {
      return assistedFallback();
    }

    const candidates = toCandidates(parseModelJson(raw));
    const bestConfidence = candidates[0]?.confidence ?? 0;
    return {
      candidates,
      stage: 'llm_vision',
      needsAssistedEntry: candidates.length === 0 || bestConfidence < ASSISTED_ENTRY_THRESHOLD,
    };
  }

  async analyze(
    candidate: Candidate,
    deps: AnalyzeDeps,
  ): Promise<AnalysisResult<ArtAnalysisPayload>> {
    let raw: string;
    try {
      raw = await deps.vision.complete({
        system: ART_SYSTEM_PROMPT,
        prompt: buildAnalysisPrompt(candidate),
        maxTokens: 4096,
      });
    } catch (error) {
      throw new VelumError('ANALYSIS_FAILED', 'Le moteur d’analyse art_v1 est indisponible', {
        cause: String(error),
      });
    }

    const parsed = parseModelJson(raw);
    if (!isRecord(parsed)) {
      throw new VelumError(
        'ANALYSIS_FAILED',
        'Réponse du moteur art_v1 illisible — analyse indisponible',
        { engine: ART_ENGINE },
      );
    }

    const uncertainties = toStringArray(parsed['uncertainties']);
    const identification = toIdentification(parsed['identification'], candidate, uncertainties);
    const condition = toCondition(parsed['condition'], uncertainties);
    const provenance = toProvenance(parsed['provenance']);
    const comparables = toComparables(parsed['comparables']);

    // Garde-fou : uncertainties JAMAIS vide (§3.3) — même si le moteur l'omet.
    if (uncertainties.length === 0) {
      uncertainties.push(
        'Attribution et datation non certifiées : analyse automatique sur photos, sans examen matériel de l’œuvre.',
      );
    }

    const confidence = clamp01(asFiniteNumber(parsed['confidence']) ?? candidate.confidence);

    // PRUDENCE ATTRIBUTION (§6.4.2) : l'expertise humaine est TOUJOURS recommandée
    // sauf signature nette ET confiance > 0.85 — quoi qu'ait répondu le moteur.
    let expertiseRecommended = parsed['expertiseRecommended'] !== false;
    if (confidence < EXPERTISE_CONFIDENCE_THRESHOLD || identification.signatureDetected !== true) {
      expertiseRecommended = true;
    }

    const payload: ArtAnalysisPayload = {
      identification,
      condition,
      provenance,
      comparables,
      uncertainties,
      expertiseRecommended,
    };

    const cited = toSourceRefs(parsed['sources']);
    return {
      engine: ART_ENGINE,
      payload,
      confidence,
      sources: cited.length > 0 ? cited : [...DEFAULT_ANALYSIS_SOURCES],
      disclaimers: [...ART_DISCLAIMERS],
    };
  }

  buildPriceQuery(candidate: Candidate): PriceQuery {
    const attributes = candidate.attributes;
    const artist = asNonEmptyString(attributes['artist']);
    const title = asNonEmptyString(attributes['title']);
    const technique = asNonEmptyString(attributes['technique']);
    const school = asNonEmptyString(attributes['school']);

    // Libellé canonique : "artiste titre technique" ; sans artiste ni titre,
    // repli sur l'école puis sur le label du candidat.
    const parts = [artist, title, technique].filter((part): part is string => part !== undefined);
    const label = parts.length > 0 ? parts.join(' ') : (school ?? candidate.label);

    // Dimensions saisies en texte → structurées pour les adaptateurs.
    const normalized: Record<string, unknown> = { ...attributes };
    const rawDimensions = asNonEmptyString(attributes['dimensions']);
    if (normalized['dimensionsCm'] === undefined && rawDimensions !== undefined) {
      const dims = parseDimensions(rawDimensions);
      if (dims !== null) normalized['dimensionsCm'] = dims;
    }

    const condition = asNonEmptyString(attributes['condition']);
    return {
      domain: 'art',
      label,
      attributes: normalized,
      ...(condition !== undefined ? { condition } : {}),
      limit: 20,
    };
  }

  async valuate(candidate: Candidate, deps: ValuateDeps): Promise<ValuationResult> {
    const query = this.buildPriceQuery(candidate);
    const results = await Promise.allSettled(deps.sources.map((source) => source.fetch(query)));
    const observations: PriceObservation[] = results
      .filter(
        (result): result is PromiseFulfilledResult<PriceObservation[]> =>
          result.status === 'fulfilled',
      )
      .flatMap((result) => result.value);
    // Le moteur §7 lève VelumError NO_OBSERVATIONS si vide — on laisse remonter.
    return deps.valuate(observations, deps.fx);
  }
}

/** Instance partagée du plugin Tableaux — enregistrée dans le registre des domaines. */
export const artPlugin = new ArtDomainPlugin();
