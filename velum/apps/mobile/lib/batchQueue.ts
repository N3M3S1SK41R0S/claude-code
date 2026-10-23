/**
 * Mode classeur — logique PURE de la file d'enregistrement en série.
 *
 * Deux sous-modes partagent la même file :
 *  - « Série » : une photo = un objet ; chaque prise devient une ligne
 *    `pending`, reconnue en arrière-plan (concurrence bornée à 2) ;
 *  - « Planche » : UNE photo de page de classeur / de plateau ; sa ligne est
 *    remplacée, une fois reconnue, par une ligne par objet détecté.
 *
 * Cycle d'une ligne :
 *   pending → running → identified | uncertain | failed (réessayable)
 *   identified | uncertain → saving → saved      (ou retour en cas d'échec)
 *   identified | uncertain | failed → skipped    (ignorée, rétablissable)
 * Toute transition non prévue laisse l'état inchangé (jamais d'exception).
 */
import {
  ASSISTED_ENTRY_THRESHOLD,
  type Candidate,
  type QuickEstimate,
  type SheetDetection,
  type VelumDomain,
} from '@velum/core';

import type { CapturedMediaReference } from './capturePersistence';

/** Reconnaissances simultanées au plus (débit réseau mobile, quota d'appels). */
export const BATCH_CONCURRENCY = 2;

/** Sous ce seuil, la ligne est « incertaine » (même seuil que la saisie assistée). */
export const UNCERTAIN_BELOW = ASSISTED_ENTRY_THRESHOLD;

/**
 * Seuil de « Tout enregistrer » : 0,6. Nettement au-dessus du seuil de saisie
 * assistée (0,35) — la zone 0,35–0,6 est identifiée mais mérite un coup d'œil,
 * l'utilisateur l'enregistre ligne par ligne. Une ligne corrigée à la main est
 * toujours jugée fiable : l'utilisateur l'a validée.
 */
export const RELIABLE_CONFIDENCE = 0.6;

/** Domaines où le sous-mode « Planche » existe (plugins avec recognizeSheet). */
export const SHEET_DOMAINS: readonly VelumDomain[] = ['stamp', 'coin'];

export function supportsSheet(domain: VelumDomain): boolean {
  return SHEET_DOMAINS.includes(domain);
}

/** Domaines où le mode classeur est mis en avant (séries à ranger). */
export function isBinderFirst(domain: VelumDomain): boolean {
  return supportsSheet(domain);
}

/**
 * Photo d'une ligne : rôle, chemin Storage une fois téléversée, et data URL
 * (clé du téléversement en cours — la même chaîne est partagée, pas copiée,
 * entre une planche et ses objets détectés).
 */
export interface BatchMedia extends CapturedMediaReference {
  base64?: string;
}

export type BatchRowStatus =
  | 'pending'
  | 'running'
  | 'identified'
  | 'uncertain'
  | 'failed'
  | 'saving'
  | 'saved'
  | 'skipped';

/** Origine d'une ligne : prise unitaire, photo de planche, objet détecté sur une planche. */
export type BatchRowSource = 'shot' | 'sheet' | 'detection';

export interface BatchRow {
  id: string;
  /** Ordre d'affichage stable. */
  seq: number;
  /** Prise d'origine : la ligne elle-même, ou la planche dont l'objet est issu. */
  groupId: string;
  /** Rang de la prise d'origine (une planche éclatée garde sa place). */
  groupSeq: number;
  source: BatchRowSource;
  status: BatchRowStatus;
  /** Vignette locale (URI ou data URL). */
  thumbnailUri?: string;
  /** Position sur la planche (ligne `detection`). */
  position?: string;
  /** Photo(s) à rattacher à l'objet (chemin Storage connu après téléversement). */
  media: BatchMedia[];
  candidates: Candidate[];
  /** Candidat retenu parmi `candidates` (0 = le plus probable). */
  chosenIndex: number;
  /** Candidat corrigé par l'utilisateur — prioritaire sur le choix. */
  edited?: Candidate;
  /** Code d'erreur (i18n `errors.<code>` / `batch.errors.<code>`). */
  errorCode?: string;
  /** Tentatives de reconnaissance effectuées. */
  attempts: number;
  /** Statut avant `saving` / `skipped`, pour y revenir. */
  previousStatus?: BatchRowStatus;
  /** Objet créé (ligne `saved`). */
  itemId?: string;
}

