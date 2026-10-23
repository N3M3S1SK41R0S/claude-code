/**
 * Bouton réutilisable « Ajouter à mes envies » — fiche objet (« en
 * racheter »), écran Candidats (objet scanné non ajouté), journal de
 * dégustation. Les props reprennent `WishlistDraft` : on peut écrire
 * `<AddToWishlistButton {...entryFromItem(item)} />`.
 *
 *  - Doublon : une envie EN COURS de même catégorie et de même titre
 *    normalisé existe déjà → rien n'est créé, message « Déjà dans vos envies ».
 *  - Succès : toast, puis le bouton devient « Ajouté — voir mes envies » et
 *    ouvre la liste de la catégorie (accès direct à la liste).
 *  - Échec : toast d'erreur explicite, le bouton reste utilisable.
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { VelumDomain, WishlistEntry, WishlistSource } from '@velum/core';
import { VButton, type VelumButtonVariant } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { routes } from '../../lib/routes';
import { WISHLIST_QUERY_KEY, draftToNewEntry, findDuplicate, upsertEntry } from '../../lib/wishlist';
import { showToast } from '../../stores/toastStore';

export interface AddToWishlistButtonProps {
  domain: VelumDomain;
  title: string;
  /** Attributs d'IDENTITÉ seulement (cf. entryFromItem / entryFromCandidate). */
  attributes?: Record<string, unknown>;
  source: WishlistSource;
  /** Objet de MA collection à l'origine de l'envie (source 'item' / 'tasting'). */
  sourceItemId?: string | null;
  notes?: string | null;
  /** Apparence du bouton (défaut : secondaire). */
  variant?: VelumButtonVariant;
}

export function AddToWishlistButton({
  domain,
  title,
  attributes,
  source,
  sourceItemId,
  notes,
  variant = 'secondary',
}: AddToWishlistButtonProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const client = getVelumClient();
  const [justAdded, setJustAdded] = useState(false);

  // Liste partagée avec l'écran « Mes envies » (même clé de cache).
  const listQuery = useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => client.wishlist.list(),
    staleTime: 30_000,
  });
  const existing = listQuery.data ? findDuplicate(listQuery.data, { domain, title }) : null;

  const mutation = useMutation({
    mutationFn: async (): Promise<{ entry: WishlistEntry; duplicate: boolean }> => {
      // Liste fraîche : une envie identique a pu être ajoutée ailleurs. Si la
      // lecture échoue, on tente quand même l'ajout (le serveur tranchera).
      let current: WishlistEntry[] | null = null;
      try {
        current = await queryClient.fetchQuery({
          queryKey: WISHLIST_QUERY_KEY,
          queryFn: () => client.wishlist.list(),
        });
      } catch {
        current = null;
      }
      const duplicate = current ? findDuplicate(current, { domain, title }) : null;
      if (duplicate) return { entry: duplicate, duplicate: true };
      const entry = await client.wishlist.add(
        draftToNewEntry({
          domain,
          title,
          attributes: attributes ?? {},
          source,
          sourceItemId: sourceItemId ?? null,
          notes: notes ?? null,
        }),
      );
      return { entry, duplicate: false };
    },
    onSuccess: ({ entry, duplicate }) => {
      // Mise à jour immédiate d'une liste déjà en cache, puis relecture.
      queryClient.setQueryData<WishlistEntry[]>(WISHLIST_QUERY_KEY, (prev) =>
        prev === undefined ? prev : upsertEntry(prev, entry),
      );
      void queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
      setJustAdded(!duplicate);
      showToast(
        duplicate ? t('wishlist.toast.duplicate') : t('wishlist.toast.added'),
        duplicate ? 'info' : 'success',
      );
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const openList = () => router.push(routes.wishlist(domain));

  if (existing !== null || (justAdded && listQuery.data === undefined)) {
    return (
      <VButton
        label={justAdded ? t('wishlist.button.added') : t('wishlist.button.already')}
        variant="ghost"
        onPress={openList}
        accessibilityHint={t('wishlist.button.openHint')}
      />
    );
  }

  return (
    <VButton
      label={t('wishlist.button.add')}
      variant={variant}
      loading={mutation.isPending}
      disabled={mutation.isPending}
      onPress={() => {
        if (title.trim().length === 0) {
          showToast(t('wishlist.button.titleMissing'), 'danger');
          return;
        }
        mutation.mutate();
      }}
      accessibilityHint={t('wishlist.button.addHint', { domain: t(`domains.${domain}.name`) })}
    />
  );
}
