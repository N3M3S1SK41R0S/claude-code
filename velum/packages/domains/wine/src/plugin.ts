/**
 * Plugin VELUM du domaine Vin (§4.2) — moteur ZAPPA∴VINI∴SAPIENS.
 * Implémente le contrat DomainPlugin<WineAnalysisPayload> :
 * recognize (photo/texte/fichier) → analyze (fiche 7 modules) → valuate (§7).
 */
import {
  QUICK_SCAN_OUTPUT_RULES,
  RECOGNITION_MAX_TOKENS,
  VelumError,
  isVelumError,
  quickScanFields,
  type AnalysisResult,
  type AnalyzeDeps,
  type Candidate,
  type CaptureInput,
  type DomainPlugin,
  type PriceObservation,
  type PriceQuery,
  type RecognitionResult,
  type RecognizeDeps,
  type SourceRef,
  type ValuateDeps,
  type ValuationResult,
  type WineAnalysisPayload,
  type WineComparisons,
  type WineMarket,
  type WineRatings,
  type WineTastingProfile,
} from '@velum/core';
import { asFiniteNumber, asNonEmptyString, clamp01, isRecord } from './guards.ts';
import { parseModelJson } from './json.ts';
import { normalizeWineLabel, parseVintage } from './normalize.ts';
import { ZAPPA_SYSTEM_PROMPT } from './zappa.ts';

/** Seuil sous lequel on bascule sur la saisie assistée (§3.3). */
const ASSISTED_ENTRY_THRESHOLD = 0.35;

/** Avertissements obligatoires — TOUJOURS présents sur chaque fiche (§12.4). */
export const WINE_DISCLAIMERS: readonly string[] = [
  'Estimation indicative — ni expertise légale, ni conseil en investissement.',
  'Le score spéculatif est purement informatif et ne constitue jamais une recommandation d’achat ou de placement.',
  'L’état réel de la bouteille (niveau, bouchon, étiquette, conditions de stockage) peut modifier sensiblement la valeur et le potentiel de garde.',
];

/** Plafond d'une fourchette indicative par bouteille (EUR) : au-delà, valeur aberrante. */
const WINE_MAX_ESTIMATE_EUR = 1_000_000;

/** System prompt de l'étage de reconnaissance (photo étiquette/capsule ou texte libre) — scan éclair. */
export const WINE_RECOGNITION_SYSTEM_PROMPT = `Tu es l'étage d'identification du module Vin de VELUM (scan éclair).
À partir de photos (étiquette, capsule, bouteille) ou d'une description libre — éventuellement
floue ou incomplète ("grand vin de Bordeaux bio 2019") — tu proposes AU MAXIMUM 3 candidats
d'identification plausibles, triés par confiance décroissante, avec une fourchette de prix
indicative et un classement.

Tu réponds UNIQUEMENT avec un JSON strict de la forme :
{"candidates":[{"label":"Producteur Cuvée Millésime","confidence":0.0,"attributes":{
  "producer":"...","appellation":"...","cuvee":"...","vintage":2019,
  "color":"rouge|blanc|rosé|orange|effervescent",
  "grapes":[{"name":"...","percent":50}],
  "farming":"conventionnel|bio|biodynamie|HVE|nature|inconnu",
  "region":"...","country":"...","format":"750ml"},
  "estimate":{"low":20,"high":35},"classification":["Vin","Bordeaux","Pauillac"]}]}

Règles :
- "confidence" est un nombre entre 0 et 1 qui reflète HONNÊTEMENT ton doute — jamais de
  fausse certitude. Une entrée vague mérite une confiance basse.
- Le millésime se lit sur l'étiquette ou la collerette : s'il n'est pas visible, omets-le et
  baisse la confiance (il change souvent la valeur).
- "grapes" et "farming" seulement s'ils sont lus sur l'étiquette.
- "estimate" : prix indicatif d'UNE bouteille au format indiqué, en euros.
- "classification" : Vin › région › appellation.
- Omets tout attribut inconnu plutôt que de l'inventer.
${QUICK_SCAN_OUTPUT_RULES}`;