export interface BatchState {
  rows: BatchRow[];
  nextSeq: number;
  /** Planches dont la liste d'objets est incomplète (photographier le reste). */
  truncatedSheets: string[];
}

export const EMPTY_BATCH: BatchState = { rows: [], nextSeq: 0, truncatedSheets: [] };

export type BatchAction =
  | { type: 'enqueue'; id: string; source: 'shot' | 'sheet'; thumbnailUri?: string; media: BatchMedia[] }
  /** Téléversement terminé : toutes les lignes portant cette photo reçoivent le chemin. */
  | { type: 'uploaded'; photo: string; storagePath: string }
  | { type: 'start'; id: string }
  | { type: 'recognized'; id: string; candidates: Candidate[] }
  | { type: 'sheetRecognized'; id: string; detections: SheetDetection[]; truncated: boolean }
  | { type: 'failed'; id: string; errorCode: string }
  | { type: 'retry'; id: string }
  | { type: 'choose'; id: string; index: number }
  | { type: 'edit'; id: string; candidate: Candidate }
  | { type: 'skip'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'saving'; id: string }
  | { type: 'saved'; id: string; itemId: string }
  | { type: 'saveFailed'; id: string; errorCode: string }
  | { type: 'remove'; id: string };

/** Statut d'une ligne reconnue selon la confiance du meilleur candidat. */
export function statusForCandidates(candidates: readonly Candidate[]): 'identified' | 'uncertain' {
  const best = candidates.reduce((max, c) => Math.max(max, c.confidence), 0);
  return candidates.length > 0 && best >= UNCERTAIN_BELOW ? 'identified' : 'uncertain';
}

function sortByConfidence(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => b.confidence - a.confidence);
}

function updateRow(
  state: BatchState,
  id: string,
  update: (row: BatchRow) => BatchRow | null,
): BatchState {
  let changed = false;
  const rows = state.rows.map((row) => {
    if (row.id !== id) return row;
    const next = update(row);
    if (next === null || next === row) return row;
    changed = true;
    return next;
  });
  return changed ? { ...state, rows } : state;
}

const RECOGNIZED: readonly BatchRowStatus[] = ['identified', 'uncertain'];

