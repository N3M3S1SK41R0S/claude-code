/**
 * « Mes commissions » (Mon activité) : le registre TRANSPARENT de la
 * plateforme rendu visible — taux dégressif actuel, ventes retenues et palier
 * suivant, totaux des commissions, frais d'expertise et versements (serveur :
 * `my_commission_summary`, via MarketplaceRepo.commissionSummary). Chargement,
 * panne (Réessayer), hors-ligne, « bientôt disponible » et registre vide sont
 * distingués ; un taux illisible est dit tel quel, jamais inventé.
 */
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VCard, VText, velumSpacing } from '@velum/ui';

import {
  COMMISSION_MAX_SALES_PER_BUYER,
  COMMISSION_MIN_QUALIFYING_SALE_EUR,
  commissionCardModel,
} from '../../lib/marketCommission';
import { formatPrice, formatRate } from '../../lib/marketForms';
import { AmountRows, AsyncBlock } from './controls';
import { useCommissionSummary } from './hooks';

export function CommissionCard() {
  const { t, i18n } = useTranslation();
  const summary = useCommissionSummary();
  const locale = i18n.language;

  return (
    <AsyncBlock source={summary}>
      {(data) => {
        const model = commissionCardModel(data);
        const money = (value: number) => formatPrice(value, locale, model.currency);
        return (
          <VCard style={styles.card}>
            <AmountRows
              rows={[
                {
                  label: t('community.commissions.currentRate'),
                  value:
                    model.currentRate !== null
                      ? formatRate(model.currentRate, locale)
                      : t('community.commissions.rateUnreadable'),
                  detail: t('community.commissions.currentRateDetail'),
                  emphasis: true,
                },
              ]}
            />
            <VText variant="caption" tone="dim">
              {t('community.commissions.salesRule', {
                count: model.completedSales,
                min: formatPrice(COMMISSION_MIN_QUALIFYING_SALE_EUR, locale),
                perBuyer: COMMISSION_MAX_SALES_PER_BUYER,
              })}
            </VText>
            {model.currentRate === null ? null : model.nextTier !== null ? (
              <VText variant="caption" tone="dim">
                {t('community.commissions.nextTier', {
                  count: model.nextTier.salesNeeded,
                  rate: formatRate(model.nextTier.rate, locale),
                })}
              </VText>
            ) : (
              <VText variant="caption" tone="dim">
                {t('community.sellForm.bestTier')}
              </VText>
            )}
            <AmountRows
              rows={[
                { label: t('community.commissions.commissions'), value: money(model.commissions) },
                { label: t('community.commissions.certificationFees'), value: money(model.certificationFees) },
                { label: t('community.commissions.payouts'), value: money(model.payouts) },
              ]}
            />
            {model.empty ? (
              <VText variant="caption" tone="dim">
                {t('community.commissions.empty')}
              </VText>
            ) : null}
          </VCard>
        );
      }}
    </AsyncBlock>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.sm },
});
