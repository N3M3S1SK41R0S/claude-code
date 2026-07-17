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
  type ValuateDeps,
  type ValuationResult,
  type WatchAnalysisPayload,
  type WatchAttributes,
  type WatchCondition,
  type WatchMovement,
  type WatchStory,
} from '@velum/core';
import { isRecord, parseLooseJson } from './json.ts';
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
  'L’authenticité (mouvement, cadran, pièces d’origine) n’est PAS vérifiée : le marché horloger est exposé aux contrefaçons et aux montres recomposées — en cas de doute, consultez un expert.',
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

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function probability(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : fallback;
}

/** Parse uniquement les attributs horlogers connus et valides. */
function parseWatchAttributes(value: unknown): WatchAttributes {
  const source = isRecord(value) ? value : {};
  const attributes: WatchAttributes = {};

  const brand = nonEmptyString(source['brand']);
  if (brand !== undefined) attributes.brand = brand;
  const model = nonEmptyString(source['model']);
  if (model !== undefined) attributes.model = model;
  const reference = nonEmptyString(source['reference']);
  if (reference !== undefined) attributes.reference = reference;

  const year = source['year'];
  if (typeof year === 'number' && Number.isFinite(year)) attributes.year = year;

  const gender = source['gender'];
  if (typeof gender === 'string' && (GENDER_VALUES as readonly string[]).includes(gender)) {
    attributes.gender = gender as WatchAttributes['gender'];
  }

  const caseMaterial = nonEmptyString(source['caseMaterial']);
  if (caseMaterial !== undefined) attributes.caseMaterial = caseMaterial;
  const caseDiameterMm = finitePositive(source['caseDiameterMm']);
  if (caseDiameterMm !== undefined) attributes.caseDiameterMm = caseDiameterMm;
  const dialColor = nonEmptyString(source['dialColor']);
  if (dialColor !== undefined) attributes.dialColor = dialColor;
  const bracelet = nonEmptyString(source['bracelet']);
  if (bracelet !== undefined) attributes.bracelet = bracelet;
  const crystal = nonEmptyString(source['crystal']);
  if (crystal !== undefined) attributes.crystal = crystal;
  const waterResistanceM = finitePositive(source['waterResistanceM']);
  if (waterResistanceM !== undefined) attributes.waterResistanceM = waterResistanceM;

  const boxPapers = source['boxPapers'];
  if (
    typeof boxPapers === 'string' &&
    (BOX_PAPERS_VALUES as readonly string[]).includes(boxPapers)
  ) {
    attributes.boxPapers = boxPapers as WatchAttributes['boxPapers'];
  }

  const limitedEdition = nonEmptyString(source['limitedEdition']);
  if (limitedEdition !== undefined) attributes.limitedEdition = limitedEdition;

  return attributes;
}

