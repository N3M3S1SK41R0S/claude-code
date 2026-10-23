/**
 * Proposer un échange contre une annonce : choix d'un de MES objets (même
 * catégorie d'abord), valeur déclarée pré-remplie avec la dernière estimation
 * VELUM, soulte signée (« j'ajoute » / « je demande »), message (coordonnées
 * masquées automatiquement, aperçu avant envoi), aperçu de MA commission ;
 * expertise obligatoire au-delà du seuil. L'expertise d'un commun accord se
 * demande ensuite, sur l'échange accepté (seul moment où le serveur l'accepte).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VelumError, type CatalogueListing, type VelumItem } from '@velum/core';
import { VButton, VCard, VSpinner, VText, VTextInput, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import {
  amountProblemMessage,
  amountToInput,
  exchangePreview,
  formatPrice,
  formatRate,
  latestEstimate,
  redactionPreview,
  referenceEstimate,
  type CashDirection,
} from '../../lib/marketForms';
import { commissionBasisNoticeKey } from '../../lib/marketCommission';
import { itemCertifiedByExpert, itemMarketBlock } from '../../lib/marketState';
import { showToast } from '../../stores/toastStore';
import { AmountRows, Notice, Segmented, type AmountRow } from './controls';
import {
  useCommissionBasis,
  useInvalidateCommunity,
  useMarketErrorToast,
  useMyCertifications,
  useMyExchanges,
  useMyListings,
} from './hooks';
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
  // Taux ACTUEL du serveur (figé à l'acceptation), taux maximal en repli.
  const commission = useCommissionBasis();

  const [item, setItem] = useState<VelumItem | null>(null);
  const [value, setValue] = useState('');
  const [valueTouched, setValueTouched] = useState(false);
  const [direction, setDirection] = useState<CashDirection>('add');
  const [cash, setCash] = useState('');
  const [message, setMessage] = useState('');

  const itemId = item?.id ?? '';
  // Historique des estimations : la plus RÉCENTE pré-remplit la valeur ; la
  // plus HAUTE des 18 derniers mois (dates futures ignorées) décide du seuil
  // d'expertise de mon objet, comme le serveur (_market_reference_value).
  const history = useQuery({
    queryKey: ['valuations', itemId, 'history'],
    queryFn: () => client.valuations.history(itemId),
    enabled: itemId.length > 0,
  });
  const nowIso = new Date().toISOString();
  const estimate = history.data ? latestEstimate(history.data, nowIso) : null;
  const reference = history.data ? referenceEstimate(history.data, nowIso) : null;

  // Pré-remplit la valeur déclarée avec l'estimation, sans écraser une saisie.
  useEffect(() => {
    if (!valueTouched && estimate !== null) setValue(amountToInput(estimate));
  }, [estimate, valueTouched]);

  // Mon objet déjà certifié : la certification le suit (pas de nouvelle expertise).
  const myListings = useMyListings();
  const myCertifications = useMyCertifications();
  const myExchanges = useMyExchanges();
  const offeredCertified =
    item !== null &&
    itemCertifiedByExpert(item.id, myListings.data ?? [], myCertifications.data ?? [], myExchanges.data ?? []);

  // Seuil évalué objet par objet, comme le serveur (_exchange_threshold_targets).
  const preview = exchangePreview({
    listingValue: listing.askPrice,
    listingCertified: listing.certified,
    offeredValueInput: value,
    offeredEstimate: reference,
    offeredCertified,
    cashDirection: direction,
    cashInput: cash,
    commission: commission.basis,
    // Accord mutuel : demandé plus tard, sur l'échange accepté (pas ici).
    mutualCertification: false,
  });
  const messagePreview = redactionPreview(message);
  const locale = i18n.language;
  // Taux non confirmé par le serveur : mention explicite (aperçu au taux maximal).
  const rateNoticeKey = commissionBasisNoticeKey(commission.status);

  const propose = useMutation({
    mutationFn: async () => {
      if (item === null || preview.offeredValue === null || preview.cashAdjustment === null) {
        throw new VelumError('INVALID_INPUT', 'Proposition incomplète ou montant invalide');
      }
      // L'expertise d'un commun accord ne se demande PAS ici : le serveur ne
      // l'accepte qu'une fois l'échange accepté (détail de l'échange).
      return client.marketplace.proposeExchange({
        listingId: listing.id,
        offeredItemId: item.id,
        offeredValue: preview.offeredValue,
        cashAdjustment: preview.cashAdjustment,
        ...(message.trim().length > 0 ? { message: message.trim() } : {}),
      });
    },
    onSuccess: (created) => {
      showToast(t('community.proposal.sent'), 'success');
      invalidate();
      onProposed(created.id);
    },
    onError,
  });

  // Motif précis (illisible, sous 1 €, au-delà du maximum serveur).
  const valueProblem =
    value.trim().length > 0 && preview.offeredValueProblem !== null
      ? amountProblemMessage(preview.offeredValueProblem, locale)
      : null;
  const valueError = valueProblem !== null ? t(valueProblem.key, valueProblem.params) : undefined;
  const cashError = preview.cashAdjustment === null ? t('community.invalidAmount') : undefined;
  // Estimations en cours de lecture : le seuil d'expertise de mon objet n'est pas encore connu.
  const canSubmit =
    item !== null && preview.offeredValue !== null && preview.cashAdjustment !== null && !history.isLoading;

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
          // Objet déjà cédé (vente ou échange conclu) : le serveur refuse de le proposer.
          blockReason={(candidate) =>
            itemMarketBlock(candidate.id, myListings.data ?? [])?.reason === 'ceded'
              ? t('community.picker.blockedCeded')
              : null
          }
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
          {history.isLoading ? (
            <VSpinner />
          ) : estimate !== null ? (
            <VText variant="caption" tone="dim">
              {t('community.estimateHint', { amount: formatPrice(estimate, locale) })}
            </VText>
          ) : (
            <VText variant="caption" tone="dim">
              {history.isError ? t('community.estimateUnavailable') : t('community.noEstimate')}
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
          {rateNoticeKey !== null ? (
            <VText variant="caption" tone="dim" accessibilityLiveRegion="polite">
              {t(rateNoticeKey, { rate: formatRate(commission.basis.rate, locale) })}
            </VText>
          ) : null}

          {preview.requirement.reason === 'threshold' ? (
            <Notice tone="warning" title={t('community.certification.requiredTitle')}>
              <>
                {preview.thresholdItems.mine ? (
                  <VText variant="caption" tone="dim">
                    {t('community.proposal.certificationRequiredMine', {
                      fee: formatPrice(preview.certificationFee, locale),
                    })}
                  </VText>
                ) : null}
                {preview.thresholdItems.theirs ? (
                  <VText variant="caption" tone="dim">
                    {t('community.proposal.certificationRequiredTheirs')}
                  </VText>
                ) : null}
              </>
            </Notice>
          ) : (
            <VText variant="caption" tone="dim">
              {t('community.proposal.certificationLater')}
            </VText>
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
