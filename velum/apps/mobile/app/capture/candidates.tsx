/**
 * Écran Candidats (scan éclair) : top-3 avec confiance, classement et
 * fourchette indicative.
 *  - « Enregistrer » crée l'objet IMMÉDIATEMENT (sans fiche complète, marquée
 *    « à charger »), rattache les photos, lance la valorisation en arrière-plan
 *    et ouvre la fiche ;
 *  - « Enregistrer avec la fiche complète » = analyse experte AVANT
 *    l'enregistrement (plus lent) — action principale en saisie complète ;
 *  - « Corriger » : correction en texte des infos lues sur la photo, tracée ;
 *  - « Ajouter à mes envies » : garde l'idée sans l'ajouter à la collection.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VEmptyState, VSpinner, VText, velumSpacing } from '@velum/ui';
import { VelumError, type Candidate, type VelumItem } from '@velum/core';

import { CandidateCard } from '../../components/capture/CandidateCard';
import {
  IdentityCorrectionForm,
  type CorrectionAction,
  type CorrectionDraft,
} from '../../components/capture/IdentityCorrectionForm';
import { Screen } from '../../components/Screen';
import { identityAttributes, itemToCandidate } from '../../lib/analysisState';
import { useSession } from '../../lib/auth';
import { secondsForDisplay, settledStoragePaths } from '../../lib/batchCapture';
import {
  correctCandidate,
  fullCaptureAttributes,
  insertCapturedItem,
  newItemFromCandidate,
  quickCaptureAttributes,
  runInBackground,
} from '../../lib/capturePersistence';
import { getVelumClient } from '../../lib/client';
import { errorMessage, velumErrorCode } from '../../lib/errors';
import { routes } from '../../lib/routes';
import { captureUploads } from '../../lib/uploadMedia';
import { useCaptureStore } from '../../stores/captureStore';
import { showToast } from '../../stores/toastStore';

type BusyKind = 'quick' | 'full' | 'wish';

/** Éditeur ouvert : correction d'un candidat, ou saisie assistée (base null). */
interface EditorState {
  base: Candidate | null;
}

