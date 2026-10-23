/**
 * Fiche objet. Ordre pensé pour limiter le défilement :
 *   en-tête (titre, catégorie, confiance) → barre d'actions rapides (Corriger,
 *   Estimer, Alerte, PDF, Arbitre) → vendre / échanger / envies →
 *   valorisation (+ avertissements toujours visibles) → identification
 *   (correction en texte) → fiche complète (ou carte « Charger ») → histoire &
 *   rareté → journal → acquisition → zone sensible (suppression).
 * Les sections longues sont repliables. Le retour passe par l'en-tête de
 * `Screen` (« ‹ Retour », repli sur la collection) : pas de bouton en bas.
 */
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ConfidenceBadge, VBadge, VButton, VSpinner, VText, velumSpacing } from '@velum/ui';
import type { HeritageProfile, VelumItem } from '@velum/core';

import { Screen } from '../../components/Screen';
import { AcquisitionSection } from '../../components/item/AcquisitionSection';
import { DangerZone } from '../../components/item/DangerZone';
import { FullSheetSection } from '../../components/item/FullSheetSection';
import { HeritageSection } from '../../components/item/HeritageSection';
import { IdentitySection } from '../../components/item/IdentitySection';
import { ProvenanceSection, TastingNotesSection } from '../../components/item/ItemJournalSections';
import { PriceAlertForm } from '../../components/item/PriceAlertForm';
import { QuickAction, QuickActionsBar } from '../../components/item/QuickActionsBar';
import { SellButton } from '../../components/item/SellButton';
import { AddToWishlistButton } from '../../components/wishlist/AddToWishlistButton';
import { ValuationSection } from '../../components/item/ValuationSection';
import { itemQueryKey, useItemSheetActions } from '../../components/item/useItemSheetActions';
import { entryFromItem } from '../../lib/wishlist';
import { getVelumClient } from '../../lib/client';
import { buildItemSheetHtml } from '../../lib/exporters';
import { analysisPayloadOf, analysisResultFromItem, fullSheetState } from '../../lib/itemSheet';
import { routes } from '../../lib/routes';
import { showToast } from '../../stores/toastStore';

/** Marge au-dessus d'une section atteinte par défilement automatique. */
const SCROLL_MARGIN = velumSpacing.md;

