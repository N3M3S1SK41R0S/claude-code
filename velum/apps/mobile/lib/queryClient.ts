/**
 * QueryClient partagé : retry 2, staleTime 5 min. Le wrapper `toastError`
 * convertit les VelumError en toasts i18n — jamais d'écran bloquant.
 */
import { QueryClient } from '@tanstack/react-query';
import i18n from './i18n';
import { errorMessage } from './errors';
import { showToast } from '../stores/toastStore';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Affiche l'erreur en toast (message i18n selon le code VelumError). */
export function toastError(error: unknown): void {
  showToast(errorMessage(error, i18n.t.bind(i18n)), 'danger');
}
