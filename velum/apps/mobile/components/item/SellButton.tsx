/**
 * « Mettre en vente » un objet sur la communauté (Platine). Ouvre un prix en
 * ligne, crée l'annonce (titre/domaine/commission remplis serveur) puis renvoie
 * vers la communauté. Non-Platine : renvoie vers les offres.
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VText, VTextInput } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { usePlan } from '../../lib/plan';
import { showToast } from '../../stores/toastStore';

export function SellButton({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const planState = usePlan();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');

  const create = useMutation({
    mutationFn: () => {
      const value = Number.parseFloat(price.replace(',', '.'));
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(t('community.invalidPrice'));
      }
      return client.marketplace.createListing({ itemId, askPrice: value });
    },
    onSuccess: () => {
      setOpen(false);
      setPrice('');
      showToast(t('community.listed'), 'success');
      router.push('/community');
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  if (planState.status === 'loading') {
    return <VButton label={t('community.sell')} variant="secondary" disabled={true} loading={true} />;
  }

  if (planState.status === 'error') {
    return (
      <>
        <VText variant="caption" tone="dim">
          {errorMessage(planState.error, t)}
        </VText>
        <VButton label={t('common.retry')} variant="secondary" onPress={planState.retry} />
      </>
    );
  }

  if (!planState.entitlements.community) {
    return (
      <VButton
        label={t('community.sell')}
        variant="secondary"
        onPress={() => router.push('/paywall')}
        accessibilityHint={t('community.planRequired')}
      />
    );
  }

  if (!open) {
    return <VButton label={t('community.sell')} variant="secondary" onPress={() => setOpen(true)} />;
  }

  return (
    <>
      <VText variant="caption" tone="dim">
        {t('community.sellHint')}
      </VText>
      <VTextInput
        label={t('community.askPrice')}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        placeholder="250"
      />
      <VButton label={t('community.publish')} onPress={() => create.mutate()} loading={create.isPending} />
      <VButton label={t('common.cancel')} variant="ghost" onPress={() => setOpen(false)} />
    </>
  );
}
