/**
 * Capture rapide (scan éclair ET mode classeur) — logique PURE de latence.
 *
 * Mesuré avant : la photo n'était téléversée qu'au clic sur « Analyser », PUIS
 * la reconnaissance attendait la fin du téléversement, PUIS le serveur
 * retéléchargeait la photo depuis Storage. Trois étapes en série.
 *
 * Maintenant :
 *  1. le téléversement démarre DÈS la prise de vue (pendant que l'utilisateur
 *     cadre la suivante ou relit l'écran) ;
 *  2. à la reconnaissance, une photo déjà téléversée part en `storagePath`
 *     (aucun octet en double) ; une photo dont le téléversement est encore en
 *     cours part en base64 dans la requête — `validateCaptureInput` accepte
 *     `storagePath: ''` + `base64`, et `hydrateMedia` utilise ce base64 tel
 *     quel —, sans attendre : reconnaissance et téléversement avancent en
 *     parallèle, le chemin servira à rattacher la photo à l'objet ;
 *  3. un téléversement en échec retombe sur le base64 (comportement existant)
 *     et est RELANCÉ au prochain essai (reconnaissance ou enregistrement) : un
 *     réseau revenu ne doit pas laisser l'objet enregistré sans sa photo.
 * Les photos sont aussi plus légères (qualité adaptée au mode, ci-dessous).
 */
import type { CaptureMedia, MediaRole, QuickEstimate, VelumDomain } from '@velum/core';

/** Qualité JPEG d'une prise « un objet » : lisibilité des légendes conservée, poids réduit. */
export const QUICK_JPEG_QUALITY = 0.6;
/** Qualité d'une photo de PLANCHE : 24 petits objets, les détails comptent. */
export const SHEET_JPEG_QUALITY = 0.85;
/** Grand côté maximal (web) d'une prise « un objet ». */
export const QUICK_MAX_EDGE = 1600;
/** Grand côté maximal (web) d'une photo de planche. */
export const SHEET_MAX_EDGE = 2600;

/**
 * Taille de photo native (`pictureSize` d'expo-camera) la plus grande dont le
 * grand côté tient dans `maxEdge` — `undefined` si aucune (résolution par
 * défaut du capteur). Une planche prise en pleine résolution à la qualité
 * 0,85 dépasse la limite de poids par image du fournisseur ; il la réduit de
 * toute façon vers ~1,15 Mpx : la pleine résolution n'apporte rien.
 */
export function pictureSizeWithin(sizes: readonly string[], maxEdge: number): string | undefined {
  let best: { size: string; area: number } | undefined;
  for (const size of sizes) {
    const match = /^(\d+)x(\d+)$/.exec(size.trim());
    if (!match) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Math.max(width, height) > maxEdge) continue;
    const area = width * height;
    if (best === undefined || area > best.area) best = { size: size.trim(), area };
  }
  return best?.size;
}

/** Cliché principal d'un objet en mode série (un objet = une photo). */
export const PRIMARY_ROLE: Record<VelumDomain, MediaRole> = {
  wine: 'label',
  coin: 'obverse',
  art: 'front',
  stamp: 'front',
  watch: 'dial',
};

export type UploadState =
  | { state: 'pending' }
  | { state: 'done'; path: string }
  | { state: 'failed' };

/**
 * Suivi des téléversements lancés à la prise de vue. Une même photo (clé =
 * data URL) n'est jamais téléversée deux fois tant qu'un téléversement est en
 * cours ou réussi ; une promesse ne rejette pas (`null` = échec, repli base64).
 */
export interface UploadTracker {
  /** Lance le téléversement, ou renvoie celui en cours / réussi ; un échec est relancé. */
  start(dataUrl: string): Promise<string | null>;
  peek(dataUrl: string): UploadState | undefined;
  /** Attend le téléversement s'il a été lancé ; `undefined` sinon. */
  wait(dataUrl: string): Promise<string | null> | undefined;
  forget(dataUrl: string): void;
  /** Oublie tout (nouvelle capture) : libère les photos gardées en mémoire. */
  clear(): void;
}

