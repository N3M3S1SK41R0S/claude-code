/**
 * Fiche objet complète : en-tête (titre, domaine, confiance), sections
 * d'analyse par domaine, bloc VALORISATION (centrale, IC80/IC95, fiabilité,
 * sources), disclaimers TOUJOURS visibles, courbe de valeur, métadonnées
 * d'acquisition éditables, actions (alerte, export PDF, suppression).
 */
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ConfidenceBadge,
  VBadge,
  VButton,
  VCard,
  VListRow,
  VSpinner,
  VText,
  VTextInput,
  velumSpacing,
} from '@velum/ui';
import type {
  ArtAnalysisPayload,
  CoinAnalysisPayload,
  StampAnalysisPayload,
  ValuationRecord,
  VelumItem,
  WineAnalysisPayload,
} from '@velum/core';

import { Screen } from '../../components/Screen';
import { ValueChart } from '../../components/ValueChart';
import { ArtSheet } from '../../components/sheets/ArtSheet';
import { CoinSheet } from '../../components/sheets/CoinSheet';
import { StampSheet } from '../../components/sheets/StampSheet';
import { WineSheet } from '../../components/sheets/WineSheet';
import { KV, SheetSection } from '../../components/sheets/SheetSection';
import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { buildItemSheetHtml } from '../../lib/exporters';
import { formatEUR } from '../../lib/i18n';
import { showToast } from '../../stores/toastStore';

/** Extrait le payload d'analyse stocké dans attributes.analysis. */
function analysisPayload(item: VelumItem): Record<string, unknown> | null {
  const payload = item.attributes['analysis'];
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
}

function itemDisclaimers(item: VelumItem): string[] {
  const raw = item.attributes['disclaimers'];
  if (Array.isArray(raw)) return raw.filter((d): d is string => typeof d === 'string');
  return [];
}

