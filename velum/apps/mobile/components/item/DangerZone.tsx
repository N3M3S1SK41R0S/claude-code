/**
 * Zone sensible de la fiche : suppression de l'objet, confirmée EN LIGNE
 * (deux étapes, pas de boîte système : `Alert.alert` est inopérant sur le web).
 * Hors-ligne (panne de transport confirmée), la suppression part dans la file
 * de mutations. Un REFUS du serveur (objet engagé dans une vente ou un échange
 * en cours…) n'est jamais mis en file : il est expliqué et l'utilisateur
 * reste sur la fiche. Après suppression : retour à l'écran précédent (repli :
 * la collection).
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VText, velumSpacing } from '@velum/ui';
import type { VelumItem } from '@velum/core';

import { SheetSection } from '../sheets/SheetSection';
import { getVelumClient } from '../../lib/client';
import { businessRefusalReason } from '../../lib/errors';
import { classifyWriteFailure, itemQueryKey, markItemDeleted } from '../../lib/itemSheetFlows';
import { useGoBack } from '../../lib/navigation';
import { routes } from '../../lib/routes';
import { showToast } from '../../stores/toastStore';

export function DangerZone({ item }: { item: VelumItem }) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const goBack = useGoBack(routes.collection());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** Suppression confirmée par le serveur : la fiche en cache sera retirée en quittant l'écran. */
  const deletedOnServer = useRef(false);

  // Retirée au démontage (et non pendant la transition de retour, où la fiche
  // relue afficherait « introuvable ») : un lien vers l'objet supprimé (envie
  // d'origine, recherche…) ne rouvre plus sa fiche en cache.
  useEffect(
    () => () => {
      if (deletedOnServer.current) {
        queryClient.removeQueries({ queryKey: itemQueryKey(item.id), exact: true });
      }
    },
    [queryClient, item.id],
  );

  const remove = async () => {
    setDeleting(true);
    let queued = false;
    try {
      await client.items.remove(item.id);
    } catch (error) {
      const failure = await classifyWriteFailure(client.items, item.id, error);
      if (failure === 'refused') {
        // Le serveur a répondu et refusé : rien n'est supprimé ni mis en file.
        setDeleting(false);
        setConfirming(false);
        const reason = businessRefusalReason(error);
        showToast(reason !== null ? t('item.danger.refusedReason', { reason }) : t('item.danger.refused'), 'danger');
        return;
      }
      if (failure === 'offline') {
        queued = true;
        try {
          await client.queue.enqueue({
            id: `mut-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            table: 'items',
            type: 'delete',
            payload: { id: item.id },
            queuedAt: new Date().toISOString(),
          });
        } catch {
          // Ni en ligne ni en file : rien n'est supprimé, on le dit.
          setDeleting(false);
          showToast(t('errors.generic'), 'danger');
          return;
        }
      }
      // 'missing' : déjà supprimé côté serveur (autre appareil) — même issue qu'un succès.
    }
    if (!queued) {
      deletedOnServer.current = true;
      // Une action encore en vol (fiche complète, correction) ne recrée pas
      // l'objet ; l'envie qui en est issue perd son lien (ON DELETE SET NULL).
      markItemDeleted(queryClient, item.id);
    }
    showToast(queued ? t('item.danger.queued') : t('item.deleted'), queued ? 'info' : 'success');
    // Les listes relisent la collection ; la fiche quittée n'est pas relue
    // (elle afficherait « introuvable » pendant la transition de retour).
    void queryClient.invalidateQueries({
      queryKey: ['items'],
      predicate: (query) => query.queryKey[1] !== item.id,
    });
    goBack();
  };

  const name = item.title ?? t('common.unknown');

  return (
    <SheetSection title={t('item.danger.title')}>
      {confirming ? (
        <View style={styles.body} accessibilityLiveRegion="polite">
          <VText variant="body" tone="danger">
            {t('item.danger.confirmQuestion', { name })}
          </VText>
          <VText variant="caption" tone="dim">
            {t('item.deleteMessage')}
          </VText>
          <VButton
            label={t('item.danger.confirm')}
            variant="danger"
            onPress={() => void remove()}
            loading={deleting}
          />
          <VButton label={t('common.cancel')} variant="ghost" onPress={() => setConfirming(false)} disabled={deleting} />
        </View>
      ) : (
        <View style={styles.body}>
          <VText variant="caption" tone="dim">
            {t('item.danger.hint')}
          </VText>
          <VButton
            label={t('item.danger.delete')}
            variant="danger"
            onPress={() => setConfirming(true)}
            accessibilityHint={t('item.deleteMessage')}
          />
        </View>
      )}
    </SheetSection>
  );
}

const styles = StyleSheet.create({
  body: { gap: velumSpacing.sm },
});
