/**
 * Paywall : paliers Gratuit / Premium / Pro, achat RevenueCat (mode dégradé
 * en Expo Go/web), bouton « Restaurer les achats » obligatoire, mentions.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VBadge, VButton, VCard, VSpinner, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../components/Screen';
import { getOfferings, purchase, restore, type PaywallTier } from '../lib/purchases';
import { showToast } from '../stores/toastStore';

export default function Paywall() {
  const { t } = useTranslation();
  const router = useRouter();

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
      router.back();
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
    <Screen>
      <VText variant="display">{t('paywall.title')}</VText>
      <VText variant="body" tone="dim">
        {t('paywall.subtitle')}
      </VText>

      {offeringsQuery.isLoading ? (
        <View style={styles.center}>
          <VSpinner />
        </View>
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
          <VButton label={t('common.close')} variant="ghost" onPress={() => router.back()} />
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
