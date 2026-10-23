/**
 * Enregistrement d'un objet capturé : création atomique objet + médias, et
 * attributs selon le mode — scan éclair (fiche complète à charger plus tard)
 * ou fiche complète générée avant l'enregistrement. Conventions de
 * `items.attributes` : voir lib/analysisState.ts.
 */
import {
  VelumError,
  type AnalysisResult,
  type Candidate,
  type MediaRole,
  type VelumDomain,
  type VelumItem,
} from '@velum/core';
import type {
  ItemMediaRepo,
  ItemsRepo,
  NewItem,
  NewItemMedia,
} from '@velum/api-client';

import {
  MAX_CORRECTIONS_KEPT,
  applyIdentityCorrections,
  identityValuesFrom,
} from './identityFields';

export interface CapturedMediaReference {
  role: MediaRole;
  storagePath?: string;
}

export interface CapturePersistenceDeps {
  items: Pick<ItemsRepo, 'insert' | 'remove'>;
  /** Optionnel pour les anciens clients injectés ; requis dès qu'un chemin existe. */
  itemMedia?: Pick<ItemMediaRepo, 'addMany'>;
}

function persistentMedia(
  itemId: string,
  media: CapturedMediaReference[],
): NewItemMedia[] {
  const pathByRole = new Map<MediaRole, string>();
  for (const entry of media) {
    const path = entry.storagePath?.trim();
    if (path) pathByRole.set(entry.role, path);
  }
  return [...pathByRole].map(([kind, storagePath]) => ({
    itemId,
    kind,
    storagePath,
  }));
}

/**
 * Crée l'objet puis rattache, en une insertion atomique, tous les chemins déjà
 * téléversés. Si le rattachement échoue, l'objet incomplet est supprimé avant
 * de rendre l'erreur visible afin qu'une nouvelle tentative ne crée pas de doublon.
 */
export async function insertCapturedItem(
  input: NewItem,
  media: CapturedMediaReference[],
  deps: CapturePersistenceDeps,
): Promise<VelumItem> {
  const item = await deps.items.insert(input);
  const attachments = persistentMedia(item.id, media);
  if (attachments.length === 0) return item;

  try {
    if (!deps.itemMedia) {
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        'Le client ne peut pas rattacher les médias téléversés à cet objet.',
      );
    }
    await deps.itemMedia.addMany(attachments);
    return item;
  } catch (attachmentError) {
    try {
      await deps.items.remove(item.id);
    } catch (rollbackError) {
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        "L’objet a été créé sans ses médias et la suppression de sécurité a échoué.",
        {
          itemId: item.id,
          attachmentCause:
            attachmentError instanceof Error ? attachmentError.message : String(attachmentError),
          rollbackCause:
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        },
      );
    }
    throw attachmentError;
  }
}

// ── Attributs selon le mode d'enregistrement ─────────────────────────────────

/**
 * Clés réservées à la fiche complète : jamais reprises des attributs d'un
 * candidat (un modèle ou un fichier importé ne doit pas pouvoir forger une
 * « fiche » ni son état).
 */
const ANALYSIS_KEYS: readonly string[] = [
  'analysis',
  'analysisEngine',
  'analysisStatus',
  'analyzedAt',
  'disclaimers',
  'quickEstimate',
  'classification',
];

function withoutAnalysisKeys(attributes: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!ANALYSIS_KEYS.includes(key)) out[key] = value;
  }
  return out;
}

/** Champs du scan éclair (fourchette indicative, classement) recopiés sur l'objet. */
function quickScanAttributes(candidate: Candidate): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (candidate.quickEstimate !== undefined) out['quickEstimate'] = { ...candidate.quickEstimate };
  if (candidate.classification !== undefined && candidate.classification.length > 0) {
    out['classification'] = [...candidate.classification];
  }
  return out;
}

/**
 * Scan éclair : identité (corrections comprises) + fourchette indicative +
 * classement, fiche complète marquée « à charger » (`analysisStatus: 'pending'`).
 */
export function quickCaptureAttributes(candidate: Candidate): Record<string, unknown> {
  return {
    ...withoutAnalysisKeys(candidate.attributes),
    ...quickScanAttributes(candidate),
    analysisStatus: 'pending',
  };
}

