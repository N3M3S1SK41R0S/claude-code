/**
 * Écran Candidats : top-3 avec badge de confiance, actions Confirmer /
 * Affiner (saisie assistée par domaine) / Signaler une erreur.
 * Confirmer → analyze + création atomique item/médias + valuate → fiche objet.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ConfidenceBadge,
  VButton,
  VCard,
  VEmptyState,
  VSpinner,
  VText,
  VTextInput,
  velumSpacing,
} from '@velum/ui';
import type { Candidate, VelumDomain } from '@velum/core';

import { Screen } from '../../components/Screen';
import { useSession } from '../../lib/auth';
import { insertCapturedItem } from '../../lib/capturePersistence';
import { getVelumClient } from '../../lib/client';
import { errorMessage, velumErrorCode } from '../../lib/errors';
import { useCaptureStore } from '../../stores/captureStore';
import { showToast } from '../../stores/toastStore';

interface AssistedField {
  key: string;
  labelKey: string;
  numeric?: boolean;
}

/** Champs de saisie assistée par domaine. */
const ASSISTED_FIELDS: Record<VelumDomain, AssistedField[]> = {
  wine: [
    { key: 'producer', labelKey: 'candidates.fields.wineProducer' },
    { key: 'vintage', labelKey: 'candidates.fields.wineVintage', numeric: true },
    { key: 'appellation', labelKey: 'candidates.fields.wineAppellation' },
  ],
  coin: [
    { key: 'country', labelKey: 'candidates.fields.coinCountry' },
    { key: 'type', labelKey: 'candidates.fields.coinType' },
    { key: 'year', labelKey: 'candidates.fields.coinYear', numeric: true },
  ],
  art: [
    { key: 'artist', labelKey: 'candidates.fields.artArtist' },
    { key: 'title', labelKey: 'candidates.fields.artTitle' },
    { key: 'technique', labelKey: 'candidates.fields.artTechnique' },
  ],
  stamp: [
    { key: 'country', labelKey: 'candidates.fields.stampCountry' },
    { key: 'catalogNumber', labelKey: 'candidates.fields.stampCatalog' },
    { key: 'year', labelKey: 'candidates.fields.stampYear', numeric: true },
  ],
};