export default function Candidates() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const domain = useCaptureStore((s) => s.domain) ?? 'wine';
  const mode = useCaptureStore((s) => s.mode);
  const media = useCaptureStore((s) => s.media);
  const recognition = useCaptureStore((s) => s.recognition);
  const recognizedInMs = useCaptureStore((s) => s.recognizedInMs);
  const reset = useCaptureStore((s) => s.reset);

  const candidates = recognition?.candidates.slice(0, 3) ?? [];
  // Identification incertaine : la saisie assistée s'ouvre, pré-remplie avec la meilleure lecture.
  const [editor, setEditor] = useState<EditorState | null>(() =>
    recognition?.needsAssistedEntry ? { base: recognition.candidates[0] ?? null } : null,
  );
  const [busy, setBusy] = useState<{ id: string; kind: BusyKind } | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [wished, setWished] = useState(false);

  const handleError = (error: unknown) => {
    setBusy(null);
    setStep(null);
    if (velumErrorCode(error) === 'BUDGET_EXCEEDED') {
      showToast(errorMessage(error, t), 'danger');
      router.push(routes.paywall());
      return;
    }
    showToast(errorMessage(error, t), 'danger');
  };

  const persist = async (candidate: Candidate, attributes: Record<string, unknown>): Promise<VelumItem> => {
    const client = getVelumClient();
    const ownerId = session?.user?.id;
    if (!ownerId) throw new VelumError('UNAUTHORIZED', 'Session requise');
    // Photos : chemins déjà téléversés (le téléversement a démarré à la prise de vue).
    const paths = await settledStoragePaths(media, captureUploads);
    return insertCapturedItem(newItemFromCandidate(ownerId, domain, candidate, attributes), paths, {
      items: client.items,
      itemMedia: client.itemMedia,
    });
  };

  const openItem = (item: VelumItem) => {
    void queryClient.invalidateQueries({ queryKey: ['items'] });
    captureUploads.clear();
    reset();
    router.replace(routes.item(item.id));
  };

  // ── Scan éclair : enregistrement immédiat, valorisation en arrière-plan ──
  const quickSave = useMutation({
    mutationFn: (candidate: Candidate) => persist(candidate, quickCaptureAttributes(candidate)),
    onSuccess: (item) => {
      const client = getVelumClient();
      void runInBackground(
        () => client.edge.valuate(domain, itemToCandidate(item), item.id),
        () => showToast(t('candidates.valuationPending'), 'info'),
      ).then((outcome) => {
        if (outcome !== 'ok') return;
        void queryClient.invalidateQueries({ queryKey: ['valuations', item.id] });
        void queryClient.invalidateQueries({ queryKey: ['items'] });
      });
      openItem(item);
    },
    onError: handleError,
  });

  // ── Fiche complète AVANT l'enregistrement (comportement historique) ──
  const fullSave = useMutation({
    mutationFn: async (candidate: Candidate) => {
      const client = getVelumClient();
      setStep(t('candidates.processing'));
      const analysis = await client.edge.analyze(domain, candidate);
      setStep(t('candidates.saving'));
      const item = await persist(candidate, fullCaptureAttributes(candidate, analysis, new Date()));
      // NO_OBSERVATIONS n'est pas bloquant : la fiche reste consultable sans estimation.
      try {
        await client.edge.valuate(domain, itemToCandidate(item), item.id);
      } catch (error) {
        if (velumErrorCode(error) === 'BUDGET_EXCEEDED') throw error;
        showToast(errorMessage(error, t), 'info');
      }
      return item;
    },
    onSuccess: openItem,
    onError: handleError,
  });

  const wish = useMutation({
    mutationFn: (candidate: Candidate) =>
      getVelumClient().wishlist.add({
        domain,
        title: candidate.label,
        attributes: identityAttributes(candidate.attributes),
        source: 'scan',
        kind: 'wish',
      }),
    onSuccess: () => {
      setBusy(null);
      setWished(true);
      void queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      showToast(t('candidates.wishAdded'), 'success');
    },
    onError: handleError,
  });

  const run = (candidate: Candidate, kind: BusyKind) => {
    if (busy !== null) return;
    setBusy({ id: candidate.id, kind });
    if (kind === 'quick') quickSave.mutate(candidate);
    else if (kind === 'full') fullSave.mutate(candidate);
    else wish.mutate(candidate);
  };

  /** Candidat issu du formulaire (lecture corrigée et tracée, ou saisie assistée). */
  const fromDraft = (draft: CorrectionDraft): Candidate => {
    const base: Candidate = editor?.base ?? {
      id: `assisted-${Date.now()}`,
      domain,
      label: '',
      confidence: 0.3,
      attributes: {},
    };
    return correctCandidate({ candidate: base, domain, values: draft.values, label: draft.label, now: new Date() })
      .candidate;
  };

  if (fullSave.isPending) {
    return (
      <Screen scroll={false} title={t('candidates.title')}>
        <View style={styles.pending} accessibilityLiveRegion="polite">
          <VSpinner />
          <VText variant="body" tone="dim" center>
            {step ?? t('candidates.processing')}
          </VText>
        </View>
      </Screen>
    );
  }

  const primaryKind: BusyKind = mode === 'full' ? 'full' : 'quick';
  const secondaryKind: BusyKind = mode === 'full' ? 'quick' : 'full';
  const editorActions: CorrectionAction[] = [
    {
      label: primaryKind === 'quick' ? t('candidates.save') : t('candidates.saveFull'),
      onSubmit: (draft) => run(fromDraft(draft), primaryKind),
    },
    {
      label: t('candidates.addWish'),
      variant: 'secondary',
      accessibilityHint: t('candidates.addWishHint'),
      onSubmit: (draft) => run(fromDraft(draft), 'wish'),
    },
    {
      label: secondaryKind === 'quick' ? t('candidates.save') : t('candidates.saveFull'),
      variant: 'ghost',
      onSubmit: (draft) => run(fromDraft(draft), secondaryKind),
    },
  ];

  return (
    <Screen title={t('candidates.title')}>
      {recognizedInMs !== null ? (
        <VText variant="caption" tone="dim">
          {t('candidates.recognizedIn', {
            seconds: secondsForDisplay(recognizedInMs).toLocaleString(i18n.language),
          })}
        </VText>
      ) : null}

      {recognition?.needsAssistedEntry ? (
        <VText variant="body" tone="gold" style={styles.notice}>
          {t('candidates.needsAssisted')}
        </VText>
      ) : null}

      {wished ? (
        <View style={styles.wished}>
          <VText variant="caption" tone="gold">
            {t('candidates.wishAdded')}
          </VText>
          <VButton
            label={t('candidates.seeWishlist')}
            variant="ghost"
            onPress={() => router.push(routes.wishlist(domain))}
          />
        </View>
      ) : null}

      {editor !== null ? (
        <View style={styles.editor}>
          <IdentityCorrectionForm
            key={editor.base?.id ?? 'assisted'}
            domain={domain}
            base={editor.base}
            title={editor.base ? t('candidates.correctionTitle') : t('candidates.assistedTitle')}
            hint={editor.base ? t('candidates.correctionHint') : undefined}
            actions={editorActions}
            busy={busy !== null}
            onCancel={candidates.length > 0 ? () => setEditor(null) : undefined}
          />
        </View>
      ) : null}

      {editor === null && candidates.length === 0 ? (
        <VEmptyState
          title={t('candidates.empty')}
          message={t('candidates.emptyMessage')}
          action={{ label: t('candidates.assistedTitle'), onPress: () => setEditor({ base: null }) }}
        />
      ) : null}

      {editor === null
        ? candidates.map((candidate, index) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              mode={mode}
              highlighted={index === 0}
              busy={busy?.id === candidate.id ? busy.kind : null}
              disabled={busy !== null}
              onSave={() => run(candidate, 'quick')}
              onSaveFull={() => run(candidate, 'full')}
              onCorrect={() => setEditor({ base: candidate })}
              onWish={() => run(candidate, 'wish')}
            />
          ))
        : null}

      {editor === null && candidates.length > 0 ? (
        <View style={styles.footer}>
          <VButton
            label={t('candidates.assistedTitle')}
            variant="ghost"
            onPress={() => setEditor({ base: null })}
            disabled={busy !== null}
          />
          <VButton
            label={t('candidates.report')}
            variant="ghost"
            onPress={() => showToast(t('candidates.reported'), 'success')}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginTop: velumSpacing.sm },
  wished: { marginTop: velumSpacing.sm, gap: velumSpacing.xs },
  editor: { marginTop: velumSpacing.md },
  footer: { marginTop: velumSpacing.lg, gap: velumSpacing.sm },
  pending: { flex: 1, justifyContent: 'center', gap: velumSpacing.md },
});
