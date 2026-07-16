/**
 * Mon carnet (fonction phare de l'offre Gold) : bibliothèque virtuelle de la
 * collection, mise en scène par domaine — CAVE (groupes par emplacement),
 * MÉDAILLIER (plateaux 3 colonnes), GALERIE (cimaises 2 colonnes), ALBUM
 * (planches 3 colonnes). Gating par entitlement `virtualBook` (Gold+),
 * édition d'emplacement en modal, bandeau de totaux (bookTotals) et badge
 * « Valorisation continue » pour Platine (rafraîchie par le cron serveur).
 */
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MIN_TOUCH_TARGET,
  VBadge,
  VButton,
  VCard,
  VEmptyState,
  VSpinner,
  VText,
  VTextInput,
  velumColors,
  velumRadius,
  velumSpacing,
} from '@velum/ui';
import type { VelumDomain, VelumItem } from '@velum/core';

import { Screen } from '../components/Screen';
import {
  artAttributionQualifier,
  artEstimatedPeriod,
  attributeNumber,
  attributeString,
  bookTotals,
  coinGradeLabel,
  domainBookLabelKey,
  formatCellarSlot,
  groupByLocation,
  parseCellarSlot,
  stampConditionStatus,
} from '../lib/carnet';
import {
  countFailedValuations,
  loadCarnetData,
  type CarnetData,
} from '../lib/carnetData';
import { getVelumClient } from '../lib/client';
import { cellarStats } from '../lib/cellarStats';
import { seriesGapsForItems } from '../lib/seriesGaps';
import { buildCellarShareHtml } from '../lib/exporters';
import { errorMessage } from '../lib/errors';
import { getActiveDomains } from '../lib/features';
import { formatDate, formatEUR } from '../lib/i18n';
import { usePlan } from '../lib/plan';
import { showToast } from '../stores/toastStore';