function ItemSheetBody({ item }: { item: VelumItem }) {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const actions = useItemSheetActions(item);
  const scrollRef = useRef<ScrollView>(null);
  const identityY = useRef(0);
  const [identityEditing, setIdentityEditing] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const latestQuery = useQuery({
    queryKey: ['valuations', item.id, 'latest'],
    queryFn: () => client.valuations.latest(item.id),
  });
  const historyQuery = useQuery({
    queryKey: ['valuations', item.id, 'history'],
    queryFn: () => client.valuations.history(item.id),
  });
  const valuation = latestQuery.data ?? null;

  /** « Corriger » : ouvre le formulaire d'identification et y amène l'écran. */
  const openCorrection = () => {
    setIdentityEditing(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, identityY.current - SCROLL_MARGIN), animated: true });
    });
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const html = buildItemSheetHtml(
        item,
        analysisResultFromItem(item),
        valuation,
        (key, options) => t(key, options ?? {}) as string,
      );
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch {
      showToast(t('item.exportError'), 'danger');
    } finally {
      setExporting(false);
    }
  };

  const sheetState = fullSheetState(item);
  const payload = analysisPayloadOf(item.attributes);
  const heritage = (payload as { heritage?: HeritageProfile } | null)?.heritage ?? null;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* En-tête */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <VText variant="title" accessibilityRole="header">
            {item.title ?? t('common.unknown')}
          </VText>
          <View style={styles.badges}>
            <VBadge label={t(`domains.${item.domain}.name`)} tone="gold" />
            {sheetState === 'missing' || sheetState === 'failed' ? (
              <VBadge label={t('item.fullSheet.badgeMissing')} tone="warning" />
            ) : null}
          </View>
        </View>
        {item.confidence !== null ? <ConfidenceBadge value={item.confidence} /> : null}
      </View>

      {/* Actions rapides : visibles sans défiler. */}
      <QuickActionsBar label={t('item.actionsTitle')}>
        <QuickAction
          icon="create-outline"
          label={t('item.quick.correct')}
          accessibilityHint={t('item.quick.correctHint')}
          onPress={openCorrection}
          expanded={identityEditing}
        />
        <QuickAction
          icon="pricetag-outline"
          label={valuation ? t('item.quick.reestimate') : t('item.quick.estimate')}
          accessibilityHint={t('item.quick.estimateHint')}
          onPress={() => actions.valuate.mutate()}
          loading={actions.valuate.isPending}
          highlighted={!latestQuery.isLoading && !latestQuery.isError && valuation === null}
        />
        <QuickAction
          icon="notifications-outline"
          label={t('item.quick.alert')}
          accessibilityHint={t('item.quick.alertHint')}
          onPress={() => setAlertOpen((open) => !open)}
          expanded={alertOpen}
        />
        <QuickAction
          icon="document-text-outline"
          label={t('item.quick.exportPdf')}
          accessibilityHint={t('item.quick.exportHint')}
          onPress={() => void exportPdf()}
          loading={exporting}
        />
        <QuickAction
          icon="scale-outline"
          label={t('item.quick.arbiter')}
          accessibilityHint={t('arbiter.title')}
          onPress={() => router.push(routes.arbiter(item.id) as Href)}
        />
      </QuickActionsBar>

      {alertOpen ? (
        <View style={styles.panel}>
          <PriceAlertForm itemId={item.id} onDone={() => setAlertOpen(false)} />
        </View>
      ) : null}

      {/* Marché et envies, juste sous les actions rapides. */}
      <View style={styles.panel}>
        {/* Emplacement « Mettre en vente / échanger » : SellButton (chantier
            plateformes) ouvre routes.sell(itemId) ou les offres. */}
        <SellButton itemId={item.id} />
        {/* « En racheter » : l'objet rejoint la liste d'envies de sa catégorie. */}
        <AddToWishlistButton {...entryFromItem(item)} />
      </View>

      <ValuationSection item={item} latestQuery={latestQuery} historyQuery={historyQuery} actions={actions} />

      <View
        onLayout={(event) => {
          identityY.current = event.nativeEvent.layout.y;
        }}
      >
        <IdentitySection
          item={item}
          valuation={valuation}
          editing={identityEditing}
          onEditingChange={setIdentityEditing}
          actions={actions}
        />
      </View>

      <FullSheetSection item={item} actions={actions} />

      {/* Histoire, rareté, nombre d'exemplaires — commun aux 5 modules. */}
      <HeritageSection heritage={heritage} />

      {/* Journal : dégustation (historique perso) + provenance (chaîne de possession) */}
      <TastingNotesSection item={item} />
      <ProvenanceSection itemId={item.id} />

      <AcquisitionSection item={item} />

      <DangerZone item={item} />
    </ScrollView>
  );
}

export default function ItemSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = typeof params.id === 'string' ? params.id : '';
  const client = getVelumClient();

  const itemQuery = useQuery({
    queryKey: itemQueryKey(itemId),
    queryFn: () => client.items.get(itemId),
    enabled: itemId.length > 0,
  });
  const item = itemQuery.data ?? null;

  let content;
  if (itemQuery.isLoading) {
    content = (
      <View style={styles.center}>
        <VSpinner />
      </View>
    );
  } else if (item !== null) {
    content = <ItemSheetBody item={item} />;
  } else if (itemQuery.isError) {
    // Panne : jamais présentée comme un objet introuvable.
    content = (
      <View style={styles.center}>
        <VText variant="heading" center>
          {t('item.loadError')}
        </VText>
        <VButton label={t('common.retry')} onPress={() => void itemQuery.refetch()} />
      </View>
    );
  } else {
    content = (
      <View style={styles.center}>
        <VText variant="heading" center>
          {t('item.notFound')}
        </VText>
        <VButton
          label={t('item.toCollection')}
          variant="secondary"
          onPress={() => router.replace(routes.collection() as Href)}
        />
      </View>
    );
  }

  return (
    <Screen scroll={false} title={t('item.screenTitle')} backFallback={routes.collection()}>
      {content}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: velumSpacing.xxl },
  center: { flex: 1, justifyContent: 'center', gap: velumSpacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
  headerText: { flex: 1, gap: velumSpacing.sm, alignItems: 'flex-start' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.xs },
  panel: { marginTop: velumSpacing.md, gap: velumSpacing.sm },
});
