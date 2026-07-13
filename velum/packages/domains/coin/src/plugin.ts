/**
 * Plugin VELUM Pièces (numismatique) — implémente DomainPlugin<CoinAnalysisPayload>.
 * Moteur d'analyse : `numis_v1`.
 */
import {
  VelumError,
  type AnalysisResult,
  type AnalyzeDeps,
  type Candidate,
  type CaptureInput,
  type CaptureMedia,
  type CoinAnalysisPayload,
  type CoinAttributes,
  type CoinGrade,
  type DomainPlugin,
  type PriceQuery,
  type RecognitionResult,
  type RecognizeDeps,
  type SourceRef,
  type ValuateDeps,
  type ValuationResult,
} from '@velum/core';
import { normalizeGrade } from './grade.ts';
import { clamp01, isRecord, parseLooseJson } from './json.ts';
import { NUMIS_SYSTEM_PROMPT } from './numis.ts';

export const NUMIS_ENGINE = 'numis_v1';

/** Caveat OBLIGATOIRE attaché à tout grade proposé automatiquement. */
export const GRADE_CAVEAT =
  'estimation visuelle — seule une gradation professionnelle (PCGS/NGC) fait foi';

/** Avertissement de base, commun à tous les domaines VELUM. */
const BASE_DISCLAIMER = 'Estimation indicative — ni expertise légale, ni conseil en investissement.';

/** Avertissements systématiques du domaine pièces. */
const COIN_DISCLAIMERS: readonly string[] = [
  BASE_DISCLAIMER,
  'Grade estimé visuellement — seule une gradation professionnelle (PCGS/NGC) fait foi.',
  "L'authenticité de la pièce n'est pas vérifiée : en cas de doute, consultez un numismate professionnel.",
];

/** Références éditoriales par défaut si le moteur n'en cite aucune. */
const DEFAULT_ANALYSIS_SOURCES: readonly SourceRef[] = [
  { name: 'Numista — catalogue collaboratif', kind: 'official_quote', url: 'https://fr.numista.com' },
  { name: 'PCGS CoinFacts', kind: 'official_quote', url: 'https://www.pcgs.com/coinfacts' },
];

const RARITY_LEVELS: readonly string[] = ['courante', 'peu_courante', 'rare', 'tres_rare', 'inconnue'];

/** Sous ce seuil de confiance, on bascule sur la saisie assistée (§3.3). */
const ASSISTED_ENTRY_THRESHOLD = 0.35;

/** Prompt système de l'étape de RECONNAISSANCE (étage 1, §10.1). */
export const COIN_RECOGNITION_SYSTEM_PROMPT = `Tu es l'assistant d'identification numismatique VELUM. Tu identifies des pièces de monnaie à partir de photos (avers, revers, tranche) ou d'une description libre, éventuellement floue ou partielle. Tu proposes au plus 3 candidats plausibles avec une confiance honnête entre 0 et 1 — jamais de fausse certitude : en cas de doute, baisse la confiance. Réponds UNIQUEMENT en JSON strict, sans texte hors du JSON et sans fences markdown.`;

/** Schéma JSON exigé pour la reconnaissance — rappelé dans chaque prompt. */
const RECOGNITION_JSON_SPEC = `Réponds UNIQUEMENT avec un JSON strict de la forme :
{"candidates":[{"label":string,"confidence":number entre 0 et 1,"attributes":{"country"?:string,"issuer"?:string,"type"?:string,"year"?:number,"mintMark"?:string,"metal"?:string,"weightGrams"?:number,"diameterMm"?:number,"mintage"?:number,"numistaId"?:string,"grade"?:string}}]}
Au plus 3 candidats, triés par confiance décroissante. Aucun texte hors du JSON, pas de fences markdown.`;

const ROLE_LABELS_FR: Record<string, string> = {
  obverse: 'avers',
  reverse: 'revers',
  edge: 'tranche',
  detail: 'détail',
};

let candidateSeq = 0;
function nextCandidateId(): string {
  candidateSeq += 1;
  return `coin-${candidateSeq}`;
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
  return `Identifie la pièce de monnaie photographiée (${roles || 'photos fournies'}).${hint}
${RECOGNITION_JSON_SPEC}`;
}

function textPrompt(text: string): string {
  return `Identifie la pièce de monnaie décrite ci-dessous. La description peut être floue, partielle ou approximative — propose les candidats les plus plausibles avec une confiance honnête.
Description : « ${text} »
${RECOGNITION_JSON_SPEC}`;
}