/** Identifiant unique de candidat (UUID natif si disponible). */
function newCandidateId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `wine-${cryptoApi.randomUUID()}`;
  }
  return `wine-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

/**
 * Attributs lus, sans clés vides (null, chaîne vide) ; millésime en texte
 * (« 2019 ») ramené à un nombre.
 */
function compactAttributes(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    out[key] = value;
  }
  const vintage = out['vintage'];
  if (typeof vintage === 'string' && /^\d{4}$/.test(vintage.trim())) out['vintage'] = Number(vintage.trim());
  return out;
}

/** Mappe la réponse (déjà parsée) du LLM vers des candidats bornés/triés/tronqués. */
function toCandidates(parsed: unknown): Candidate[] {
  if (!isRecord(parsed) || !Array.isArray(parsed['candidates'])) return [];
  const candidates: Candidate[] = [];
  for (const entry of parsed['candidates']) {
    if (!isRecord(entry)) continue;
    const label = asNonEmptyString(entry['label']);
    if (!label) continue;
    const confidence = clamp01(asFiniteNumber(entry['confidence']) ?? 0);
    candidates.push({
      id: newCandidateId(),
      domain: 'wine',
      label,
      confidence,
      attributes: isRecord(entry['attributes']) ? compactAttributes(entry['attributes']) : {},
      ...quickScanFields(entry, confidence, { maxEur: WINE_MAX_ESTIMATE_EUR }),
    });
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 3);
}

/** Mappe une ligne d'import (CSV/Excel/JSON) en candidat de saisie assistée. */
function fileRowToCandidate(row: Record<string, unknown>, index: number): Candidate {
  const direct =
    asNonEmptyString(row['label']) ??
    asNonEmptyString(row['name']) ??
    asNonEmptyString(row['wine']) ??
    asNonEmptyString(row['title']);
  const composed = [
    asNonEmptyString(row['producer']),
    asNonEmptyString(row['cuvee']),
    asFiniteNumber(row['vintage'])?.toString(),
  ]
    .filter((part): part is string => part !== undefined)
    .join(' ');
  const label = direct ?? (composed.length > 0 ? composed : `Ligne ${index + 1}`);

  const attributes: Record<string, unknown> = { ...row };
  if (attributes['vintage'] === undefined) {
    const vintage = parseVintage(label);
    if (vintage !== null) attributes['vintage'] = vintage;
  }
  return { id: newCandidateId(), domain: 'wine', label, confidence: 0.95, attributes };
}

/** Construit le prompt utilisateur de l'analyse ZAPPA à partir du candidat. */
function buildAnalysisPrompt(candidate: Candidate): string {
  const attributes = JSON.stringify(candidate.attributes);
  return `Analyse le vin suivant selon tes 7 modules et restitue UNIQUEMENT le JSON strict du module 6.
Vin : ${candidate.label}
Attributs identifiés : ${attributes}
Confiance d'identification : ${clamp01(candidate.confidence).toFixed(2)}
N'oublie pas : notes critiques uniquement si connues avec certitude (sinon null), et chaque doute dans "uncertainties".`;
}

/**
 * Coercition défensive du JSON du modèle vers WineAnalysisPayload : les
 * modules manquants reçoivent un défaut neutre ET une entrée dans
 * uncertainties — on ne masque jamais une lacune du modèle.
 */
