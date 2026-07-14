/**
 * Brouillon de capture (zustand, mémoire) : domaine, clichés par rôle,
 * texte libre, lignes de fichier, candidats reçus et candidat choisi.
 */
import { create } from 'zustand';
import type { Candidate, MediaRole, RecognitionResult, VelumDomain } from '@velum/core';

export interface DraftMedia {
  role: MediaRole;
  /** Data URL base64 éphémère (qualité 0.7) — jamais persistée. */
  base64: string;
  /** URI locale pour l'aperçu. */
  uri: string;
  /** Chemin privé déjà téléversé, réutilisé en cas de nouvelle tentative. */
  storagePath?: string;
}

export interface CaptureState {
  domain: VelumDomain | null;
  media: DraftMedia[];
  text: string;
  fileRows: Record<string, unknown>[];
  fileName: string | null;
  recognition: RecognitionResult | null;
  chosen: Candidate | null;
  setDomain(domain: VelumDomain): void;
  addMedia(media: DraftMedia): void;
  /** N'attache le chemin que si le cliché attendu est toujours le cliché courant. */
  setMediaStoragePath(role: MediaRole, expectedBase64: string, storagePath: string): void;
  removeMedia(role: MediaRole): void;
  setText(text: string): void;
  setFileRows(rows: Record<string, unknown>[], fileName: string): void;
  setRecognition(result: RecognitionResult): void;
  setChosen(candidate: Candidate | null): void;
  reset(): void;
}

const initial: Pick<
  CaptureState,
  'domain' | 'media' | 'text' | 'fileRows' | 'fileName' | 'recognition' | 'chosen'
> = {
  domain: null,
  media: [],
  text: '',
  fileRows: [],
  fileName: null,
  recognition: null,
  chosen: null,
};

export const useCaptureStore = create<CaptureState>()((set) => ({
  ...initial,
  setDomain: (domain) => set({ ...initial, domain }),
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
  setRecognition: (recognition) => set({ recognition }),
  setChosen: (chosen) => set({ chosen }),
  reset: () => set({ ...initial }),
}));