/** Réducteur de la file (pur, transitions gardées). */
export function batchReducer(state: BatchState, action: BatchAction): BatchState {
  switch (action.type) {
    case 'enqueue': {
      if (state.rows.some((row) => row.id === action.id)) return state;
      const row: BatchRow = {
        id: action.id,
        seq: state.nextSeq,
        groupId: action.id,
        groupSeq: state.nextSeq,
        source: action.source,
        status: 'pending',
        ...(action.thumbnailUri !== undefined ? { thumbnailUri: action.thumbnailUri } : {}),
        media: action.media.map((m) => ({ ...m })),
        candidates: [],
        chosenIndex: 0,
        attempts: 0,
      };
      return { ...state, rows: [...state.rows, row], nextSeq: state.nextSeq + 1 };
    }

    case 'uploaded': {
      let changed = false;
      const rows = state.rows.map((row) => {
        if (!row.media.some((m) => m.base64 === action.photo && m.storagePath !== action.storagePath)) {
          return row;
        }
        changed = true;
        return {
          ...row,
          media: row.media.map((m) => (m.base64 === action.photo ? { ...m, storagePath: action.storagePath } : m)),
        };
      });
      return changed ? { ...state, rows } : state;
    }

    case 'start':
      return updateRow(state, action.id, (row) =>
        row.status === 'pending' ? { ...row, status: 'running', attempts: row.attempts + 1 } : null,
      );

    case 'recognized':
      return updateRow(state, action.id, (row) => {
        if (row.status !== 'running' || row.source === 'sheet') return null;
        const candidates = sortByConfidence(action.candidates).slice(0, 3);
        const { errorCode: _drop, ...rest } = row;
        return { ...rest, status: statusForCandidates(candidates), candidates, chosenIndex: 0 };
      });

    case 'sheetRecognized': {
      const sheet = state.rows.find((row) => row.id === action.id);
      if (!sheet || sheet.status !== 'running' || sheet.source !== 'sheet') return state;
      if (action.detections.length === 0) {
        return updateRow(state, action.id, (row) => ({ ...row, status: 'failed', errorCode: 'NO_DETECTION' }));
      }
      let seq = state.nextSeq;
      const detectionRows: BatchRow[] = action.detections.map((detection) => {
        const candidates = sortByConfidence(detection.candidates).slice(0, 3);
        return {
          id: `${sheet.id}-${detection.index}`,
          seq: seq++,
          groupId: sheet.id,
          groupSeq: sheet.groupSeq,
          source: 'detection',
          status: detection.needsAssistedEntry ? 'uncertain' : statusForCandidates(candidates),
          ...(sheet.thumbnailUri !== undefined ? { thumbnailUri: sheet.thumbnailUri } : {}),
          ...(detection.position !== undefined ? { position: detection.position } : {}),
          // La photo de planche est rattachée à chaque objet en « détail ».
          media: sheet.media.map((m) => ({ ...m, role: 'detail' as const })),
          candidates,
          chosenIndex: 0,
          attempts: 1,
        };
      });
      const index = state.rows.findIndex((row) => row.id === action.id);
      const rows = [...state.rows.slice(0, index), ...detectionRows, ...state.rows.slice(index + 1)];
      return {
        rows,
        nextSeq: seq,
        truncatedSheets: action.truncated ? [...state.truncatedSheets, action.id] : state.truncatedSheets,
      };
    }

    case 'failed':
      return updateRow(state, action.id, (row) =>
        row.status === 'running' ? { ...row, status: 'failed', errorCode: action.errorCode } : null,
      );

    case 'retry':
      return updateRow(state, action.id, (row) => {
        if (row.status !== 'failed' || row.source === 'detection') return null;
        const { errorCode: _drop, ...rest } = row;
        return { ...rest, status: 'pending' };
      });

    case 'choose':
      return updateRow(state, action.id, (row) => {
        if (!RECOGNIZED.includes(row.status)) return null;
        if (!Number.isInteger(action.index) || action.index < 0 || action.index >= row.candidates.length) {
          return null;
        }
        const { edited: _drop, ...rest } = row;
        return { ...rest, chosenIndex: action.index };
      });

    case 'edit':
      return updateRow(state, action.id, (row) => {
        if (!RECOGNIZED.includes(row.status)) return null;
        // Une ligne corrigée a désormais une identité : elle n'est plus incertaine.
        return { ...row, edited: action.candidate, status: 'identified' };
      });

    case 'skip':
      return updateRow(state, action.id, (row) =>
        RECOGNIZED.includes(row.status) || row.status === 'failed'
          ? { ...row, previousStatus: row.status, status: 'skipped' }
          : null,
      );

    case 'restore':
      return updateRow(state, action.id, (row) => {
        if (row.status !== 'skipped') return null;
        const { previousStatus, ...rest } = row;
        return { ...rest, status: previousStatus ?? 'uncertain' };
      });

    case 'saving':
      return updateRow(state, action.id, (row) => {
        if (!RECOGNIZED.includes(row.status) || effectiveCandidate(row) === null) return null;
        const { errorCode: _drop, ...rest } = row;
        return { ...rest, previousStatus: row.status, status: 'saving' };
      });

    case 'saved':
      return updateRow(state, action.id, (row) => {
        if (row.status !== 'saving') return null;
        const { previousStatus: _drop, ...rest } = row;
        return { ...rest, status: 'saved', itemId: action.itemId };
      });

    case 'saveFailed':
      return updateRow(state, action.id, (row) => {
        if (row.status !== 'saving') return null;
        const { previousStatus, ...rest } = row;
        return { ...rest, status: previousStatus ?? 'identified', errorCode: action.errorCode };
      });

    case 'remove': {
      // Une ligne en cours (reconnaissance ou enregistrement) ne disparaît pas sous l'utilisateur.
      const row = state.rows.find((r) => r.id === action.id);
      if (!row || row.status === 'running' || row.status === 'saving') return state;
      return {
        ...state,
        rows: state.rows.filter((r) => r.id !== action.id),
        truncatedSheets: state.truncatedSheets.filter((id) => id !== action.id),
      };
    }
  }
}

/**
 * Ordre d'affichage : la prise la plus récente en haut (retour immédiat sous
 * la caméra), mais les objets d'une même planche dans leur ordre de lecture.
 */
