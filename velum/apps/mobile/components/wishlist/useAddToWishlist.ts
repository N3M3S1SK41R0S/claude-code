/**
 * Ajout aux envies PARTAGÉ — bouton « Ajouter à mes envies », écran
 * Candidats, sommelier de cave (idée d'achat) :
 *  - doublon (envie en cours, même catégorie, même titre normalisé) détecté
 *    sur une liste relue fraîche, sous la même clé de cache que « Mes envies »
 *    (`addUnlessDuplicate`, lib/wishlist.ts) : rien n'est créé ;
 *  - cache ['wishlist'] mis à jour aussitôt (liste déjà chargée), puis relu :
 *    « Mes envies » et la recherche globale voient l'ajout sans attendre.
 * Les messages (toasts) et l'état local restent à l'appelant (`onSuccess`,
 * `onError`) : chaque écran garde son vocabulaire.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NewWishlistEntry, WishlistEntry } from '@velum/core';

import { getVelumClient } from '../../lib/client';
import {
  WISHLIST_QUERY_KEY,
  addUnlessDuplicate,
  upsertEntry,
  type WishlistAddOutcome,
} from '../../lib/wishlist';

export interface UseAddToWishlistOptions {
  /** Envie créée, ou doublon (`outcome.duplicate`) : rien n'a été créé. */
  onSuccess?: (outcome: WishlistAddOutcome, input: NewWishlistEntry) => void;
  onError?: (error: unknown, input: NewWishlistEntry) => void;
}

export function useAddToWishlist(options: UseAddToWishlistOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<WishlistAddOutcome, unknown, NewWishlistEntry>({
    mutationFn: (input) => {
      const client = getVelumClient();
      return addUnlessDuplicate(input, {
        list: () => queryClient.fetchQuery({ queryKey: WISHLIST_QUERY_KEY, queryFn: () => client.wishlist.list() }),
        add: (entry) => client.wishlist.add(entry),
      });
    },
    onSuccess: (outcome, input) => {
      queryClient.setQueryData<WishlistEntry[]>(WISHLIST_QUERY_KEY, (prev) =>
        prev === undefined ? prev : upsertEntry(prev, outcome.entry),
      );
      void queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
      options.onSuccess?.(outcome, input);
    },
    onError: (error, input) => options.onError?.(error, input),
  });
}