export function createUploadTracker(upload: (dataUrl: string) => Promise<string | null>): UploadTracker {
  const promises = new Map<string, Promise<string | null>>();
  const states = new Map<string, UploadState>();
  return {
    start(dataUrl) {
      const existing = promises.get(dataUrl);
      // Un échec n'est pas définitif (réseau coupé une seconde) : on relance.
      if (existing && states.get(dataUrl)?.state !== 'failed') return existing;
      states.set(dataUrl, { state: 'pending' });
      const promise = upload(dataUrl)
        .catch(() => null)
        .then((path) => {
          if (promises.get(dataUrl) === promise) {
            states.set(dataUrl, path ? { state: 'done', path } : { state: 'failed' });
          }
          return path;
        });
      promises.set(dataUrl, promise);
      return promise;
    },
    peek: (dataUrl) => states.get(dataUrl),
    wait: (dataUrl) => promises.get(dataUrl),
    forget(dataUrl) {
      promises.delete(dataUrl);
      states.delete(dataUrl);
    },
    clear() {
      promises.clear();
      states.clear();
    },
  };
}

/** Cliché du brouillon tel que la reconnaissance le voit. */
export interface ShotForRecognition {
  role: MediaRole;
  /** Data URL de la photo. */
  base64: string;
  /** Chemin déjà connu (téléversement terminé). */
  storagePath?: string;
}

/**
 * Médias à envoyer à `recognize` SANS attendre un téléversement en cours :
 * chemin Storage s'il est connu, sinon la photo en base64 (`storagePath: ''`).
 */
export function mediaForRecognition(
  shots: readonly ShotForRecognition[],
  tracker: Pick<UploadTracker, 'peek'>,
): CaptureMedia[] {
  return shots.map((shot) => {
    const known = shot.storagePath?.trim();
    if (known) return { role: shot.role, storagePath: known };
    const upload = tracker.peek(shot.base64);
    if (upload?.state === 'done') return { role: shot.role, storagePath: upload.path };
    return { role: shot.role, storagePath: '', base64: shot.base64 };
  });
}

/**
 * Chemins à rattacher à l'objet au moment de l'enregistrement : on attend les
 * téléversements encore en cours (en général terminés pendant la
 * reconnaissance). Une photo sans chemin — téléversement en échec, ou jamais
 * lancé — est relancée UNE fois ; si elle reste sans chemin, l'objet est
 * enregistré sans elle et l'appelant le signale (`countUnattached`).
 */
export async function settledStoragePaths(
  shots: readonly ShotForRecognition[],
  tracker: Pick<UploadTracker, 'wait' | 'start'>,
): Promise<{ role: MediaRole; storagePath?: string }[]> {
  return Promise.all(
    shots.map(async (shot) => {
      const known = shot.storagePath?.trim();
      if (known) return { role: shot.role, storagePath: known };
      if (shot.base64 === '') return { role: shot.role };
      const pending = tracker.wait(shot.base64);
      let path = pending ? await pending : null;
      // `start` relance un échec ; une photo jamais suivie est téléversée maintenant.
      if (!path) path = await tracker.start(shot.base64);
      return path ? { role: shot.role, storagePath: path } : { role: shot.role };
    }),
  );
}

/** Photos qui ne seront PAS rattachées à l'objet (à signaler, jamais en silence). */
export function countUnattached(paths: readonly { storagePath?: string }[]): number {
  return paths.filter((entry) => !entry.storagePath?.trim()).length;
}

/** Chronomètre à horloge injectée (latence perçue : prise → candidats). */
export interface Stopwatch {
  /** Millisecondes depuis le départ. */
  elapsed(): number;
}

export function startStopwatch(now: () => number): Stopwatch {
  const startedAt = now();
  return { elapsed: () => Math.max(0, Math.round(now() - startedAt)) };
}

/** Secondes affichables (une décimale) : 2 349 ms → 2,3 (le séparateur vient de la locale). */
export function secondsForDisplay(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round(ms / 100) / 10;
}

/**
 * Fourchette indicative lisible (« 40 € – 90 € », « 0,30 € – 0,80 € ») : les
 * centimes ne sont montrés que pour les petites valeurs (timbres, monnaies
 * courantes), où les arrondir à l'euro effacerait l'information.
 */
export function formatEstimateRange(estimate: QuickEstimate, locale: string): string {
  // Une borne basse en centimes (0,30 €) garde ses centimes même si la haute
  // dépasse 10 € : « 0 € – 12 € » effacerait l'information.
  const hasCents = (n: number) => n > 0 && n < 10 && !Number.isInteger(n);
  const digits = estimate.high < 10 || hasCents(estimate.low) ? 2 : 0;
  const format = new Intl.NumberFormat(locale.startsWith('en') ? 'en-GB' : 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${format.format(estimate.low)} – ${format.format(estimate.high)}`;
}

/** Classement affiché en fil d'Ariane (« France › Cérès › 1849–1850 »). */
export function classificationText(levels: readonly string[] | undefined): string {
  return (levels ?? []).filter((level) => level.trim() !== '').join(' › ');
}