/** Libellé lisible d'une ligne d'import (label/title/name/type + année). */
function fileRowLabel(row: Record<string, unknown>): string {
  for (const key of ['label', 'title', 'name', 'designation', 'type']) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() !== '') {
      const year = row['year'] ?? row['annee'];
      if (key === 'type' && (typeof year === 'number' || typeof year === 'string')) {
        return `${v.trim()} ${String(year)}`;
      }
      return v.trim();
    }
  }
  return 'Pièce importée (à préciser)';
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
    out.push({ id: nextCandidateId(), domain: 'coin', label, confidence, attributes });
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

// ── Mapping robuste du payload d'analyse ──────────────────────────────────

function toIdentification(v: unknown, fallback: Record<string, unknown>): CoinAttributes {
  const src = isRecord(v) ? v : fallback;
  const id: CoinAttributes = {};
  if (typeof src['country'] === 'string') id.country = src['country'];
  if (typeof src['issuer'] === 'string') id.issuer = src['issuer'];
  if (typeof src['type'] === 'string') id.type = src['type'];
  if (typeof src['year'] === 'number' && Number.isFinite(src['year'])) id.year = src['year'];
  if (typeof src['mintMark'] === 'string') id.mintMark = src['mintMark'];
  if (typeof src['metal'] === 'string') id.metal = src['metal'];
  if (typeof src['weightGrams'] === 'number') id.weightGrams = src['weightGrams'];
  if (typeof src['diameterMm'] === 'number') id.diameterMm = src['diameterMm'];
  if (typeof src['mintage'] === 'number') id.mintage = src['mintage'];
  if (typeof src['numistaId'] === 'string') id.numistaId = src['numistaId'];
  return id;
}

function toGrade(v: unknown): CoinGrade {
  const src = isRecord(v) ? v : {};
  const rawValue = typeof src['value'] === 'string' ? src['value'].trim() : '';
  const normalized = rawValue !== '' ? normalizeGrade(rawValue) : null;
  const scale: 'fr' | 'sheldon' = normalized?.scale ?? (src['scale'] === 'sheldon' ? 'sheldon' : 'fr');
  const value = normalized?.value ?? (rawValue !== '' ? rawValue : 'indéterminé');
  const confidence = clamp01(typeof src['confidence'] === 'number' ? src['confidence'] : 0.3);
  const rawCaveat = typeof src['caveat'] === 'string' ? src['caveat'].trim() : '';
  // Le caveat professionnel est OBLIGATOIRE — on l'impose s'il manque.
  const caveat = /pcgs/i.test(rawCaveat) ? rawCaveat : GRADE_CAVEAT;
  return { scale, value, confidence, caveat };
}

function toRarity(v: unknown): CoinAnalysisPayload['rarity'] {
  const src = isRecord(v) ? v : {};
  const rawLevel = src['level'];
  const level = (
    typeof rawLevel === 'string' && RARITY_LEVELS.includes(rawLevel) ? rawLevel : 'inconnue'
  ) as CoinAnalysisPayload['rarity']['level'];
  const note = typeof src['note'] === 'string' ? src['note'] : undefined;
  return note === undefined ? { level } : { level, note };
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
}

