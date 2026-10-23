/**
 * Proposer un échange contre une annonce : choix d'un de MES objets (même
 * catégorie d'abord), valeur déclarée pré-remplie avec la dernière estimation
 * VELUM, soulte signée (« j'ajoute » / « je demande »), message (coordonnées
 * masquées automatiquement, aperçu avant envoi), aperçu de MA commission ;
 * expertise obligatoire au-delà du seuil ou demandée d'un commun accord.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VelumError, type CatalogueListing, type VelumItem } from '@velum/core';
import { VButton, VCard, VSpinner, VText, VTextInput, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import {
  amountToInput,
  estimateFromValuation,
  exchangePreview,
  formatPrice,
  formatRate,
  redactionPreview,
  type CashDirection,
} from '../../lib/marketForms';
import { showToast } from '../../stores/toastStore';
import { AmountRows, CheckRow, Notice, Segmented, type AmountRow } from './controls';
import { useCompletedSales, useInvalidateCommunity, useMarketErrorToast } from './hooks';
import { ItemPicker } from './ItemPicker';

export interface ExchangeProposalFormProps {
  listing: CatalogueListing;
  /** Appelé avec l'id de l'échange créé. */
  onProposed: (exchangeId: string) => void;
  onCancel: () => void;
}

export function ExchangeProposalForm({ listing, onProposed, onCancel }: ExchangeProposalFormProps) {
  const { t, i18n } = useTranslation();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  const sales = useCompletedSales();

  const [item, setItem] = useState<VelumItem | null>(null);
  const [value, setValue] = useState('');
  const [valueTouched, setValueTouched] = useState(false);
  const [direction, setDirection] = useState<CashDirection>('add');
  const [cash, setCash] = useState('');
  const [message, setMessage] = useState('');
  const [mutual, setMutual] = useState(false);

  const itemId = item?.id ?? '';
  const latest = useQuery({
    queryKey: ['valuations', itemId, 'latest'],
    queryFn: () => client.valuations.latest(itemId),
    enabled: itemId.length > 0,
  });
  const estimate = estimateFromValuation(latest.data);

  // Pré-remplit la valeur déclarée avec l'estimation, sans écraser une saisie.
  useEffect(() => {
    if (!valueTouched && estimate !== null) setValue(amountToInput(estimate));
  }, [estimate, valueTouched]);

  const preview = exchangePreview({
    listingValue: listing.askPrice,
    offeredValueInput: value,
    cashDirection: direction,
    cashInput: cash,
    completedSales: sales.completedSales,
    mutualCertification: mutual,
  });
  const messagePreview = redactionPreview(message);
  const locale = i18n.language;

  const propose = useMutation({
    mutationFn: async () => {
      if (item === null || preview.offeredValue === null || preview.cashAdjustment === null) {
        throw new VelumError('INVALID_INPUT', 'Proposition incomplète ou montant invalide');
      }
      const created = await client.marketplace.proposeExchange({
        listingId: listing.id,
        offeredItemId: item.id,
        offeredValue: preview.offeredValue,
        cashAdjustment: preview.cashAdjustment,
        ...(message.trim().length > 0 ? { message: message.trim() } : {}),
      });
      // Expertise d'un commun accord (sous le seuil) : demandée à l'autre partie.
      let certificationFailed = false;
      if (mutual && preview.requirement.reason === 'mutual_agreement') {
        try {
          await client.marketplace.requestCertification({
            reason: 'mutual_agreement',
            exchangeId: created.id,
            feePayer: 'split',
          });
        } catch {
          certificationFailed = true;
        }
      }
      return { created, certificationFailed };
    },
    onSuccess: ({ created, certificationFailed }) => {
      showToast(t('community.proposal.sent'), 'success');
      if (certificationFailed) showToast(t('community.proposal.certificationFailed'), 'danger');
      invalidate();
      onProposed(created.id);
    },
    onError,
  });

  const valueError = value.trim().length > 0 && preview.offeredValue === null ? t('community.invalidAmount') : undefined;
  const cashError = preview.cashAdjustment === null ? t('community.invalidAmount') : undefined;
  const canSubmit = item !== null && preview.offeredValue !== null && preview.cashAdjustment !== null;

  const rows: AmountRow[] = [];
  if (preview.myCommission !== null) {
    rows.push({
      label: t('community.proposal.myCommission'),
      value: formatPrice(preview.myCommission.commission, locale),
      detail: t('community.proposal.myCommissionDetail', {
        rate: formatRate(preview.myCommission.commissionRate, locale),
      }),
    });
  }
  if (preview.myCertificationShare > 0) {
    rows.push({
      label: t('community.proposal.certificationShare'),
      value: formatPrice(preview.myCertificationShare, locale),
      detail: t('community.feeIndicative'),
    });
  }
  if (preview.balance !== null) {
    rows.push({
      label: t('community.proposal.balance'),
      value: formatPrice(preview.balance, locale),
      emphasis: true,
      detail:
        preview.balance === 0
          ? t('community.proposal.balanceEven')
          : preview.balance > 0
            ? t('community.proposal.balanceAbove')
            : t('community.proposal.balanceBelow'),
    });
  }

  return (
    <VCard tone="gilded" style={styles.card}>
      <VText variant="heading" tone="gold" accessibilityRole="header">
        {t('community.proposal.title')}
      </VText>

      <VText variant="body">{t('community.proposal.pickItem')}</VText>
      {item === null ? (
        <ItemPicker
          selectedId={null}
          onSelect={(next) => {
            setItem(next);
            setValueTouched(false);
            setValue('');
          }}
          preferredDomain={listing.domain}
          label={t('community.proposal.pickItem')}
        />
      ) : (
        // Objet choisi : liste repliée (moins de défilement), changement en un geste.
        <View style={styles.selected}>
          <View style={styles.flex}>
            <VText variant="body" tone="gold" numberOfLines={2}>
              {item.title ?? t('common.unknown')}
            </VText>
            <VText variant="caption" tone="dim">
              {t(`domains.${item.domain}.name`)}
            </VText>
          </View>
          <VButton label={t('community.sellForm.changeItem')} variant="ghost" onPress={() => setItem(null)} />
        </View>
      )}

      {item !== null ? (
        <>
          <VTextInput
            label={t('community.proposal.declaredValue')}
            value={value}
            onChangeText={(v) => {
              setValueTouched(true);
              setValue(v);
            }}
            keyboardType="decimal-pad"
            placeholder="250"
            error={valueError}
          />
          {latest.isLoading ? (
            <VSpinner />
          ) : estimate !== null ? (
            <VText variant="caption" tone="dim">
              {t('community.estimateHint', { amount: formatPrice(estimate, locale) })}
            </VText>
          ) : (
            <VText variant="caption" tone="dim">
              {latest.isError ? t('community.estimateUnavailable') : t('community.noEstimate')}
            </VText>
          )}

          <VText variant="body">{t('community.proposal.cash')}</VText>
          <Segmented<CashDirection>
            value={direction}
            onChange={setDirection}
            accessibilityLabel={t('community.proposal.cash')}
            options={[
              { value: 'add', label: t('community.proposal.cashAdd') },
              { value: 'ask', label: t('community.proposal.cashAsk') },
            ]}
          />
          <VTextInput
            label={t('community.proposal.cashAmount')}
            value={cash}
            onChangeText={setCash}
            keyboardType="decimal-pad"
            placeholder="0"
            error={cashError}
          />

          <VTextInput
            label={t('community.proposal.message')}
            value={message}
            onChangeText={setMessage}
            placeholder={t('community.proposal.messagePlaceholder')}
            autoCapitalize="sentences"
          />
          {messagePreview !== null ? (
            <Notice tone="warning" title={t('community.redactionPreviewTitle')}>
              {messagePreview}
            </Notice>
          ) : (
            <VText variant="caption" tone="dim">
              {t('community.thread.anonymityHint')}
            </VText>
          )}

          {rows.length > 0 ? <AmountRows rows={rows} /> : null}
          {!sales.known ? (
            <VText variant="caption" tone="dim">
              {t('community.rateUnknown')}
            </VText>
          ) : null}

          {preview.requirement.reason === 'threshold' ? (
            <Notice tone="warning" title={t('community.certification.requiredTitle')}>
              {t('community.proposal.certificationRequired', {
                fee: formatPrice(preview.certificationFee, locale),
              })}
            </Notice>
          ) : (
            <CheckRow
              label={t('community.proposal.askCertification')}
              hint={t('community.proposal.askCertificationHint')}
              checked={mutual}
              onChange={setMutual}
            />
          )}
        </>
      ) : null}

      <View style={styles.actions}>
        <VButton
          label={t('community.proposal.submit')}
          onPress={() => propose.mutate()}
          disabled={!canSubmit}
          loading={propose.isPending}
        />
        <VButton label={t('common.cancel')} variant="ghost" onPress={onCancel} />
      </View>
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.md },
  actions: { gap: velumSpacing.sm },
  selected: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  flex: { flex: 1 },
});
