/**
 * Brouillon de capture (zustand, mémoire) : domaine, mode (scan éclair ou
 * saisie complète), clichés par rôle, texte libre, lignes de fichier,
 * candidats reçus, candidat choisi et durée de la reconnaissance.
 */
import { create } from 'zustand';
import type { Candidate, MediaRole, RecognitionResult, VelumDomain } from '@velum/core';

export interface DraftMedia {
  role: MediaRole;
  /** Data URL base64 éphémère (qualité adaptée au mode) — jamais persistée. */
  base64: string;
  /** URI locale pour l'aperçu. */
  uri: string;
  /** Chemin privé déjà téléversé, réutilisé en cas de nouvelle tentative. */
  storagePath?: string;
}

/**
 * Mode de capture : 'quick' (scan éclair, défaut) — une photo, identification
 * immédiate, enregistrement sans attendre la fiche complète ; 'full' (saisie
 * complète) — tous les clichés du domaine, fiche complète avant enregistrement.
 */
export type CaptureMode = 'quick' | 'full';

export interface CaptureState {
  domain: VelumDomain | null;
  mode: CaptureMode;
  media: DraftMedia[];
  text: string;
  fileRows: Record<string, unknown>[];
  fileName: string | null;
  recognition: RecognitionResult | null;
  /** Durée perçue de la reconnaissance (envoi → candidats), en ms. */
  recognizedInMs: number | null;
  chosen: Candidate | null;
  setDomain(domain: VelumDomain): void;
  setMode(mode: CaptureMode): void;
  addMedia(media: DraftMedia): void;
  /** N'attache le chemin que si le cliché attendu est toujours le cliché courant. */
  setMediaStoragePath(role: MediaRole, expectedBase64: string, storagePath: string): void;
  removeMedia(role: MediaRole): void;
  setText(text: string): void;
  setFileRows(rows: Record<string, unknown>[], fileName: string): void;
  setRecognition(result: RecognitionResult, elapsedMs?: number): void;
  setChosen(candidate: Candidate | null): void;
  reset(): void;
}

const initial: Pick<
  CaptureState,
  | 'domain'
  | 'mode'
  | 'media'
  | 'text'
  | 'fileRows'
  | 'fileName'
  | 'recognition'
  | 'recognizedInMs'
  | 'chosen'
> = {
  domain: null,
  mode: 'quick',
  media: [],
  text: '',
  fileRows: [],
  fileName: null,
  recognition: null,
  recognizedInMs: null,
  chosen: null,
};

export const useCaptureStore = create<CaptureState>()((set) => ({
  ...initial,
  // Changer de domaine démarre un brouillon neuf, dans le mode courant.
  setDomain: (domain) => set((s) => ({ ...initial, mode: s.mode, domain })),
  setMode: (mode) => set({ mode }),
  addMedia: (media) =>
    set((s) => ({ media: [...s.media.filter((m) => m.role !== media.role), media] })),
  setMediaStoragePath: (role, expectedBase64, storagePath) =>
    set((s) => ({
      media: s.media.map((entry) =>
        entry.role === role && entry.base64 === expectedBase64
          ? { ...entry, storagePath }
          : entry,
      ),
    })),
  removeMedia: (role) => set((s) => ({ media: s.media.filter((m) => m.role !== role) })),
  setText: (text) => set({ text }),
  setFileRows: (fileRows, fileName) => set({ fileRows, fileName }),
  setRecognition: (recognition, elapsedMs) =>
    set({ recognition, recognizedInMs: elapsedMs ?? null }),
  setChosen: (chosen) => set({ chosen }),
  reset: () => set((s) => ({ ...initial, mode: s.mode })),
}));