export default function Carnet() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const client = getVelumClient();
  const planState = usePlan();
  const canUseVirtualBook =
    planState.status === 'ready' && planState.entitlements.virtualBook;
  const plan = planState.status === 'ready' ? planState.plan : null;

  const domains = getActiveDomains();
  const [domain, setDomain] = useState<VelumDomain>(domains[0] ?? 'wine');

  // Modal « Déplacer » : item en cours + emplacement saisi. Deux modes :
  // « Position » (rangée / colonne / place → formatCellarSlot) ou texte libre.
  const [moveTarget, setMoveTarget] = useState<VelumItem | null>(null);
  const [moveLocation, setMoveLocation] = useState('');
  const [moveMode, setMoveMode] = useState<'slot' | 'text'>('slot');
  const [moveRow, setMoveRow] = useState('');
  const [moveColumn, setMoveColumn] = useState('');
  const [movePlace, setMovePlace] = useState('');

  const query = useQuery<CarnetData>({
    queryKey: ['items', 'carnet'],
    enabled: canUseVirtualBook,
    queryFn: () =>
      loadCarnetData({
        listItems: () => client.items.list(),
        latestValuation: (itemId) => client.valuations.latest(itemId),
      }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, storageLocation }: { id: string; storageLocation: string | null }) =>
      client.items.update(id, { storageLocation, updatedAt: new Date().toISOString() }),
    onSuccess: () => {
      showToast(t('carnet.moved'), 'success');
      setMoveTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    // Erreur réseau → toast non bloquant, la modal reste ouverte (rien de cassé).
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const items = query.data?.items ?? [];
  const latestByItem = query.data?.latestByItem ?? {};
  const failedValuationItemIds = query.data?.failedValuationItemIds ?? [];
  const failedValuationIds = useMemo(
    () => new Set(failedValuationItemIds),
    [failedValuationItemIds],
  );

  const domainItems = useMemo(() => items.filter((i) => i.domain === domain), [items, domain]);
  const domainValuationFailures = useMemo(
    () => countFailedValuations(domainItems, failedValuationItemIds),
    [domainItems, failedValuationItemIds],
  );
  const totals = useMemo(() => bookTotals(domainItems, latestByItem), [domainItems, latestByItem]);
  const wineGroups = useMemo(
    () => (domain === 'wine' ? groupByLocation(domainItems) : []),
    [domain, domainItems],
  );
  const stats = useMemo(
    () => (domain === 'wine' ? cellarStats(domainItems, latestByItem, new Date().getFullYear()) : null),
    [domain, domainItems, latestByItem],
  );
  const gaps = useMemo(
    () => (domain === 'coin' || domain === 'stamp' ? seriesGapsForItems(domainItems, domain) : []),
    [domain, domainItems],
  );
  const [sharing, setSharing] = useState(false);

  const shareCellar = async () => {
    if (sharing) return;
    if (domainValuationFailures > 0) {
      showToast(t('errors.SOURCE_UNAVAILABLE'), 'danger');
      return;
    }
    setSharing(true);
    try {
      const html = buildCellarShareHtml(domainItems, latestByItem, t);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      } else if (Platform.OS === 'web') {
        showToast(t('cellarShare.webHint'), 'info');
      }
    } catch {
      showToast(t('cellarShare.error'), 'danger');
    } finally {
      setSharing(false);
    }
  };

  if (planState.status === 'loading' || (canUseVirtualBook && query.isLoading)) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  if (planState.status === 'error') {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('carnet.title')}
            message={errorMessage(planState.error, t)}
            action={{ label: t('common.retry'), onPress: planState.retry }}
          />
        </View>
      </Screen>
    );
  }

  // GATING : le carnet virtuel appartient à l'offre Gold (et Platine).
  if (!planState.entitlements.virtualBook) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('carnet.upsellTitle')}
            message={t('carnet.upsellMessage')}
            action={{ label: t('carnet.upsellCta'), onPress: () => router.push('/paywall') }}
          />
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('carnet.title')}
            message={errorMessage(query.error, t)}
            action={{ label: t('common.retry'), onPress: () => void query.refetch() }}
          />
        </View>
      </Screen>
    );
  }

  const openMove = (item: VelumItem) => {
    const location = item.storageLocation ?? '';
    setMoveLocation(location);
    // Pré-remplissage : emplacement au format structuré → mode « Position » ;
    // texte libre existant → mode « Texte libre » ; vide → « Position ».
    const slot = parseCellarSlot(item.storageLocation);
    setMoveRow(slot?.row !== undefined ? String(slot.row) : '');
    setMoveColumn(slot?.column !== undefined ? String(slot.column) : '');
    setMovePlace(slot?.place !== undefined ? String(slot.place) : '');
    setMoveMode(slot !== null || location.trim() === '' ? 'slot' : 'text');
    setMoveTarget(item);
  };

  /** Entier strictement positif saisi, sinon undefined (champ ignoré). */
  const parseSlotField = (raw: string): number | undefined => {
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const saveMove = () => {
    if (!moveTarget || moveMutation.isPending) return;
    let storageLocation: string | null;
    if (moveMode === 'slot') {
      storageLocation = formatCellarSlot({
        row: parseSlotField(moveRow),
        column: parseSlotField(moveColumn),
        place: parseSlotField(movePlace),
      });
    } else {
      const trimmed = moveLocation.trim();
      storageLocation = trimmed === '' ? null : trimmed;
    }
    moveMutation.mutate({ id: moveTarget.id, storageLocation });
  };

  /** Action « Déplacer » (cible ≥ 44 pt) présente sur chaque vignette. */
  const moveAction = (item: VelumItem) => (
    <Pressable
      onPress={() => openMove(item)}
      accessibilityRole="button"
      accessibilityLabel={t('carnet.moveA11y', { title: item.title ?? t('common.unknown') })}
      hitSlop={velumSpacing.xs}
      style={({ pressed }) => [styles.moveAction, pressed && styles.pressed]}
    >
      <VText variant="caption" tone="gold">
        {t('carnet.move')}
      </VText>
    </Pressable>
  );

  const openItem = (item: VelumItem) => router.push(`/item/${item.id}`);
  const displayedTotal =
    domainValuationFailures > 0 ? '—' : formatEUR(totals.totalEUR);
  const totalAccessibilityLabel =
    `${t('carnet.totalValue')} : ${displayedTotal}` +
    (domainValuationFailures > 0 ? `. ${t('errors.SOURCE_UNAVAILABLE')}` : '');

  return (
    <Screen>
      <VText variant="title">{t('carnet.title')}</VText>

      {/* Sélecteur de module (chips des 4 domaines actifs) */}
      <View style={styles.chips} accessibilityLabel={t('carnet.moduleSelector')}>
        {domains.map((d) => {
          const selected = d === domain;
          return (
            <Pressable
              key={d}
              onPress={() => setDomain(d)}
              // Filtre de module : bouton sélectionnable. Le rôle « tab »
              // exigerait un parent « tablist » (absent en RN-web) → WCAG.
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(domainBookLabelKey(d))} — ${t(`domains.${d}.name`)}`}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <VText variant="body" tone={selected ? 'gold' : 'dim'}>
                {t(domainBookLabelKey(d))}
              </VText>
            </Pressable>
          );
        })}
      </View>

      {/* Bandeau de tête : totaux du carnet affiché */}
      <VCard style={styles.banner}>
        <View style={styles.bannerHeader}>
          <VText variant="heading" tone="gold">
            {t(domainBookLabelKey(domain))}
          </VText>
          {plan === 'platine' ? <VBadge label={t('carnet.liveValuation')} tone="gold" /> : null}
        </View>
        <VText
          variant="title"
          tone="gold"
          tabularNums
          accessibilityLabel={totalAccessibilityLabel}
        >
          {displayedTotal}
        </VText>
        <VText variant="caption" tone="dim">
          {`${t('carnet.itemsCount', { count: totals.count })} · ${t('carnet.valuedCount', {
            valued: totals.valuedCount,
            count: totals.count,
          })}`}
        </VText>
        {domainValuationFailures > 0 ? (
          <View style={styles.partialWarning}>
            <VText variant="caption" tone="gold">
              {t('errors.SOURCE_UNAVAILABLE')}
            </VText>
            <VButton
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void query.refetch()}
            />
          </View>
        ) : null}
        {totals.lastValuedAt ? (
          <VText variant="caption" tone="dim">
            {t('carnet.lastValuedAt', { date: formatDate(totals.lastValuedAt) })}
          </VText>
        ) : null}
        {plan === 'gold' ? (
          <Pressable
            onPress={() => router.push('/paywall')}
            accessibilityRole="button"
            accessibilityLabel={t('carnet.upgradePlatine')}
            style={({ pressed }) => [styles.upgradeLink, pressed && styles.pressed]}
          >
            <VText variant="caption" tone="gold">
              {t('carnet.upgradePlatine')}
            </VText>
          </Pressable>
        ) : null}
      </VCard>

      {domainItems.length === 0 ? (
        <VEmptyState
          title={t('carnet.emptyDomainTitle')}
          message={t('carnet.emptyDomainMessage')}
          action={{
            label: t('carnet.emptyDomainCta'),
            onPress: () => router.push('/(tabs)/capture'),
          }}
        />
      ) : null}

      {/* STATISTIQUES DE CAVE (vin) — répartition + à boire bientôt + partage */}
      {domain === 'wine' && stats && domainItems.length > 0 ? (
        <VCard style={styles.statsCard}>
          <VText variant="heading" tone="gold">
            {t('cellarStats.title')}
          </VText>
          {stats.drinkSoon.length > 0 ? (
            <VText variant="body">
              {t('cellarStats.drinkSoon', { count: stats.drinkSoon.length })}
            </VText>
          ) : null}
          {stats.byRegion.length > 0 ? (
            <View style={styles.statBlock}>
              <VText variant="caption" tone="dim">
                {t('cellarStats.byRegion')}
              </VText>
              {stats.byRegion.slice(0, 5).map((b) => (
                <View key={b.key} style={styles.statRow}>
                  <VText variant="body">{b.key}</VText>
                  <VText variant="caption" tone="dim">
                    {`${b.count} · ${formatEUR(b.valueEUR)}`}
                  </VText>
                </View>
              ))}
            </View>
          ) : null}
          {stats.byColor.length > 0 ? (
            <View style={styles.statBlock}>
              <VText variant="caption" tone="dim">
                {t('cellarStats.byColor')}
              </VText>
              {stats.byColor.map((b) => (
                <View key={b.key} style={styles.statRow}>
                  <VText variant="body">{b.key}</VText>
                  <VText variant="caption" tone="dim">
                    {t('cellarStats.bottles', { count: b.count })}
                  </VText>
                </View>
              ))}
            </View>
          ) : null}
          <VButton
            label={t('cellarShare.button')}
            variant="secondary"
            onPress={shareCellar}
            loading={sharing}
            disabled={sharing || domainValuationFailures > 0}
            accessibilityHint={
              domainValuationFailures > 0
                ? t('errors.SOURCE_UNAVAILABLE')
                : t('cellarShare.hint')
            }
          />
        </VCard>
      ) : null}

      {/* TROUS DE SÉRIE (pièces / timbres) — années manquantes par série */}
      {(domain === 'coin' || domain === 'stamp') && gaps.length > 0 ? (
        <VCard style={styles.statsCard}>
          <VText variant="heading" tone="gold">
            {t('seriesGaps.title')}
          </VText>
          <VText variant="caption" tone="dim">
            {t('seriesGaps.subtitle')}
          </VText>
          {gaps.map((gap) => (
            <View key={gap.series} style={styles.statBlock}>
              <VText variant="body">{gap.series}</VText>
              <VText variant="caption" tone="dim">
                {t('seriesGaps.missing', {
                  count: gap.missing.length,
                  years: gap.missing.slice(0, 12).join(', '),
                })}
              </VText>
            </View>
          ))}
        </VCard>
      ) : null}

      {/* CAVE — groupes par emplacement, en-tête avec compte et valeur */}
      {domain === 'wine'
        ? wineGroups.map((group) => {
            const groupTotals = bookTotals(group.items, latestByItem);
            const groupValuationFailures = countFailedValuations(
              group.items,
              failedValuationItemIds,
            );
            return (
              <View key={group.location ?? '__no_location__'} style={styles.group}>
                <View style={styles.groupHeader}>
                  <VText variant="heading" tone="gold">
                    {group.location ?? t('carnet.noLocation')}
                  </VText>
                  <VText variant="caption" tone="dim">
                    {`${t('carnet.bottleCount', { count: group.items.length })}${
                      groupTotals.valuedCount > 0 && groupValuationFailures === 0
                        ? ` · ${formatEUR(groupTotals.totalEUR)}`
                        : ''
                    }`}
                  </VText>
                </View>
                {group.items.map((item) => {
                  const latest = latestByItem[item.id] ?? null;
                  const vintage = attributeNumber(item, 'vintage');
                  const parts: string[] = [];
                  if (vintage !== null) parts.push(t('carnet.vintage', { year: vintage }));
                  parts.push(
                    failedValuationIds.has(item.id)
                      ? t('errors.SOURCE_UNAVAILABLE')
                      : latest
                        ? formatEUR(latest.central)
                        : t('item.noValuation'),
                  );
                  // Deux boutons FRÈRES (info + déplacer) plutôt qu'un bouton
                  // « Déplacer » imbriqué dans une ligne cliquable (WCAG :
                  // nested-interactive).
                  return (
                    <View key={item.id} style={styles.caveRow}>
                      <Pressable
                        style={({ pressed }) => [styles.caveInfo, pressed && styles.pressed]}
                        onPress={() => openItem(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.title ?? t('common.unknown')}, ${parts.join(' · ')}`}
                      >
                        <VText variant="body">{item.title ?? t('common.unknown')}</VText>
                        <VText variant="caption" tone="dim">
                          {parts.join(' · ')}
                        </VText>
                      </Pressable>
                      {moveAction(item)}
                    </View>
                  );
                })}
              </View>
            );
          })
        : null}

      {/* MÉDAILLIER — plateaux : grille 3 colonnes de pièces */}
      {domain === 'coin' ? (
        <View style={styles.grid}>
          {domainItems.map((item) => {
            const year = attributeNumber(item, 'year');
            const grade = coinGradeLabel(item);
            return (
              <VCard key={item.id} style={styles.cell3} onPress={() => openItem(item)}>
                <VText variant="caption" numberOfLines={2}>
                  {attributeString(item, 'type') ?? item.title ?? t('common.unknown')}
                </VText>
                {year !== null ? (
                  <VText variant="caption" tone="dim">
                    {String(year)}
                  </VText>
                ) : null}
                {grade ? <VBadge label={grade} tone="gold" /> : null}
                {moveAction(item)}
              </VCard>
            );
          })}
        </View>
      ) : null}

      {/* GALERIE — cimaises : grille 2 colonnes de tableaux */}
      {domain === 'art' ? (
        <View style={styles.grid}>
          {domainItems.map((item) => {
            const period = artEstimatedPeriod(item);
            const qualifier = artAttributionQualifier(item);
            return (
              <VCard key={item.id} style={styles.cell2} onPress={() => openItem(item)}>
                <VText variant="body" numberOfLines={2}>
                  {item.title ?? t('common.unknown')}
                </VText>
                {period ? (
                  <VText variant="caption" tone="dim">
                    {period}
                  </VText>
                ) : null}
                {qualifier ? (
                  <VText variant="caption" tone="gold">
                    {t(`item.art.qualifiers.${qualifier}`)}
                  </VText>
                ) : null}
                {moveAction(item)}
              </VCard>
            );
          })}
        </View>
      ) : null}

      {/* ALBUM — planches : grille 3 colonnes de timbres */}
      {domain === 'stamp' ? (
        <View style={styles.grid}>
          {domainItems.map((item) => {
            const year = attributeNumber(item, 'year');
            const status = stampConditionStatus(item);
            return (
              <VCard key={item.id} style={styles.cell3} onPress={() => openItem(item)}>
                <VText variant="caption" tone="gold" numberOfLines={2}>
                  {attributeString(item, 'catalogNumber') ?? item.title ?? t('common.unknown')}
                </VText>
                {year !== null ? (
                  <VText variant="caption" tone="dim">
                    {String(year)}
                  </VText>
                ) : null}
                {status ? (
                  <VText variant="caption" tone="dim" numberOfLines={2}>
                    {t(`item.stamp.status.${status}`)}
                  </VText>
                ) : null}
                {moveAction(item)}
              </VCard>
            );
          })}
        </View>
      ) : null}

      <View style={styles.footer}>
        <VButton label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </View>

      {/* Modal « Déplacer » : édition de l'emplacement physique */}
      <Modal
        visible={moveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveTarget(null)}
      >
        <View style={styles.backdrop}>
          <VCard style={styles.modalCard}>
            <VText variant="heading" tone="gold">
              {t('carnet.moveTitle')}
            </VText>
            <VText variant="body">{moveTarget?.title ?? t('common.unknown')}</VText>

            {/* Segment « Position » / « Texte libre » */}
            <View style={styles.modeRow} accessibilityLabel={t('carnet.slotModeSelector')}>
              {(['slot', 'text'] as const).map((mode) => {
                const selected = moveMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setMoveMode(mode)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(mode === 'slot' ? 'carnet.slotModePosition' : 'carnet.slotModeText')}
                    style={({ pressed }) => [
                      styles.modeChip,
                      selected && styles.chipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <VText variant="body" tone={selected ? 'gold' : 'dim'}>
                      {t(mode === 'slot' ? 'carnet.slotModePosition' : 'carnet.slotModeText')}
                    </VText>
                  </Pressable>
                );
              })}
            </View>

            {moveMode === 'slot' ? (
              <View style={styles.slotRow}>
                <View style={styles.slotField}>
                  <VTextInput
                    label={t('carnet.slotRow')}
                    value={moveRow}
                    onChangeText={setMoveRow}
                    keyboardType="numeric"
                    placeholder="3"
                  />
                </View>
                <View style={styles.slotField}>
                  <VTextInput
                    label={t('carnet.slotColumn')}
                    value={moveColumn}
                    onChangeText={setMoveColumn}
                    keyboardType="numeric"
                    placeholder="4"
                  />
                </View>
                <View style={styles.slotField}>
                  <VTextInput
                    label={t('carnet.slotPlace')}
                    value={movePlace}
                    onChangeText={setMovePlace}
                    keyboardType="numeric"
                    placeholder="2"
                  />
                </View>
              </View>
            ) : (
              <VTextInput
                label={t('item.storageLocation')}
                value={moveLocation}
                onChangeText={setMoveLocation}
                placeholder={t('carnet.movePlaceholder')}
              />
            )}
            <VButton
              label={t('common.save')}
              onPress={saveMove}
              loading={moveMutation.isPending}
              accessibilityHint={t('carnet.moveTitle')}
            />
            <VButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => setMoveTarget(null)}
            />
          </VCard>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: velumSpacing.sm,
    marginVertical: velumSpacing.md,
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: velumSpacing.lg,
    borderRadius: velumRadius.seal,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    backgroundColor: velumColors.ink.soft,
  },
  chipSelected: {
    borderColor: velumColors.gold.DEFAULT,
    backgroundColor: velumColors.ink.raised,
  },
  banner: { gap: velumSpacing.xs, marginBottom: velumSpacing.md },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
  partialWarning: { gap: velumSpacing.sm, alignItems: 'flex-start' },
  upgradeLink: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  group: { marginTop: velumSpacing.lg, gap: velumSpacing.xs },
  groupHeader: { gap: velumSpacing.xs / 2 },
  caveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: velumColors.ink.border,
  },
  caveInfo: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingVertical: velumSpacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: velumSpacing.sm,
    marginTop: velumSpacing.md,
  },
  cell3: { flexBasis: '30%', flexGrow: 1, maxWidth: '32%', gap: velumSpacing.xs },
  cell2: { flexBasis: '47%', flexGrow: 1, maxWidth: '48.5%', gap: velumSpacing.xs },
  moveAction: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  footer: { marginTop: velumSpacing.xl },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: velumSpacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalCard: { gap: velumSpacing.md },
  modeRow: { flexDirection: 'row', gap: velumSpacing.sm },
  modeChip: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: velumSpacing.md,
    borderRadius: velumRadius.seal,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    backgroundColor: velumColors.ink.soft,
  },
  slotRow: { flexDirection: 'row', gap: velumSpacing.sm },
  slotField: { flex: 1 },
  statsCard: { gap: velumSpacing.sm },
  statBlock: { gap: velumSpacing.xs / 2 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
});