export default function ItemSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = params.id ?? '';
  const client = getVelumClient();

  const itemQuery = useQuery({
    queryKey: ['items', itemId],
    queryFn: () => client.items.get(itemId),
    enabled: itemId.length > 0,
  });
  const latestQuery = useQuery({
    queryKey: ['valuations', itemId, 'latest'],
    queryFn: () => client.valuations.latest(itemId),
    enabled: itemId.length > 0,
  });
  const historyQuery = useQuery({
    queryKey: ['valuations', itemId, 'history'],
    queryFn: () => client.valuations.history(itemId),
    enabled: itemId.length > 0,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [acquiredAt, setAcquiredAt] = useState('');
  const [acquiredPrice, setAcquiredPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('');

  const item = itemQuery.data ?? null;
  const valuation = latestQuery.data ?? null;

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<VelumItem>) => {
      const updatedAt = new Date().toISOString();
      try {
        return await client.items.update(itemId, { ...patch, updatedAt });
      } catch {
        // Hors-ligne : mutation en file (last-write-wins au rejeu).
        await client.queue.enqueue({
          id: `mut-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          table: 'items',
          type: 'update',
          payload: { id: itemId, ...patch, updatedAt },
          queuedAt: updatedAt,
        });
        showToast(t('item.editQueued'), 'info');
        return null;
      }
    },
    onSuccess: (updated) => {
      if (updated !== null) showToast(t('item.editSaved'), 'success');
      setEditOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const openEdit = () => {
    if (!item) return;
    setAcquiredAt(item.acquiredAt ?? '');
    setAcquiredPrice(item.acquiredPrice === null ? '' : String(item.acquiredPrice));
    setCondition(item.condition ?? '');
    setNotes(item.notes ?? '');
    setLocation(item.storageLocation ?? '');
    setEditOpen(true);
  };

  const saveEdit = () => {
    const price = acquiredPrice.trim() === '' ? null : Number(acquiredPrice);
    saveMutation.mutate({
      acquiredAt: acquiredAt.trim() === '' ? null : acquiredAt.trim(),
      acquiredPrice: price !== null && Number.isNaN(price) ? null : price,
      condition: condition.trim() === '' ? null : condition.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
      storageLocation: location.trim() === '' ? null : location.trim(),
    });
  };

  const saveAlert = async () => {
    const threshold = Number(alertThreshold);
    if (Number.isNaN(threshold) || threshold <= 0) {
      showToast(t('errors.INVALID_INPUT'), 'info');
      return;
    }
    try {
      await client.alerts.upsert({
        itemId,
        type: 'price_threshold',
        config: { thresholdEUR: threshold },
        active: true,
      });
      showToast(t('item.alertSet', { value: formatEUR(threshold) }), 'success');
      setAlertOpen(false);
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  const exportPdf = async () => {
    if (!item) return;
    try {
      const html = buildItemSheetHtml(
        item,
        null,
        valuation,
        (key, options) => t(key, options ?? {}) as string,
      );
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch {
      showToast(t('item.exportError'), 'danger');
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('item.deleteTitle'), t('item.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await client.items.remove(itemId);
            } catch {
              await client.queue.enqueue({
                id: `mut-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                table: 'items',
                type: 'delete',
                payload: { id: itemId },
                queuedAt: new Date().toISOString(),
              });
            }
            showToast(t('item.deleted'), 'success');
            void queryClient.invalidateQueries({ queryKey: ['items'] });
            router.back();
          })();
        },
      },
    ]);
  };

  if (itemQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VText variant="heading" center>
            {t('item.notFound')}
          </VText>
          <VButton label={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const payload = analysisPayload(item);
  const disclaimers = itemDisclaimers(item);
  const history: ValuationRecord[] = historyQuery.data ?? [];

  return (
    <Screen>
      {/* En-tête */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <VText variant="title">{item.title ?? t('common.unknown')}</VText>
          <VBadge label={t(`domains.${item.domain}.name`)} tone="gold" />
        </View>
        {item.confidence !== null ? <ConfidenceBadge value={item.confidence} /> : null}
      </View>

      {/* Bloc VALORISATION */}
      <SheetSection title={t('item.valuationTitle')}>
        {valuation ? (
          <>
            <VText variant="title" tone="gold" accessibilityLabel={formatEUR(valuation.central)}>
              {formatEUR(valuation.central)}
            </VText>
            <KV
              label={t('item.ci80')}
              value={`${formatEUR(valuation.ci80Low)} – ${formatEUR(valuation.ci80High)}`}
            />
            <KV
              label={t('item.ci95')}
              value={`${formatEUR(valuation.ci95Low)} – ${formatEUR(valuation.ci95High)}`}
            />
            <KV
              label={t('item.reliability')}
              value={`${Math.round(valuation.reliability)} / 100 · ${t('item.nSources', { count: valuation.sources.length })}`}
            />
            <VText variant="caption" tone="dim">
              {t('item.sourcesTitle')}
            </VText>
            {valuation.sources.map((obs, i) => (
              <VListRow
                key={`${obs.source.name}-${i}`}
                title={obs.source.name}
                subtitle={t(`sourceKinds.${obs.source.kind}`)}
                right={<VText variant="body">{formatEUR(obs.price)}</VText>}
              />
            ))}
          </>
        ) : (
          <VText variant="body" tone="dim">
            {t('item.noValuation')}
          </VText>
        )}
      </SheetSection>

      {/* Disclaimers TOUJOURS visibles */}
      <SheetSection title={t('item.disclaimersTitle')}>
        {(disclaimers.length > 0 ? disclaimers : [t('item.defaultDisclaimer')]).map((d, i) => (
          <VText key={i} variant="caption" tone="gold">
            {d}
          </VText>
        ))}
      </SheetSection>

      {/* Courbe de valeur */}
      <SheetSection title={t('item.chartTitle')}>
        <ValueChart records={history} emptyLabel={t('item.chartNeedsMore')} />
      </SheetSection>

      {/* Sections d'analyse par domaine */}
      {item.domain === 'wine' ? (
        <WineSheet payload={payload as Partial<WineAnalysisPayload> | null} />
      ) : null}
      {item.domain === 'coin' ? (
        <CoinSheet payload={payload as Partial<CoinAnalysisPayload> | null} />
      ) : null}
      {item.domain === 'art' ? (
        <ArtSheet payload={payload as Partial<ArtAnalysisPayload> | null} />
      ) : null}
      {item.domain === 'stamp' ? (
        <StampSheet payload={payload as Partial<StampAnalysisPayload> | null} />
      ) : null}

      {/* Acquisition (éditable) */}
      <SheetSection title={t('item.acquisitionTitle')}>
        {editOpen ? (
          <>
            <VTextInput label={t('item.acquiredAt')} value={acquiredAt} onChangeText={setAcquiredAt} placeholder="2020-06-01" />
            <VTextInput label={t('item.acquiredPrice')} value={acquiredPrice} onChangeText={setAcquiredPrice} keyboardType="numeric" />
            <VTextInput label={t('item.condition')} value={condition} onChangeText={setCondition} />
            <VTextInput label={t('item.storageLocation')} value={location} onChangeText={setLocation} />
            <VTextInput label={t('item.notes')} value={notes} onChangeText={setNotes} />
            <VButton label={t('common.save')} onPress={saveEdit} loading={saveMutation.isPending} />
            <VButton label={t('common.cancel')} variant="ghost" onPress={() => setEditOpen(false)} />
          </>
        ) : (
          <>
            <KV label={t('item.acquiredAt')} value={item.acquiredAt ?? '—'} />
            <KV
              label={t('item.acquiredPrice')}
              value={item.acquiredPrice === null ? '—' : formatEUR(item.acquiredPrice)}
            />
            <KV label={t('item.condition')} value={item.condition ?? '—'} />
            <KV label={t('item.storageLocation')} value={item.storageLocation ?? '—'} />
            <KV label={t('item.notes')} value={item.notes ?? '—'} />
            <VButton label={t('common.edit')} variant="secondary" onPress={openEdit} accessibilityHint={t('item.acquisitionTitle')} />
          </>
        )}
      </SheetSection>

      {/* Actions */}
      <SheetSection title={t('item.actionsTitle')}>
        {alertOpen ? (
          <>
            <VTextInput
              label={t('item.alertPrompt')}
              value={alertThreshold}
              onChangeText={setAlertThreshold}
              keyboardType="numeric"
            />
            <VButton label={t('common.confirm')} onPress={() => void saveAlert()} />
            <VButton label={t('common.cancel')} variant="ghost" onPress={() => setAlertOpen(false)} />
          </>
        ) : (
          <VButton label={t('item.setAlert')} variant="secondary" onPress={() => setAlertOpen(true)} />
        )}
        <VButton label={t('item.exportPdf')} variant="secondary" onPress={() => void exportPdf()} />
        <VButton label={t('common.delete')} variant="danger" onPress={confirmDelete} />
        <VButton label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </SheetSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: velumSpacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
  headerText: { flex: 1, gap: velumSpacing.sm, alignItems: 'flex-start' },
});
