/**
 * Mise en vente / à l'échange d'un objet de MA collection (routes.sell).
 * Sans `itemId` : choix de l'objet d'abord. Formulaire : nature (Vente /
 * Échange / Les deux), prix demandé ou valeur déclarée (pré-rempli avec
 * l'estimation VELUM), description, souhaits d'échange. Décomposition EN
 * DIRECT (règles @velum/config) : commission dégressive et palier suivant,
 * frais d'expertise indicatifs, net vendeur ; expertise obligatoire au-delà
 * de 500 € ; certification volontaire ; anonymat avec aperçu du masquage.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EXPERT_APPRAISAL_THRESHOLD_EUR } from '@velum/config';
import { VelumError, type ListingKind, type VelumItem } from '@velum/core';
import { VButton, VCard, VEmptyState, VSpinner, VText, VTextInput, velumSpacing } from '@velum/ui';

import { Screen } from '../../components/Screen';
import { CommunityGate } from '../../components/market/CommunityGate';
import { ItemPicker } from '../../components/market/ItemPicker';
import { AmountRows, AsyncBlock, CheckRow, Notice, Segmented, type AmountRow } from '../../components/market/controls';
import {
  useCommissionBasis,
  useInvalidateCommunity,
  useMarketErrorToast,
  useMyCertifications,
  useMyExchanges,
  useMyListings,
} from '../../components/market/hooks';
import { getVelumClient } from '../../lib/client';
import {
  amountProblemMessage,
  amountToInput,
  formatPrice,
  formatRate,
  latestEstimate,
  redactionPreview,
  referenceEstimate,
  sellPreview,
} from '../../lib/marketForms';
import { commissionBasisNoticeKey, isBestTier } from '../../lib/marketCommission';
import { communityActivityHref, isVelumDomain, stringParam } from '../../lib/marketQuery';
import { isForSale, isOpenToExchange, itemCertifiedByExpert } from '../../lib/marketState';
import { routes } from '../../lib/routes';
import { showToast } from '../../stores/toastStore';

function SellForm({ item, onChangeItem }: { item: VelumItem; onChangeItem: () => void }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  // Taux ACTUEL du serveur (figé à la publication), taux maximal en repli.
  const commission = useCommissionBasis();
  const locale = i18n.language;

  // Historique des estimations : la plus RÉCENTE pré-remplit le prix ; la plus
  // HAUTE des 18 derniers mois (dates futures ignorées) décide du seuil
  // d'expertise, comme le serveur (_market_reference_value).
  const history = useQuery({
    queryKey: ['valuations', item.id, 'history'],
    queryFn: () => client.valuations.history(item.id),
  });
  const nowIso = new Date().toISOString();
  const estimate = history.data ? latestEstimate(history.data, nowIso) : null;
  const reference = history.data ? referenceEstimate(history.data, nowIso) : null;

  const [kind, setKind] = useState<ListingKind>('sale');
  const [price, setPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [wishes, setWishes] = useState('');
  const [voluntary, setVoluntary] = useState(false);

  useEffect(() => {
    if (!priceTouched && estimate !== null) setPrice(amountToInput(estimate));
  }, [estimate, priceTouched]);

  // Objet déjà certifié : la certification le suit, l'annonce naît authentifiée.
  const myListings = useMyListings();
  const myCertifications = useMyCertifications();
  const myExchanges = useMyExchanges();
  const alreadyCertified = itemCertifiedByExpert(
    item.id,
    myListings.data ?? [],
    myCertifications.data ?? [],
    myExchanges.data ?? [],
  );

  const preview = sellPreview({
    kind,
    priceInput: price,
    commission: commission.basis,
    estimatedValue: reference,
    voluntaryCertification: voluntary,
    alreadyCertified,
  });
  const descriptionPreview = redactionPreview(description);
  const wishesPreview = isOpenToExchange(kind) ? redactionPreview(wishes) : null;

  const publish = useMutation({
    mutationFn: async () => {
      if (preview.value === null) throw new VelumError('INVALID_INPUT', 'Prix invalide');
      const listing = await client.marketplace.createListing({
        itemId: item.id,
        askPrice: preview.value,
        kind,
        ...(description.trim().length > 0 ? { description: description.trim() } : {}),
        ...(isOpenToExchange(kind) && wishes.trim().length > 0 ? { exchangeWishes: wishes.trim() } : {}),
      });
      // Certification volontaire (badge « Authentifié VELUM ») : sous le seuil seulement.
      let certificationFailed = false;
      if (preview.certification === 'voluntary' && listing.status !== 'pending_certification') {
        try {
          await client.marketplace.requestCertification({ reason: 'voluntary', listingId: listing.id, feePayer: 'seller' });
        } catch {
          certificationFailed = true;
        }
      }
      return { listing, certificationFailed };
    },
    onSuccess: ({ listing, certificationFailed }) => {
      invalidate();
      if (certificationFailed) showToast(t('community.sellForm.voluntaryFailed'), 'danger');
      if (listing.status === 'pending_certification') {
        showToast(t('community.sellForm.pendingCertification'), 'info');
        router.replace(communityActivityHref());
      } else {
        showToast(t('community.listed'), 'success');
        router.replace(routes.listing(listing.id));
      }
    },
    onError,
  });

  const locked = publish.isPending;
  // Taux non confirmé par le serveur : mention explicite (aperçu au taux maximal).
  const rateNoticeKey = commissionBasisNoticeKey(commission.status);
  // Motif précis (illisible, sous 1 €, au-delà du maximum serveur) : jamais un simple « invalide ».
  const priceProblem =
    price.trim().length > 0 && preview.valueProblem !== null
      ? amountProblemMessage(preview.valueProblem, locale)
      : null;
  const priceError = priceProblem !== null ? t(priceProblem.key, priceProblem.params) : undefined;

  const rows: AmountRow[] = [];
  if (preview.sale !== null) {
    rows.push({ label: t('community.sellForm.buyerPays'), value: formatPrice(preview.sale.price, locale) });
    rows.push({
      label: t('community.sellForm.commission'),
      value: `− ${formatPrice(preview.sale.commission, locale)}`,
      detail: t('community.sellForm.commissionDetail', { rate: formatRate(preview.sale.commissionRate, locale) }),
    });
    if (preview.sale.certificationFee > 0) {
      rows.push({
        label: t('community.sellForm.certificationFee'),
        value: `− ${formatPrice(preview.sale.certificationFee, locale)}`,
        detail: t('community.feeIndicative'),
      });
    }
    rows.push({ label: t('community.sellForm.net'), value: formatPrice(preview.sale.sellerNet, locale), emphasis: true });
  } else if (preview.exchange !== null) {
    rows.push({
      label: t('community.sellForm.exchangeCommission'),
      value: formatPrice(preview.exchange.commission, locale),
      detail: t('community.sellForm.exchangeCommissionDetail', {
        rate: formatRate(preview.exchange.commissionRate, locale),
      }),
    });
    if (preview.certificationFee > 0) {
      rows.push({
        label: t('community.sellForm.certificationFee'),
        value: formatPrice(preview.certificationFee, locale),
        detail: t('community.feeIndicative'),
      });
    }
  }
  if (preview.sale !== null && preview.exchange !== null) {
    rows.push({
      label: t('community.sellForm.exchangeCommission'),
      value: formatPrice(preview.exchange.commission, locale),
      detail: t('community.sellForm.ifExchanged'),
    });
  }

  return (
    <View style={styles.container}>
      <VCard style={styles.itemCard}>
        <VText variant="caption" tone="dim">
          {t('community.sellForm.item')}
        </VText>
        <VText variant="heading" tone="gold">
          {item.title ?? t('common.unknown')}
        </VText>
        <VText variant="caption" tone="dim">
          {t(`domains.${item.domain}.name`)}
        </VText>
        <VButton label={t('community.sellForm.changeItem')} variant="ghost" onPress={onChangeItem} />
      </VCard>

      <VText variant="body">{t('community.sellForm.kind')}</VText>
      <Segmented<ListingKind>
        value={kind}
        onChange={setKind}
        accessibilityLabel={t('community.sellForm.kind')}
        options={[
          { value: 'sale', label: t('community.sellForm.kindSale') },
          { value: 'exchange', label: t('community.sellForm.kindExchange') },
          { value: 'sale_or_exchange', label: t('community.sellForm.kindBoth') },
        ]}
      />

      <VTextInput
        label={isForSale(kind) ? t('community.askPrice') : t('community.sellForm.declaredValue')}
        value={price}
        onChangeText={(v) => {
          setPriceTouched(true);
          setPrice(v);
        }}
        keyboardType="decimal-pad"
        placeholder="250"
        error={priceError}
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

      {/* Décomposition en direct. */}
      {rows.length > 0 ? (
        <VCard style={styles.breakdown}>
          <VText variant="heading" tone="gold" accessibilityRole="header">
            {t('community.sellForm.breakdown')}
          </VText>
          <AmountRows rows={rows} />
          {preview.nextTier !== null ? (
            <VText variant="caption" tone="dim">
              {t('community.sellForm.nextTier', {
                count: preview.nextTier.salesNeeded,
                rate: formatRate(preview.nextTier.rate, locale),
              })}
            </VText>
          ) : isBestTier(commission.basis) ? (
            <VText variant="caption" tone="dim">
              {t('community.sellForm.bestTier')}
            </VText>
          ) : null}
          {rateNoticeKey !== null ? (
            <VText variant="caption" tone="dim" accessibilityLiveRegion="polite">
              {t(rateNoticeKey, { rate: formatRate(commission.basis.rate, locale) })}
            </VText>
          ) : null}
        </VCard>
      ) : null}

      {preview.certification === 'already' ? (
        <Notice tone="success" title={t('community.authenticated')}>
          {t('community.sellForm.alreadyCertified')}
        </Notice>
      ) : preview.certification === 'required' ? (
        <Notice tone="warning" title={t('community.certification.requiredTitle')}>
          {t('community.sellForm.certificationRequired', {
            threshold: formatPrice(EXPERT_APPRAISAL_THRESHOLD_EUR, locale),
            fee: formatPrice(preview.certificationFee, locale),
          })}
        </Notice>
      ) : (
        <CheckRow
          label={t('community.sellForm.voluntary')}
          hint={t('community.sellForm.voluntaryHint')}
          checked={voluntary}
          onChange={setVoluntary}
        />
      )}
      {preview.requirement.required && preview.value !== null && preview.requirement.referenceValue > preview.value ? (
        <VText variant="caption" tone="dim">
          {t('community.sellForm.estimateRule', {
            amount: formatPrice(preview.requirement.referenceValue, locale),
          })}
        </VText>
      ) : null}

      <VTextInput
        label={t('community.sellForm.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('community.sellForm.descriptionPlaceholder')}
        autoCapitalize="sentences"
      />
      {descriptionPreview !== null ? (
        <Notice tone="warning" title={t('community.redactionPreviewTitle')}>
          {descriptionPreview}
        </Notice>
      ) : null}
      {isOpenToExchange(kind) ? (
        <>
          <VTextInput
            label={t('community.sellForm.wishes')}
            value={wishes}
            onChangeText={setWishes}
            placeholder={t('community.sellForm.wishesPlaceholder')}
            autoCapitalize="sentences"
          />
          {wishesPreview !== null ? (
            <Notice tone="warning" title={t('community.redactionPreviewTitle')}>
              {wishesPreview}
            </Notice>
          ) : null}
        </>
      ) : null}

      <Notice title={t('community.anonymityTitle')}>{t('community.sellForm.anonymity')}</Notice>

      <VButton
        label={
          preview.certification === 'required' ? t('community.sellForm.publishAfterCertification') : t('community.publish')
        }
        onPress={() => publish.mutate()}
        // Estimations en cours de lecture : le seuil d'expertise n'est pas encore connu.
        disabled={preview.value === null || locked || history.isLoading}
        loading={publish.isPending}
      />
    </View>
  );
}

