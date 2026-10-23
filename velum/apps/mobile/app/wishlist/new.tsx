/**
 * Nouvelle envie / idée. Catégorie pré-sélectionnée par le paramètre `domain`
 * (catégorie affichée dans « Mes envies »). Un doublon (envie en cours, même
 * catégorie, même titre normalisé) est signalé au lieu d'être recréé. Après
 * l'ajout : retour à la page précédente (la liste), avec repli sûr.
 */
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { WishlistEntry } from '@velum/core';
import { VButton, VCard, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../../components/Screen';
import { WishlistForm } from '../../components/wishlist/WishlistForm';
import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { getActiveDomains } from '../../lib/features';
import { useGoBack } from '../../lib/navigation';
import { routes } from '../../lib/routes';
import {
  WISHLIST_QUERY_KEY,
  emptyWishlistForm,
  findDuplicate,
  parseDomainParam,
  upsertEntry,
  wishlistRoutes,
  type WishlistInput,
} from '../../lib/wishlist';
import { showToast } from '../../stores/toastStore';

export default function NewWishlistEntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const client = getVelumClient();
  const params = useLocalSearchParams<{ domain?: string }>();
  const domains = useMemo(() => getActiveDomains(), []);
  const requested = parseDomainParam(params.domain, domains);
  // Formulaire initialisé une fois : la catégorie se change ensuite dans le formulaire.
  const [initial] = useState(() => emptyWishlistForm(requested ?? domains[0] ?? 'wine'));
  const goBack = useGoBack(routes.wishlist(requested));
  const [duplicate, setDuplicate] = useState<WishlistEntry | null>(null);

  // Liste en cache (ou chargée) pour détecter les doublons avant création.
  const listQuery = useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => client.wishlist.list(),
  });

  const addMutation = useMutation({
    mutationFn: (input: WishlistInput) => client.wishlist.add({ ...input, source: 'manual' }),
    onSuccess: (entry) => {
      queryClient.setQueryData<WishlistEntry[]>(WISHLIST_QUERY_KEY, (prev) =>
        prev === undefined ? prev : upsertEntry(prev, entry),
      );
      void queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
      showToast(t('wishlist.toast.added'), 'success');
      goBack();
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const submit = (input: WishlistInput) => {
    const existing = findDuplicate(listQuery.data ?? [], input);
    if (existing) {
      setDuplicate(existing);
      return;
    }
    addMutation.mutate(input);
  };

  return (
    <Screen title={t('wishlist.form.createTitle')} backFallback={routes.wishlist(requested)}>
      <VText variant="caption" tone="dim" style={styles.intro}>
        {t('wishlist.intro')}
      </VText>
      <WishlistForm
        initial={initial}
        domains={domains}
        submitLabel={t('wishlist.form.create')}
        submitting={addMutation.isPending}
        onSubmit={submit}
        onEdit={() => setDuplicate(null)}
        notice={
          duplicate ? (
            <VCard style={styles.notice}>
              <VText variant="body" tone="gold" accessibilityLiveRegion="polite">
                {t('wishlist.duplicate.title')}
              </VText>
              <VText variant="caption" tone="dim">
                {t('wishlist.duplicate.message', { title: duplicate.title })}
              </VText>
              <VButton
                label={t('wishlist.duplicate.view')}
                variant="secondary"
                onPress={() => router.push(wishlistRoutes.entry(duplicate.id))}
              />
            </VCard>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: velumSpacing.md },
  notice: { gap: velumSpacing.sm },
});