function toNeighborYears(v: unknown): { year: number; note: string }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: { year: number; note: string }[] = [];
  for (const entry of v) {
    if (!isRecord(entry)) continue;
    if (typeof entry['year'] === 'number' && typeof entry['note'] === 'string') {
      out.push({ year: entry['year'], note: entry['note'] });
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
  return `Analyse la pièce suivante et produis la fiche numis_v1 complète.

Pièce : ${candidate.label}
Attributs déjà connus : ${JSON.stringify(candidate.attributes)}

Réponds UNIQUEMENT avec un JSON strict conforme au schéma CoinAnalysisPayload :
{
  "identification": {"country"?:string, "issuer"?:string, "type"?:string, "year"?:number, "mintMark"?:string, "metal"?:string, "weightGrams"?:number, "diameterMm"?:number, "mintage"?:number, "numistaId"?:string},
  "grade": {"scale":"fr"|"sheldon", "value":string, "confidence":number entre 0 et 1, "caveat":string},
  "rarity": {"level":"courante"|"peu_courante"|"rare"|"tres_rare"|"inconnue", "note"?:string},
  "varieties": string[],
  "neighborYears"?: [{"year":number, "note":string}],
  "uncertainties": string[],
  "confidence": number entre 0 et 1,
  "sources"?: [{"name":string, "url"?:string}]
}
Aucun texte hors du JSON, pas de fences markdown.`;
}

// ── Le plugin ─────────────────────────────────────────────────────────────

export class CoinDomainPlugin implements DomainPlugin<CoinAnalysisPayload> {
  readonly domain = 'coin' as const;

  async recognize(input: CaptureInput, deps: RecognizeDeps): Promise<RecognitionResult> {
    if (input.kind === 'file') {
      // Import inventaire : chaque ligne devient un candidat de saisie assistée.
      const rows = input.fileRows ?? [];
      const candidates: Candidate[] = rows.map((row) => ({
        id: nextCandidateId(),
        domain: 'coin' as const,
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
          system: COIN_RECOGNITION_SYSTEM_PROMPT,
          prompt: photoPrompt(input),
          images: input.media?.filter((m) => m.base64).map((m) => toVisionImage(m)),
          maxTokens: 1024,
        });
      } else {
        raw = await deps.vision.complete({
          system: COIN_RECOGNITION_SYSTEM_PROMPT,
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

  async analyze(candidate: Candidate, deps: AnalyzeDeps): Promise<AnalysisResult<CoinAnalysisPayload>> {
    const raw = await deps.vision.complete({
      system: NUMIS_SYSTEM_PROMPT,
      prompt: analysisPrompt(candidate),
      maxTokens: 2048,
    });
    const parsed = parseLooseJson(raw);
    if (!isRecord(parsed)) {
      throw new VelumError('ANALYSIS_FAILED', 'Réponse du moteur numismatique illisible', {
        engine: NUMIS_ENGINE,
      });
    }

    const grade = toGrade(parsed['grade']);
    const uncertainties = toStringArray(parsed['uncertainties']);
    if (uncertainties.length === 0) {
      // Jamais de fiche sans réserve explicite (§3.3).
      uncertainties.push(
        'Analyse automatique non exhaustive : identification et grade à confirmer par un professionnel.',
      );
    }

    const neighborYears = toNeighborYears(parsed['neighborYears']);
    const payload: CoinAnalysisPayload = {
      identification: toIdentification(parsed['identification'], candidate.attributes),
      grade,
      rarity: toRarity(parsed['rarity']),
      varieties: toStringArray(parsed['varieties']),
      ...(neighborYears !== undefined ? { neighborYears } : {}),
      uncertainties,
    };

    const rawConfidence = parsed['confidence'];
    const confidence = clamp01(typeof rawConfidence === 'number' ? rawConfidence : grade.confidence);
    const cited = toSourceRefs(parsed['sources']);

    return {
      engine: NUMIS_ENGINE,
      payload,
      confidence,
      sources: cited.length > 0 ? cited : [...DEFAULT_ANALYSIS_SOURCES],
      disclaimers: [...COIN_DISCLAIMERS],
    };
  }

  buildPriceQuery(candidate: Candidate): PriceQuery {
    const attrs = candidate.attributes;
    const country = typeof attrs['country'] === 'string' ? attrs['country'] : undefined;
    const type = typeof attrs['type'] === 'string' ? attrs['type'] : undefined;
    const year =
      typeof attrs['year'] === 'number' || typeof attrs['year'] === 'string'
        ? String(attrs['year'])
        : undefined;
    const mintMark = typeof attrs['mintMark'] === 'string' ? attrs['mintMark'] : undefined;

    // Libellé canonique : "pays type année atelier" si le type est connu,
    // sinon le libellé du candidat tel quel.
    const label =
      type !== undefined
        ? [country, type, year, mintMark].filter((p): p is string => p !== undefined).join(' ')
        : candidate.label;

    const query: PriceQuery = {
      domain: 'coin',
      label,
      attributes: attrs,
      limit: 20,
    };

    const rawGrade = attrs['grade'];
    if (typeof rawGrade === 'string' && rawGrade.trim() !== '') {
      // condition = grade normalisé (TTB, MS65…) ; à défaut, la saisie brute.
      query.condition = normalizeGrade(rawGrade)?.value ?? rawGrade.trim();
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

/** Instance partagée du plugin pièces. */
export const coinPlugin = new CoinDomainPlugin();