function sanitizeWinePayload(
  parsed: Record<string, unknown>,
  candidate: Candidate,
): WineAnalysisPayload {
  const uncertainties = Array.isArray(parsed['uncertainties'])
    ? parsed['uncertainties'].filter(
        (u): u is string => typeof u === 'string' && u.trim().length > 0,
      )
    : [];

  const identification = (
    isRecord(parsed['identification']) ? parsed['identification'] : { ...candidate.attributes }
  ) as WineAnalysisPayload['identification'];

  let tasting: WineTastingProfile;
  if (isRecord(parsed['tasting'])) {
    tasting = parsed['tasting'] as unknown as WineTastingProfile;
  } else {
    const year = new Date().getFullYear();
    tasting = {
      robe: 'non renseignée',
      nose: [],
      palate: { structure: 'non renseignée', acidity: 'non renseignée' },
      length: 'non renseignée',
      agingPotentialYears: [0, 0],
      drinkWindow: { from: year, to: year },
    };
    uncertainties.push('Profil œnologique indisponible : caractéristiques de dégustation non fournies par le moteur.');
  }

  const ratings = (
    isRecord(parsed['ratings'])
      ? { positioning: 'inconnu', ...parsed['ratings'] }
      : { positioning: 'inconnu' }
  ) as unknown as WineRatings;

  let market: WineMarket;
  if (isRecord(parsed['market'])) {
    market = { assetClass: 'conso', ...parsed['market'] } as unknown as WineMarket;
  } else {
    market = { assetClass: 'conso' };
    uncertainties.push('Données marché indisponibles : classe de placement par défaut « conso ».');
  }

  const comparisons = (
    isRecord(parsed['comparisons'])
      ? { foodPairings: [], ...parsed['comparisons'] }
      : { foodPairings: [] }
  ) as unknown as WineComparisons;

  // Garde-fou module 7 : uncertainties JAMAIS vide.
  if (uncertainties.length === 0) {
    uncertainties.push(
      'Aucune incertitude signalée par le moteur — prudence : vérifier l’identification (millésime, homonymes) avant toute décision.',
    );
  }

  return { identification, tasting, ratings, market, comparisons, uncertainties };
}

/** Références éditoriales citées : uniquement celles réellement présentes dans la fiche. */
function editorialSources(payload: WineAnalysisPayload): SourceRef[] {
  const refs: SourceRef[] = [];
  const ratings = payload.ratings;
  if (ratings.rvf) {
    refs.push({ name: 'La Revue du Vin de France', kind: 'official_quote', url: 'https://www.larvf.com' });
  }
  if (ratings.bettaneDesseauve) {
    refs.push({ name: 'Bettane+Desseauve', kind: 'official_quote', url: 'https://www.mybettanedesseauve.fr' });
  }
  if (ratings.parker) {
    refs.push({ name: 'Robert Parker Wine Advocate', kind: 'official_quote', url: 'https://www.robertparker.com' });
  }
  if (ratings.suckling) {
    refs.push({ name: 'James Suckling', kind: 'official_quote', url: 'https://www.jamessuckling.com' });
  }
  if (ratings.jancisRobinson) {
    refs.push({ name: 'Jancis Robinson', kind: 'official_quote', url: 'https://www.jancisrobinson.com' });
  }
  if (refs.length === 0) {
    refs.push({ name: 'Base éditoriale ZAPPA∴VINI∴SAPIENS (références professionnelles vérifiables)', kind: 'official_quote' });
  }
  return refs;
}

