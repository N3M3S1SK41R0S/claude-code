/**
 * Une envie : actions principales EN HAUT (« Je l'ai obtenue » → « Ajouter à
 * ma collection », communauté, modifier, supprimer avec confirmation), puis
 * le détail (prix cible, notes, identification, origine). La modification se
 * fait sur place avec le même formulaire que la création.
 *
 * « Ajouter à ma collection » crée l'objet depuis les attributs de l'envie
 * avec `analysisStatus: 'pending'` (scan éclair) : la fiche complète, lente,
 * se chargera à la demande sur la fiche objet.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VelumError, type WishlistEntry, type WishlistPatch } from '@velum/core';
import { VBadge, VButton, VCard, VEmptyState, VSpinner, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../../components/Screen';
import { CommunityAvailability } from '../../components/wishlist/CommunityAvailability';
import { WishlistForm } from '../../components/wishlist/WishlistForm';
import { useSession } from '../../lib/auth';
import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { getActiveDomains } from '../../lib/features';
import { formatDate } from '../../lib/i18n';
import { queryScreenState } from '../../lib/itemSheetFlows';
import { useGoBack } from '../../lib/navigation';
import { routes } from '../../lib/routes';
import {
  PRIORITY_BADGE_KEY,
  PRIORITY_TONE,
  WISHLIST_QUERY_KEY,
  communitySearchText,
  duplicateForEdit,
  duplicateForReopen,
  formFromEntry,
  formatTargetPrice,
  identityDetails,
  newItemFromEntry,
  removeEntry,
  upsertEntry,
  wishlistRoutes,
  type WishlistInput,
} from '../../lib/wishlist';
import { showToast } from '../../stores/toastStore';

type UpdateKind = 'acquire' | 'reopen' | 'edit';

export default function WishlistEntryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const client = getVelumClient();
  const { session } = useSession();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [duplicate, setDuplicate] = useState<WishlistEntry | null>(null);
  /** « Remettre dans mes envies » refusé : une envie en cours identique existe. */
  const [reopenBlocked, setReopenBlocked] = useState(false);

  const listQuery = useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => client.wishlist.list(),
  });
  const entry = listQuery.data?.find((e) => e.id === id) ?? null;
  const goBack = useGoBack(routes.wishlist(entry?.domain));

  const replaceInCache = (next: WishlistEntry) => {
    queryClient.setQueryData<WishlistEntry[]>(WISHLIST_QUERY_KEY, (prev) =>
      prev === undefined ? prev : upsertEntry(prev, next),
    );
    void queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
  };

  const updateMutation = useMutation({
    mutationFn: ({ patch }: { patch: WishlistPatch; kind: UpdateKind }) => client.wishlist.update(id, patch),
    onSuccess: (updated, { kind }) => {
      replaceInCache(updated);
      if (kind === 'edit') {
        setEditing(false);
        showToast(t('wishlist.toast.updated'), 'success');
      } else {
        showToast(kind === 'acquire' ? t('wishlist.toast.acquired') : t('wishlist.toast.reopened'), 'success');
      }
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => client.wishlist.remove(id),
    onSuccess: () => {
      queryClient.setQueryData<WishlistEntry[]>(WISHLIST_QUERY_KEY, (prev) =>
        prev === undefined ? prev : removeEntry(prev, id),
      );
      void queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
      showToast(t('wishlist.toast.deleted'), 'success');
      goBack();
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const collectionMutation = useMutation({
    mutationFn: async (source: WishlistEntry) => {
      const ownerId = session?.user?.id;
      if (!ownerId) throw new VelumError('UNAUTHORIZED', 'Session requise');
      return client.items.insert(newItemFromEntry(source, ownerId));
    },
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      showToast(t('wishlist.toast.addedToCollection'), 'success');
      router.push(routes.item(item.id));
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const view = queryScreenState(listQuery);
  // Chargement, ou envie tout juste supprimée (retour en cours : pas de « introuvable »).
  if (view === 'loading' || deleteMutation.isSuccess) {
    return (
      <Screen scroll={false} title={t('wishlist.title')} backFallback={routes.wishlist()}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  // En pause hors-ligne, jamais chargée sur cet appareil : pas « introuvable ».
  if (view === 'offline') {
    return (
      <Screen scroll={false} title={t('wishlist.title')} backFallback={routes.wishlist()}>
        <View style={styles.center}>
          <VEmptyState title={t('wishlist.offline.title')} message={t('wishlist.offline.message')} />
        </View>
      </Screen>
    );
  }

  if (listQuery.isError && listQuery.data === undefined) {
    return (
      <Screen scroll={false} title={t('wishlist.title')} backFallback={routes.wishlist()}>
        <View style={styles.center}>
          <VEmptyState
            title={t('wishlist.loadError')}
            message={errorMessage(listQuery.error, t)}
            action={{ label: t('common.retry'), onPress: () => void listQuery.refetch() }}
          />
        </View>
      </Screen>
    );
  }

  if (entry === null) {
    return (
      <Screen scroll={false} title={t('wishlist.title')} backFallback={routes.wishlist()}>
        <View style={styles.center}>
          <VEmptyState
            title={t('wishlist.detail.notFoundTitle')}
            message={t('wishlist.detail.notFoundMessage')}
            action={{ label: t('wishlist.detail.backToList'), onPress: () => router.replace(routes.wishlist()) }}
          />
        </View>
      </Screen>
    );
  }

  const busy = updateMutation.isPending || deleteMutation.isPending || collectionMutation.isPending;
  // Objet créé depuis CETTE envie pendant la visite (null sinon).
  const createdItemId =
    collectionMutation.data !== undefined && collectionMutation.variables?.id === entry.id
      ? collectionMutation.data.id
      : null;

  if (editing) {
    const save = (input: WishlistInput) => {
      // Une envie OBTENUE peut coexister avec une envie en cours de même titre.
      const existing = duplicateForEdit(listQuery.data ?? [], entry, input);
      if (existing) {
        setDuplicate(existing);
        return;
      }
      updateMutation.mutate({ patch: input, kind: 'edit' });
    };
    return (
      <Screen title={t('wishlist.form.editTitle')} onBack={() => setEditing(false)}>
        <WishlistForm
          initial={formFromEntry(entry, i18n.language.startsWith('en') ? '.' : ',')}
          base={entry}
          domains={getActiveDomains()}
          submitLabel={t('wishlist.form.save')}
          submitting={updateMutation.isPending}
          onSubmit={save}
          onCancel={() => setEditing(false)}
          onEdit={() => setDuplicate(null)}
          notice={
            duplicate ? (
              <VCard style={styles.card}>
                <VText variant="body" tone="gold" accessibilityLiveRegion="polite">
                  {t('wishlist.duplicate.title')}
                </VText>
                <VText variant="caption" tone="dim">
                  {t('wishlist.duplicate.message', { title: duplicate.title })}
                </VText>
                <VButton
                  label={t('wishlist.duplicate.view')}
                  variant="secondary"
                  onPress={() => {
                    setEditing(false);
                    router.push(wishlistRoutes.entry(duplicate.id));
                  }}
                />
              </VCard>
            ) : null
          }
        />
      </Screen>
    );
  }

  const details = identityDetails(entry);

  /** Envie en cours identique (relue à chaque rendu : la liste a pu changer). */
  const reopenDuplicate = reopenBlocked ? duplicateForReopen(listQuery.data ?? [], entry) : null;

  /** « Remettre dans mes envies » : jamais une seconde envie en cours identique. */
  const reopen = () => {
    if (duplicateForReopen(listQuery.data ?? [], entry) !== null) {
      setReopenBlocked(true);
      return;
    }
    setReopenBlocked(false);
    updateMutation.mutate({ patch: { acquired: false }, kind: 'reopen' });
  };

  return (
    <Screen title={t('wishlist.title')} backFallback={routes.wishlist(entry.domain)}>
      <View style={styles.top}>
        <VText variant="title">{entry.title}</VText>
        <View style={styles.badges}>
          <VBadge label={t(`domains.${entry.domain}.name`)} tone="neutral" />
          <VBadge label={t(`wishlist.kind.${entry.kind}`)} tone="neutral" />
          {!entry.acquired ? (
            <VBadge
              label={t(PRIORITY_BADGE_KEY[entry.priority])}
              tone={PRIORITY_TONE[entry.priority]}
            />
          ) : null}
        </View>

        {entry.acquired ? (
          <VCard style={styles.card}>
            <VText variant="heading" tone="gold">
              {t('wishlist.detail.acquiredTitle')}
            </VText>
            <VText variant="body" tone="dim">
              {t('wishlist.detail.acquiredMessage', {
                date: entry.acquiredAt ? formatDate(entry.acquiredAt) : '—',
              })}
            </VText>
            {createdItemId !== null ? (
              // Déjà ajoutée pendant cette visite : pas de second objet par mégarde.
              <VButton
                label={t('wishlist.actions.viewInCollection')}
                onPress={() => router.push(routes.item(createdItemId))}
              />
            ) : (
              <VButton
                label={t('wishlist.actions.addToCollection')}
                onPress={() => collectionMutation.mutate(entry)}
                loading={collectionMutation.isPending}
                disabled={busy}
                accessibilityHint={t('wishlist.actions.addToCollectionHint')}
              />
            )}
            <VButton
              label={t('wishlist.actions.reopen')}
              variant="ghost"
              onPress={reopen}
              disabled={busy}
            />
            {reopenDuplicate !== null ? (
              <View style={styles.card} accessibilityLiveRegion="polite">
                <VText variant="body" tone="gold">
                  {t('wishlist.duplicate.title')}
                </VText>
                <VText variant="caption" tone="dim">
                  {t('wishlist.duplicate.message', { title: reopenDuplicate.title })}
                </VText>
                <VButton
                  label={t('wishlist.duplicate.view')}
                  variant="secondary"
                  onPress={() => router.push(wishlistRoutes.entry(reopenDuplicate.id))}
                />
              </View>
            ) : null}
          </VCard>
        ) : (
          <VButton
            label={t('wishlist.actions.markAcquired')}
            onPress={() => updateMutation.mutate({ patch: { acquired: true }, kind: 'acquire' })}
            loading={updateMutation.isPending}
            disabled={busy}
            accessibilityHint={t('wishlist.actions.markAcquiredHint')}
          />
        )}

        <VButton
          label={t('wishlist.actions.searchCommunity')}
          variant="secondary"
          onPress={() => router.push(routes.community(entry.domain, undefined, communitySearchText(entry)))}
          accessibilityHint={t('wishlist.actions.searchCommunityHint')}
        />
        <CommunityAvailability key={`${entry.id}:${entry.domain}:${entry.title}`} entry={entry} />

        <View style={styles.row}>
          <View style={styles.flex}>
            <VButton
              label={t('wishlist.actions.edit')}
              variant="ghost"
              onPress={() => {
                setConfirmingDelete(false);
                setDuplicate(null);
                setEditing(true);
              }}
              disabled={busy}
            />
          </View>
          <View style={styles.flex}>
            <VButton
              label={t('wishlist.actions.delete')}
              variant="danger"
              onPress={() => setConfirmingDelete(true)}
              disabled={busy}
            />
          </View>
        </View>

        {confirmingDelete ? (
          <VCard style={styles.card}>
            <VText variant="heading" accessibilityLiveRegion="polite">
              {t('wishlist.deleteConfirm.title')}
            </VText>
            <VText variant="body" tone="dim">
              {t('wishlist.deleteConfirm.message', { title: entry.title })}
            </VText>
            <VButton
              label={t('wishlist.deleteConfirm.confirm')}
              variant="danger"
              onPress={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
              disabled={busy}
            />
            <VButton
              label={t('wishlist.deleteConfirm.cancel')}
              variant="ghost"
              onPress={() => setConfirmingDelete(false)}
              disabled={deleteMutation.isPending}
            />
          </VCard>
        ) : null}
      </View>

      <VCard style={[styles.card, styles.details]}>
        <View>
          <VText variant="caption" tone="dim">
            {t('wishlist.detail.targetPrice')}
          </VText>
          <VText variant="body" tabularNums>
            {entry.targetPrice !== null
              ? formatTargetPrice(entry.targetPrice, i18n.language)
              : t('wishlist.detail.noTargetPrice')}
          </VText>
        </View>

        {entry.notes ? (
          <View>
            <VText variant="caption" tone="dim">
              {t('wishlist.detail.notes')}
            </VText>
            <VText variant="body">{entry.notes}</VText>
          </View>
        ) : null}

        {details.length > 0 ? (
          <View>
            <VText variant="caption" tone="dim">
              {t('wishlist.detail.identity')}
            </VText>
            {details.map((detail) => (
              <VText key={detail.key} variant="body">
                {t('wishlist.detail.field', { label: t(detail.labelKey), value: detail.value })}
              </VText>
            ))}
          </View>
        ) : null}

        <VText variant="caption" tone="dim">
          {t('wishlist.source.label', { source: t(`wishlist.source.${entry.source}`) })}
        </VText>
        <VText variant="caption" tone="dim">
          {t('wishlist.detail.createdAt', { date: formatDate(entry.createdAt) })}
        </VText>
        {entry.sourceItemId !== null ? (
          <VButton
            label={t('wishlist.actions.viewSourceItem')}
            variant="ghost"
            onPress={() => router.push(routes.item(entry.sourceItemId ?? ''))}
          />
        ) : null}
      </VCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  top: { gap: velumSpacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.xs },
  card: { gap: velumSpacing.sm },
  details: { marginTop: velumSpacing.lg },
  row: { flexDirection: 'row', gap: velumSpacing.sm },
  flex: { flex: 1 },
});
