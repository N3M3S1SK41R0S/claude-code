/**
 * Paywall : paliers Gratuit / Premium / Gold / Platine, achat RevenueCat (mode
 * dégradé en Expo Go/web), bouton « Restaurer les achats » obligatoire,
 * mentions. Fermeture : l'en-tête « ‹ Retour » (pas de bouton en bas de page) ;
 * après un achat, retour sûr même sans historique (lien direct).
 */
import { StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VBadge, VButton, VCard, VSpinner, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../components/Screen';
import { useGoBack } from '../lib/navigation';
import { getOfferings, purchase, restore, type PaywallTier } from '../lib/purchases';
import { showToast } from '../stores/toastStore';

/** Sans historique (lien direct, visiteur non connecté) : aiguillage d'entrée. */
const PAYWALL_BACK_FALLBACK = '/';

export default function Paywall() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const goBack = useGoBack(PAYWALL_BACK_FALLBACK);

  const offeringsQuery = useQuery({
    queryKey: ['offerings'],
    queryFn: getOfferings,
    staleTime: 60 * 1000,
  });

  const purchasesAvailable = offeringsQuery.data?.purchasesAvailable ?? false;
  const tiers = offeringsQuery.data?.tiers ?? [];

  const buy = async (tier: PaywallTier) => {
    if (!purchasesAvailable || tier.nativePackage === null) {
      showToast(t('paywall.unavailable'), 'info');
      return;
    }
    try {
      await purchase(tier.nativePackage);
      showToast(t('paywall.purchaseDone'), 'success');
      // Le plan (profiles.plan) est resynchronisé côté serveur : relecture.
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      goBack();
    } catch {
      showToast(t('paywall.purchaseError'), 'danger');
    }
  };

  const doRestore = async () => {
    try {
      const restored = await restore();
      showToast(restored ? t('paywall.restored') : t('paywall.restoreNone'), restored ? 'success' : 'info');
    } catch {
      showToast(t('paywall.unavailable'), 'info');
    }
  };

  return (
    <Screen backFallback={PAYWALL_BACK_FALLBACK}>
      <VText variant="display" accessibilityRole="header">
        {t('paywall.title')}
      </VText>
      <VText variant="body" tone="dim">
        {t('paywall.subtitle')}
      </VText>

      {offeringsQuery.isLoading ? (
        <View style={styles.center}>
          <VSpinner />
        </View>
      ) : offeringsQuery.isError ? (
        <VCard style={styles.card}>
          <View style={styles.cardContent}>
            <VText variant="body" tone="dim">
              {t('paywall.loadError')}
            </VText>
            <VButton
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void offeringsQuery.refetch()}
            />
          </View>
        </VCard>
      ) : (
        <>
          {!purchasesAvailable ? (
            <VText variant="caption" tone="dim" style={styles.notice}>
              {t('paywall.unavailable')}
            </VText>
          ) : null}

          {tiers.map((tier) => (
            <VCard key={tier.id} style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <VText variant="heading" tone="gold">
                    {t(`paywall.${tier.id}.name`)}
                  </VText>
                  <View style={styles.badges}>
                    {tier.id === 'gold' ? (
                      <VBadge label={t('paywall.gold.badge')} tone="success" />
                    ) : null}
                    <VBadge
                      label={tier.priceLabel ?? t(`paywall.${tier.id}.price`)}
                      tone={tier.id === 'free' ? 'neutral' : 'gold'}
                    />
                  </View>
                </View>
                <VText variant="body" tone="dim">
                  {t(`paywall.${tier.id}.features`)}
                </VText>
                {tier.id !== 'free' ? (
                  <VButton
                    label={t('paywall.subscribe')}
                    onPress={() => void buy(tier)}
                    disabled={!purchasesAvailable}
                  />
                ) : null}
              </View>
            </VCard>
          ))}

          <VButton label={t('paywall.restore')} variant="secondary" onPress={() => void doRestore()} />
          <VText variant="caption" tone="dim" style={styles.legal}>
            {t('paywall.legal')}
          </VText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: velumSpacing.xxl },
  notice: { marginTop: velumSpacing.md },
  card: { marginTop: velumSpacing.md },
  cardContent: { gap: velumSpacing.sm },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  legal: { marginTop: velumSpacing.md },
});