export default function Candidates() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const domain = useCaptureStore((s) => s.domain) ?? 'wine';
  const media = useCaptureStore((s) => s.media);
  const recognition = useCaptureStore((s) => s.recognition);
  const reset = useCaptureStore((s) => s.reset);

  const [assistedOpen, setAssistedOpen] = useState(recognition?.needsAssistedEntry ?? false);
  const [assistedBase, setAssistedBase] = useState<Candidate | null>(null);
  const [assistedValues, setAssistedValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: async (candidate: Candidate) => {
      const client = getVelumClient();
      const ownerId = session?.user?.id;
      if (!ownerId) throw new Error('Session requise');

      setStep(t('candidates.processing'));
      const analysis = await client.edge.analyze(domain, candidate);

      setStep(t('candidates.saving'));
      const item = await insertCapturedItem(
        {
          ownerId,
          domain,
          title: candidate.label,
          confidence: candidate.confidence,
          attributes: {
            ...candidate.attributes,
            analysis: analysis.payload,
            analysisEngine: analysis.engine,
            disclaimers: analysis.disclaimers,
          },
        },
        media,
        { items: client.items, itemMedia: client.itemMedia },
      );

      // Valorisation persistée côté serveur (itemId fourni). NO_OBSERVATIONS
      // n'est pas bloquant : la fiche reste consultable sans estimation.
      try {
        await client.edge.valuate(domain, candidate, item.id);
      } catch (error) {
        if (velumErrorCode(error) === 'BUDGET_EXCEEDED') throw error;
        showToast(errorMessage(error, t), 'info');
      }
      return item;
    },
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      reset();
      router.replace(`/item/${item.id}`);
    },
    onError: (error) => {
      setStep(null);
      if (velumErrorCode(error) === 'BUDGET_EXCEEDED') {
        showToast(errorMessage(error, t), 'danger');
        router.push('/paywall');
        return;
      }
      showToast(errorMessage(error, t), 'danger');
    },
  });

  const openAssisted = (base: Candidate | null) => {
    setAssistedBase(base);
    const initial: Record<string, string> = {};
    const fields = ASSISTED_FIELDS[domain];
    for (const field of fields) {
      const existing = base?.attributes[field.key];
      initial[field.key] = existing === undefined || existing === null ? '' : String(existing);
    }
    initial['label'] = base?.label ?? '';
    setAssistedValues(initial);
    setAssistedOpen(true);
  };

  const submitAssisted = () => {
    const attributes: Record<string, unknown> = { ...(assistedBase?.attributes ?? {}) };
    for (const field of ASSISTED_FIELDS[domain]) {
      const raw = (assistedValues[field.key] ?? '').trim();
      if (raw.length === 0) continue;
      attributes[field.key] = field.numeric ? Number(raw) : raw;
    }
    const label =
      (assistedValues['label'] ?? '').trim() ||
      ASSISTED_FIELDS[domain]
        .map((f) => (assistedValues[f.key] ?? '').trim())
        .filter((v) => v.length > 0)
        .join(' ');
    if (label.length === 0) {
      showToast(t('errors.INVALID_INPUT'), 'info');
      return;
    }
    const candidate: Candidate = {
      id: assistedBase?.id ?? `assisted-${Date.now()}`,
      domain,
      label,
      confidence: assistedBase?.confidence ?? 0.3,
      attributes,
    };
    confirmMutation.mutate(candidate);
  };

  const report = () => {
    showToast(t('candidates.reported'), 'success');
  };

  if (confirmMutation.isPending) {
    return (
      <Screen scroll={false}>
        <View style={styles.pending}>
          <VSpinner />
          <VText variant="body" tone="dim" center>
            {step ?? t('candidates.processing')}
          </VText>
        </View>
      </Screen>
    );
  }

  const candidates = recognition?.candidates.slice(0, 3) ?? [];

  return (
    <Screen>
      <VText variant="title">{t('candidates.title')}</VText>

      {recognition?.needsAssistedEntry ? (
        <VText variant="body" tone="gold" style={styles.notice}>
          {t('candidates.needsAssisted')}
        </VText>
      ) : null}

      {!assistedOpen && candidates.length === 0 ? (
        <VEmptyState
          title={t('candidates.empty')}
          message={t('candidates.emptyMessage')}
          action={{ label: t('candidates.assistedTitle'), onPress: () => openAssisted(null) }}
        />
      ) : null}

      {!assistedOpen
        ? candidates.map((candidate) => (
            <VCard key={candidate.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <VText variant="heading">{candidate.label}</VText>
                </View>
                <ConfidenceBadge value={candidate.confidence} />
              </View>
              <View style={styles.cardActions}>
                <VButton label={t('candidates.confirm')} onPress={() => confirmMutation.mutate(candidate)} />
                <VButton label={t('candidates.refine')} variant="secondary" onPress={() => openAssisted(candidate)} />
                <VButton label={t('candidates.report')} variant="ghost" onPress={report} />
              </View>
            </VCard>
          ))
        : null}

      {assistedOpen ? (
        <View style={styles.assisted}>
          <VText variant="heading" tone="gold">
            {t('candidates.assistedTitle')}
          </VText>
          <VTextInput
            label={t('candidates.fields.label')}
            value={assistedValues['label'] ?? ''}
            onChangeText={(v) => setAssistedValues((prev) => ({ ...prev, label: v }))}
          />
          {ASSISTED_FIELDS[domain].map((field) => (
            <VTextInput
              key={field.key}
              label={t(field.labelKey)}
              value={assistedValues[field.key] ?? ''}
              onChangeText={(v) => setAssistedValues((prev) => ({ ...prev, [field.key]: v }))}
              keyboardType={field.numeric ? 'numeric' : undefined}
            />
          ))}
          <VButton label={t('candidates.assistedSubmit')} onPress={submitAssisted} />
          {candidates.length > 0 ? (
            <VButton label={t('common.back')} variant="ghost" onPress={() => setAssistedOpen(false)} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginTop: velumSpacing.sm },
  card: { marginTop: velumSpacing.md },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
  cardTitle: { flex: 1 },
  cardActions: { gap: velumSpacing.sm, marginTop: velumSpacing.md },
  assisted: { gap: velumSpacing.md, marginTop: velumSpacing.lg },
  pending: { flex: 1, justifyContent: 'center', gap: velumSpacing.md },
});
