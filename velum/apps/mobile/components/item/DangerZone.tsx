/**
 * Zone sensible de la fiche : suppression de l'objet, confirmée EN LIGNE
 * (deux étapes, pas de boîte système : `Alert.alert` est inopérant sur le web).
 * Hors-ligne, la suppression part dans la file de mutations. Après
 * suppression : retour à l'écran précédent (repli : la collection).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VText, velumSpacing } from '@velum/ui';
import type { VelumItem } from '@velum/core';

import { SheetSection } from '../sheets/SheetSection';
import { getVelumClient } from '../../lib/client';
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

  const remove = async () => {
    setDeleting(true);
    let queued = false;
    try {
      await client.items.remove(item.id);
    } catch {
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
