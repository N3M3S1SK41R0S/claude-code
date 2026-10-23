/**
 * « Vendre ou échanger » un objet sur les plateformes (Platine) : ouvre
 * l'écran de mise en vente / à l'échange (routes.sell) — nature, prix,
 * décomposition de la commission, expertise, anonymat. Non-Platine : renvoie
 * vers les offres. Panne du profil : message + Réessayer (jamais de faux paywall).
 */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { VButton, VText } from '@velum/ui';

import { errorMessage } from '../../lib/errors';
import { usePlan } from '../../lib/plan';
import { routes } from '../../lib/routes';

export function SellButton({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const planState = usePlan();

  if (planState.status === 'loading') {
    return (
      <VButton
        label={t('community.sellOrExchange')}
        variant="secondary"
        disabled={true}
        loading={true}
        onPress={() => undefined}
      />
    );
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
        label={t('community.sellOrExchange')}
        variant="secondary"
        onPress={() => router.push(routes.paywall())}
        accessibilityHint={t('community.planRequired')}
      />
    );
  }

  return (
    <VButton
      label={t('community.sellOrExchange')}
      variant="secondary"
      onPress={() => router.push(routes.sell(itemId))}
      accessibilityHint={t('community.sellHint')}
    />
  );
}