/** Attributs candidats : identification validée + état textuel utile à la cote. */
function parseCandidateAttributes(value: unknown): Record<string, unknown> {
  const source = isRecord(value) ? value : {};
  const attributes: Record<string, unknown> = { ...parseWatchAttributes(source) };
  const condition = nonEmptyString(source['condition']);
  if (condition !== undefined) attributes['condition'] = condition;
  const etat = nonEmptyString(source['etat']);
  if (etat !== undefined) attributes['etat'] = etat;
  return attributes;
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
  const withImage = (input.media ?? []).filter((media) => media.base64);
  const roles = withImage
    .map((media, index) => `image ${index + 1} : ${ROLE_LABELS_FR[media.role] ?? media.role}`)
    .join(' ; ');
  const hint =
    input.text !== undefined && input.text.trim() !== ''
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

function explicitFileLabel(row: Record<string, unknown>): string | undefined {
  for (const key of ['label', 'title', 'name', 'designation']) {
    const value = nonEmptyString(row[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Libellé lisible d'une ligne d'import (marque + modèle + référence/année). */
function fileRowLabel(row: Record<string, unknown>, attributes: WatchAttributes): string {
  const explicit = explicitFileLabel(row);
  if (explicit !== undefined) return explicit;
  const parts = [attributes.brand, attributes.model, attributes.reference].filter(
    (part): part is string => part !== undefined,
  );
  return parts.length > 0 ? parts.join(' ') : 'Montre importée (à préciser)';
}

/** Confiance d'import fondée sur les identifiants réellement présents. */
function fileRowConfidence(row: Record<string, unknown>, attributes: WatchAttributes): number {
  if (attributes.reference && (attributes.brand || attributes.model)) return 0.95;
  if (attributes.brand && attributes.model) return 0.85;
  if (explicitFileLabel(row) !== undefined) return 0.65;
  if (attributes.brand || attributes.model || attributes.reference) return 0.5;
  return 0.1;
}

/** Parse la réponse de reconnaissance ; null si totalement illisible. */
function parseCandidates(raw: string): Candidate[] | null {
  const parsed = parseLooseJson(raw);
  if (!isRecord(parsed) || !Array.isArray(parsed['candidates'])) return null;
  const candidates: Candidate[] = [];
  for (const entry of parsed['candidates']) {
    if (!isRecord(entry)) continue;
    const label = nonEmptyString(entry['label']);
    if (label === undefined) continue;
    candidates.push({
      id: nextCandidateId(),
      domain: 'watch',
      label,
      // Une valeur hors [0,1] est non fiable : elle devient 0, jamais 1.
      confidence: probability(entry['confidence'], 0),
      attributes: parseCandidateAttributes(entry['attributes']),
    });
  }
  candidates.sort((left, right) => right.confidence - left.confidence);
  return candidates.slice(0, 3);
}

function recognitionFrom(candidates: Candidate[], stage: RecognitionResult['stage']): RecognitionResult {
  const best = candidates[0]?.confidence ?? 0;
  return {
    candidates,
    stage,
    needsAssistedEntry: candidates.length === 0 || best < ASSISTED_ENTRY_THRESHOLD,
  };
}

const UNREADABLE_RECOGNITION: RecognitionResult = {
  candidates: [],
  stage: 'llm_vision',
  needsAssistedEntry: true,
};

// ── Mapping robuste du payload d'analyse ──────────────────────────────────

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(nonEmptyString)
    .filter((entry): entry is string => entry !== undefined);
}

/** Fusionne le fallback validé avec les seuls champs d'analyse validés. */
function toIdentification(value: unknown, fallback: unknown): WatchAttributes {
  return {
    ...parseWatchAttributes(fallback),
    ...parseWatchAttributes(value),
  };
}

function toMovement(value: unknown): WatchMovement {
  const source = isRecord(value) ? value : {};
  const rawType = source['type'];
  const type = (
    typeof rawType === 'string' && (MOVEMENT_TYPES as readonly string[]).includes(rawType)
      ? rawType
      : 'inconnu'
  ) as WatchMovement['type'];
  const movement: WatchMovement = { type, complications: toStringArray(source['complications']) };
  const calibre = nonEmptyString(source['calibre']);
  if (calibre !== undefined) movement.calibre = calibre;
  const reserve = finitePositive(source['powerReserveHours']);
  if (reserve !== undefined) movement.powerReserveHours = reserve;
  const frequency = finitePositive(source['frequencyVph']);
  if (frequency !== undefined) movement.frequencyVph = frequency;
  const jewels = finitePositive(source['jewels']);
  if (jewels !== undefined) movement.jewels = jewels;
  const certification = nonEmptyString(source['certification']);
  if (certification !== undefined) movement.certification = certification;
  const note = nonEmptyString(source['note']);
  if (note !== undefined) movement.note = note;
  return movement;
}

function toStory(value: unknown): WatchStory {
  const source = isRecord(value) ? value : {};
  const story: WatchStory = {};
  const why = nonEmptyString(source['why']);
  if (why !== undefined) story.why = why;
  const byWhom = nonEmptyString(source['byWhom']);
  if (byWhom !== undefined) story.byWhom = byWhom;
  const modelLaunchYear = source['modelLaunchYear'];
  if (typeof modelLaunchYear === 'number' && Number.isFinite(modelLaunchYear)) {
    story.modelLaunchYear = modelLaunchYear;
  }
  if (Array.isArray(source['milestones'])) {
    const milestones: { year: number; note: string }[] = [];
    for (const milestone of source['milestones']) {
      if (!isRecord(milestone)) continue;
      const year = milestone['year'];
      const note = nonEmptyString(milestone['note']);
      if (typeof year === 'number' && Number.isFinite(year) && note !== undefined) {
        milestones.push({ year, note });
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

function toHeritage(value: unknown): HeritageProfile | undefined {
  const source = isRecord(value) ? value : {};
  const heritage: HeritageProfile = {};
  const history = nonEmptyString(source['history']);
  if (history !== undefined) heritage.history = history;
  const rawRarity = source['rarity'];
  if (
    isRecord(rawRarity) &&
    typeof rawRarity['level'] === 'string' &&
    RARITY_LEVELS.includes(rawRarity['level'])
  ) {
    const note = nonEmptyString(rawRarity['note']);
    heritage.rarity = {
      level: rawRarity['level'] as NonNullable<HeritageProfile['rarity']>['level'],
      ...(note !== undefined ? { note } : {}),
    };
  }
  const rawEdition = source['editionSize'];
  if (isRecord(rawEdition)) {
    const count = finitePositive(rawEdition['count']);
    const unit = nonEmptyString(rawEdition['unit']) ?? 'exemplaires';
    const note = nonEmptyString(rawEdition['note']);
    heritage.editionSize = {
      ...(count !== undefined ? { count } : {}),
      unit,
      ...(note !== undefined ? { note } : {}),
    };
  }
  return Object.keys(heritage).length > 0 ? heritage : undefined;
}

function toCondition(value: unknown): WatchCondition {
  const source = isRecord(value) ? value : {};
  const summary = nonEmptyString(source['summary']) ?? 'État non déterminé depuis les photos.';
  const polished =
    typeof source['polished'] === 'string' &&
    (POLISHED_VALUES as readonly string[]).includes(source['polished'])
      ? (source['polished'] as WatchCondition['polished'])
      : undefined;
  const nonOriginalParts = toStringArray(source['nonOriginalParts']);
  const rawCaveat = nonEmptyString(source['caveat']) ?? '';
  const caveat = /horloger|expert/i.test(rawCaveat) ? rawCaveat : CONDITION_CAVEAT;
  const serviceHistory = nonEmptyString(source['serviceHistory']);
  return {
    summary,
    ...(serviceHistory !== undefined ? { serviceHistory } : {}),
    ...(polished !== undefined ? { polished } : {}),
    ...(nonOriginalParts.length > 0 ? { nonOriginalParts } : {}),
    issues: toStringArray(source['issues']),
    confidence: probability(source['confidence'], 0.3),
    caveat,
  };
}

function toNeighborReferences(value: unknown): { reference: string; note: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const references: { reference: string; note: string }[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const reference = nonEmptyString(entry['reference']);
    const note = nonEmptyString(entry['note']);
    if (reference !== undefined && note !== undefined) references.push({ reference, note });
  }
  return references.length > 0 ? references : undefined;
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
  "confidence": number entre 0 et 1
}
Aucun texte hors du JSON, pas de fences markdown.`;
}

// ── Le plugin ─────────────────────────────────────────────────────────────

export class WatchDomainPlugin implements DomainPlugin<WatchAnalysisPayload> {
  readonly domain = 'watch' as const;

  async recognize(input: CaptureInput, deps: RecognizeDeps): Promise<RecognitionResult> {
    if (input.kind === 'file') {
      const rows = input.fileRows ?? [];
      const candidates: Candidate[] = rows.map((row) => {
        const attributes = parseCandidateAttributes(row);
        const identity = parseWatchAttributes(attributes);
        return {
          id: nextCandidateId(),
          domain: 'watch' as const,
          label: fileRowLabel(row, identity),
          confidence: fileRowConfidence(row, identity),
          attributes,
        };
      });
      candidates.sort((left, right) => right.confidence - left.confidence);
      return recognitionFrom(candidates, 'assisted');
    }

    let raw: string;
    if (input.kind === 'photo') {
      raw = await deps.vision.complete({
        system: WATCH_RECOGNITION_SYSTEM_PROMPT,
        prompt: photoPrompt(input),
        images: input.media?.filter((media) => media.base64).map((media) => toVisionImage(media)),
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
    return recognitionFrom(candidates, 'llm_vision');
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

    return {
      engine: WATCH_ENGINE,
      payload,
      confidence: probability(parsed['confidence'], condition.confidence),
      // L'analyse LLM n'est pas une source de marché. Les références ne sont
      // publiées que par les adaptateurs ayant réellement récupéré une donnée.
      sources: [],
      disclaimers: [...WATCH_DISCLAIMERS],
    };
  }

  buildPriceQuery(candidate: Candidate): PriceQuery {
    const attributes = parseCandidateAttributes(candidate.attributes);
    const identity = parseWatchAttributes(attributes);
    const label =
      identity.brand !== undefined || identity.reference !== undefined
        ? [identity.brand, identity.model, identity.reference]
            .filter((part): part is string => part !== undefined)
            .join(' ')
        : candidate.label;

    const query: PriceQuery = {
      domain: 'watch',
      label,
      attributes,
      limit: 20,
    };

    const rawCondition = attributes['condition'] ?? attributes['etat'];
    if (typeof rawCondition === 'string') query.condition = rawCondition;
    return query;
  }

  async valuate(candidate: Candidate, deps: ValuateDeps): Promise<ValuationResult> {
    const query = this.buildPriceQuery(candidate);
    const results = await Promise.allSettled(deps.sources.map((source) => source.fetch(query)));
    const observations = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    );
    return deps.valuate(observations, deps.fx);
  }
}

/** Instance partagée du plugin montres. */
export const watchPlugin = new WatchDomainPlugin();
