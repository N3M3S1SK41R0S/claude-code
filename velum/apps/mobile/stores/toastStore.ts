/**
 * Toasts non bloquants (zustand) — erreurs gracieuses, jamais d'écran bloquant.
 */
import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'danger';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastMessage[];
  show(message: string, tone?: ToastTone): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (message, tone = 'info') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) })),
}));

/** Raccourci hors composant (mutations React Query, callbacks). */
export function showToast(message: string, tone: ToastTone = 'info'): void {
  useToastStore.getState().show(message, tone);
}