/** Enregistrement avec fiche complète déjà générée (horodatée `analyzedAt`). */
export function fullCaptureAttributes(
  candidate: Candidate,
  analysis: Pick<AnalysisResult, 'payload' | 'engine' | 'disclaimers'>,
  now: Date,
): Record<string, unknown> {
  return {
    ...withoutAnalysisKeys(candidate.attributes),
    ...quickScanAttributes(candidate),
    analysis: analysis.payload,
    analysisEngine: analysis.engine,
    disclaimers: analysis.disclaimers,
    analyzedAt: now.toISOString(),
  };
}

/**
 * Correction AVANT enregistrement des infos lues sur la photo : champs
 * d'identification du domaine + libellé. Chaque changement est tracé dans
 * `attributes.corrections` (valeur lue → valeur saisie). Si l'identité change,
 * la fourchette indicative — calculée pour l'objet MAL lu — est retirée : la
 * valorisation lancée après l'enregistrement portera sur l'identité corrigée.
 * Pré-condition : `validateIdentityValues` sans erreur.
 */
export function correctCandidate(input: {
  candidate: Candidate;
  domain: VelumDomain;
  values: Record<string, string>;
  label: string;
  now: Date;
}): { candidate: Candidate; changed: boolean } {
  // Un formulaire partiel (champs principaux seulement) ne doit pas effacer les
  // champs qu'il n'affiche pas : on part des valeurs lues sur la photo.
  const values = { ...identityValuesFrom(input.candidate.attributes, input.domain), ...input.values };
  const result = applyIdentityCorrections({
    domain: input.domain,
    attributes: input.candidate.attributes,
    title: input.candidate.label,
    values,
    newTitle: input.label,
    now: input.now,
  });
  // Une valeur seulement re-typée (5 lu en nombre, « 5 » ressaisi) n'est pas
  // une correction : on garde la valeur lue et on ne la trace pas.
  const original = input.candidate.attributes;
  const real = result.corrections.filter(
    (c) => c.field === 'title' || String(c.from ?? '') !== String(c.to ?? ''),
  );
  if (real.length === 0) return { candidate: input.candidate, changed: false };
  const attributes: Record<string, unknown> = { ...result.attributes };
  for (const correction of result.corrections) {
    if (!real.includes(correction)) attributes[correction.field] = original[correction.field];
  }
  const history = Array.isArray(original['corrections']) ? (original['corrections'] as unknown[]) : [];
  attributes['corrections'] = [...history, ...real].slice(-MAX_CORRECTIONS_KEPT);

  const identityChanged = real.some((c) => c.field !== 'title');
  const { quickEstimate, ...rest } = input.candidate;
  const corrected: Candidate = {
    ...rest,
    label: result.title ?? input.candidate.label,
    attributes,
    ...(quickEstimate !== undefined && !identityChanged ? { quickEstimate } : {}),
  };
  return { candidate: corrected, changed: true };
}

/** Objet à créer depuis un candidat (titre = libellé, confiance conservée). */
export function newItemFromCandidate(
  ownerId: string,
  domain: VelumDomain,
  candidate: Candidate,
  attributes: Record<string, unknown>,
): NewItem {
  return {
    ownerId,
    domain,
    title: candidate.label,
    confidence: candidate.confidence,
    attributes,
  };
}

// ── Valorisations en arrière-plan ────────────────────────────────────────────

export type BackgroundOutcome = 'ok' | 'failed';

/**
 * Lance une tâche NON BLOQUANTE (valorisation après un scan éclair) : la
 * promesse retournée ne rejette jamais ; l'échec est remonté à `onError`
 * (toast discret) et l'objet reste consultable sans estimation.
 */
export async function runInBackground(
  task: () => Promise<unknown>,
  onError: (error: unknown) => void,
): Promise<BackgroundOutcome> {
  try {
    await task();
    return 'ok';
  } catch (error) {
    try {
      onError(error);
    } catch {
      // un rapporteur défaillant ne doit pas faire échouer la file
    }
    return 'failed';
  }
}

/**
 * File SÉRIALISÉE de tâches d'arrière-plan (mode classeur : une valorisation
 * à la fois, pour ne pas saturer les sources de prix ni le quota d'appels).
 * Une tâche en échec n'interrompt pas les suivantes.
 */
export interface SerialQueue {
  push(task: () => Promise<unknown>): Promise<BackgroundOutcome>;
  /** Tâches en attente ou en cours. */
  pending(): number;
}

export function createSerialQueue(onError: (error: unknown) => void): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  let count = 0;
  return {
    push(task) {
      count += 1;
      const run = tail.then(() => runInBackground(task, onError));
      tail = run.finally(() => {
        count -= 1;
      });
      return run;
    },
    pending: () => count,
  };
}