function SellContent() {
  const { t } = useTranslation();
  const client = getVelumClient();
  const params = useLocalSearchParams<{ itemId?: string; domain?: string }>();
  const initialItemId = stringParam(params.itemId);
  const domain = isVelumDomain(params.domain) ? params.domain : null;
  const [itemId, setItemId] = useState<string | null>(initialItemId);
  const [picking, setPicking] = useState(initialItemId === null);

  const itemQuery = useQuery({
    queryKey: ['items', itemId ?? ''],
    queryFn: () => client.items.get(itemId ?? ''),
    enabled: itemId !== null,
  });

  return (
    <Screen title={t('community.sellForm.title')} backFallback={routes.community()}>
      <VText variant="body" tone="dim" style={styles.intro}>
        {t('community.sellForm.intro')}
      </VText>
      {picking || itemId === null ? (
        <View style={styles.container}>
          <VText variant="heading" tone="gold" accessibilityRole="header">
            {t('community.sellForm.pick')}
          </VText>
          <ItemPicker
            selectedId={itemId}
            onSelect={(item) => {
              setItemId(item.id);
              setPicking(false);
            }}
            preferredDomain={domain}
            label={t('community.sellForm.pick')}
          />
        </View>
      ) : (
        <AsyncBlock source={itemQuery}>
          {(item) =>
            item === null ? (
              <VEmptyState
                title={t('community.sellForm.itemNotFound')}
                action={{ label: t('community.sellForm.pick'), onPress: () => setPicking(true) }}
              />
            ) : (
              <SellForm key={item.id} item={item} onChangeItem={() => setPicking(true)} />
            )
          }
        </AsyncBlock>
      )}
    </Screen>
  );
}

export default function SellScreen() {
  const { t } = useTranslation();
  return (
    <CommunityGate title={t('community.sellForm.title')} backFallback={routes.community()}>
      <SellContent />
    </CommunityGate>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: velumSpacing.md },
  container: { gap: velumSpacing.md },
  itemCard: { gap: velumSpacing.xs },
  breakdown: { gap: velumSpacing.sm },
});