export class WineDomainPlugin implements DomainPlugin<WineAnalysisPayload> {
  readonly domain = 'wine' as const;

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
      images = input.media
        ?.filter((media) => media.base64)
        .map((media) => toVisionImage(media.base64 as string));
      if (!images || images.length === 0) return assistedFallback();
      prompt =
        'Identifie le vin visible sur ces photos (étiquette, capsule, bouteille). ' +
        'Réponds avec le JSON strict décrit dans tes instructions (max 3 candidats).';
    } else {
      const text = asNonEmptyString(input.text);
      if (!text) return assistedFallback();
      prompt =
        `Identifie le vin décrit par cette saisie libre, éventuellement floue ou incomplète : « ${text} ». ` +
        'Propose les candidats les plus plausibles avec une confiance honnête. ' +
        'Réponds avec le JSON strict décrit dans tes instructions (max 3 candidats).';
    }

    // On n'avale PAS l'erreur : une panne d'infrastructure (clé morte, quota
    // dépassé, modèle supprimé, service down) doit remonter au client en 429/503.
    // La déguiser en « saisie assistée » rend toute panne invisible — c'est ce qui
    // a masqué la troncature Gemini. Ici, `assistedFallback` ne signifie plus
    // qu'une chose : le modèle a répondu, mais n'a rien su identifier.
    const raw = await deps.vision.complete({
      system: WINE_RECOGNITION_SYSTEM_PROMPT,
      prompt,
      ...(images ? { images } : {}),
      maxTokens: RECOGNITION_MAX_TOKENS,
    });

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
  ): Promise<AnalysisResult<WineAnalysisPayload>> {
    let raw: string;
    try {
      raw = await deps.vision.complete({
        system: ZAPPA_SYSTEM_PROMPT,
        prompt: buildAnalysisPrompt(candidate),
        maxTokens: 4096,
      });
    } catch (error) {
      // Une erreur déjà typée garde son code : un 429 (quota) doit rester un 429,
      // pas devenir un ANALYSIS_FAILED indistinct — le client n'aurait plus aucun
      // moyen de faire la différence entre « réessaie plus tard » et « c'est cassé ».
      if (isVelumError(error)) throw error;
      throw new VelumError('ANALYSIS_FAILED', 'Le moteur ZAPPA∴VINI∴SAPIENS est indisponible', {
        cause: String(error),
      });
    }

    const parsed = parseModelJson(raw);
    if (!isRecord(parsed)) {
      throw new VelumError(
        'ANALYSIS_FAILED',
        'Réponse du moteur ZAPPA∴VINI∴SAPIENS illisible — analyse indisponible',
      );
    }

    const payload = sanitizeWinePayload(parsed, candidate);
    // Confiance globale : confiance d'identification, pénalisée par les incertitudes signalées.
    const penalty = Math.min(0.3, 0.05 * payload.uncertainties.length);
    const confidence = Math.round(Math.max(0.05, clamp01(candidate.confidence) - penalty) * 100) / 100;

    return {
      engine: 'zappa_vini',
      payload,
      confidence,
      sources: editorialSources(payload),
      disclaimers: [...WINE_DISCLAIMERS],
    };
  }

  buildPriceQuery(candidate: Candidate): PriceQuery {
    const attributes = candidate.attributes;
    const producer = asNonEmptyString(attributes['producer']);
    const cuvee = asNonEmptyString(attributes['cuvee']);
    const appellation = asNonEmptyString(attributes['appellation']);
    const vintage = asFiniteNumber(attributes['vintage']) ?? parseVintage(candidate.label);

    // Libellé canonique : attributs textuels + millésime ; sans attribut textuel,
    // repli sur le label du candidat (en y ajoutant le millésime s'il en est absent).
    const textParts = [producer, cuvee, appellation].filter(
      (part): part is string => part !== undefined,
    );
    let canonical: string;
    if (textParts.length > 0) {
      canonical = [...textParts, ...(vintage !== null ? [String(vintage)] : [])].join(' ');
    } else {
      canonical =
        vintage !== null && !candidate.label.includes(String(vintage))
          ? `${candidate.label} ${vintage}`
          : candidate.label;
    }
    const condition = asNonEmptyString(attributes['condition']);

    return {
      domain: 'wine',
      label: normalizeWineLabel(canonical),
      attributes: {
        ...attributes,
        ...(vintage !== null ? { vintage } : {}),
      },
      ...(condition ? { condition } : {}),
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

/** Instance partagée du plugin Vin — enregistrée dans le registre des domaines. */
export const winePlugin = new WineDomainPlugin();