export function displayOrder(state: BatchState): BatchRow[] {
  return [...state.rows].sort((a, b) =>
    a.groupSeq !== b.groupSeq ? b.groupSeq - a.groupSeq : a.seq - b.seq,
  );
}

/** Lignes encore à traiter avant de quitter (rien n'est perdu en silence). */
export function unsavedCount(state: BatchState): number {
  return state.rows.filter((row) => row.status !== 'saved' && row.status !== 'skipped').length;
}

/** Candidat qui sera enregistré : correction de l'utilisateur, sinon choix. */
export function effectiveCandidate(row: BatchRow): Candidate | null {
  return row.edited ?? row.candidates[row.chosenIndex] ?? null;
}

/**
 * Lignes à démarrer maintenant : les plus anciennes en attente, dans la
 * limite de `concurrency` reconnaissances simultanées. `inFlight` couvre les
 * démarrages déjà lancés mais pas encore visibles dans l'état.
 */
export function nextToRun(
  state: BatchState,
  concurrency: number = BATCH_CONCURRENCY,
  inFlight: ReadonlySet<string> = new Set(),
): string[] {
  const running = new Set(inFlight);
  for (const row of state.rows) if (row.status === 'running') running.add(row.id);
  const free = Math.max(0, Math.floor(concurrency) - running.size);
  if (free === 0) return [];
  return state.rows
    .filter((row) => row.status === 'pending' && !running.has(row.id))
    .sort((a, b) => a.seq - b.seq)
    .slice(0, free)
    .map((row) => row.id);
}

/** true si la ligne peut partir dans « Tout enregistrer ». */
export function isReliable(row: BatchRow, threshold: number = RELIABLE_CONFIDENCE): boolean {
  if (row.status !== 'identified') return false;
  if (row.edited !== undefined) return true;
  const candidate = effectiveCandidate(row);
  return candidate !== null && candidate.confidence >= threshold;
}

/** Lignes fiables, dans l'ordre d'affichage. */
export function reliableRows(state: BatchState, threshold: number = RELIABLE_CONFIDENCE): BatchRow[] {
  return state.rows.filter((row) => isReliable(row, threshold)).sort((a, b) => a.seq - b.seq);
}

export interface BatchSummary {
  total: number;
  waiting: number;
  identified: number;
  uncertain: number;
  failed: number;
  saved: number;
  skipped: number;
  reliable: number;
  /** Somme des fourchettes indicatives des lignes identifiées ou enregistrées. */
  indicativeTotal: QuickEstimate | null;
  /** La file travaille encore (reconnaissance ou enregistrement). */
  busy: boolean;
}

/** Synthèse affichée en tête de l'écran (compteurs + valeur indicative). */
export function batchSummary(state: BatchState): BatchSummary {
  const summary: BatchSummary = {
    total: 0,
    waiting: 0,
    identified: 0,
    uncertain: 0,
    failed: 0,
    saved: 0,
    skipped: 0,
    reliable: 0,
    indicativeTotal: null,
    busy: false,
  };
  let low = 0;
  let high = 0;
  let priced = 0;
  for (const row of state.rows) {
    // Une photo de planche en attente compte pour une ligne tant qu'elle n'est pas éclatée.
    summary.total += 1;
    switch (row.status) {
      case 'pending':
      case 'running':
        summary.waiting += 1;
        summary.busy = true;
        break;
      case 'saving':
        summary.busy = true;
        summary.identified += 1;
        break;
      case 'identified':
        summary.identified += 1;
        break;
      case 'uncertain':
        summary.uncertain += 1;
        break;
      case 'failed':
        summary.failed += 1;
        break;
      case 'saved':
        summary.saved += 1;
        break;
      case 'skipped':
        summary.skipped += 1;
        break;
    }
    if (isReliable(row)) summary.reliable += 1;
    if (row.status === 'identified' || row.status === 'saving' || row.status === 'saved') {
      const estimate = effectiveCandidate(row)?.quickEstimate;
      if (estimate !== undefined) {
        low += estimate.low;
        high += estimate.high;
        priced += 1;
      }
    }
  }
  if (priced > 0) {
    summary.indicativeTotal = {
      low: Math.round(low * 100) / 100,
      high: Math.round(high * 100) / 100,
      currency: 'EUR',
    };
  }
  return summary;
}
