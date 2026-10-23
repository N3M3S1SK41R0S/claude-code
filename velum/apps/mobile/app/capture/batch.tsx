/**
 * MODE CLASSEUR — enregistrer vite une série d'objets (timbres, pièces…).
 *  - « Série » : une photo par objet, prises à la suite ; chaque photo est
 *    téléversée et identifiée en arrière-plan (2 à la fois) pendant que
 *    l'utilisateur photographie la suivante ;
 *  - « Planche » (timbres, pièces) : UNE photo de page de classeur ou de
 *    plateau → une ligne par objet détecté (24 au plus).
 * Chaque ligne : Enregistrer / Corriger / Ignorer ; « Tout enregistrer »
 * prend les lignes fiables (voir RELIABLE_CONFIDENCE). Les objets sont créés
 * sans fiche complète (chargée à la demande) et valorisés en arrière-plan,
 * une valorisation à la fois. Logique pure : lib/batchQueue.ts.
 *
 * Quitter avec des lignes non enregistrées demande TOUJOURS confirmation,
 * quelle que soit la sortie : bouton Retour ou sceau de l'en-tête, retour
 * matériel Android, retour du navigateur (écouteur `beforeRemove`), balayage
 * iOS (désactivé tant qu'il reste des lignes), fermeture ou rechargement de
 * l'onglet sur le web (`beforeunload`).
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VCard, VEmptyState, VText, velumSpacing } from '@velum/ui';
import { VelumError, type Candidate, type CaptureInput, type VelumDomain } from '@velum/core';

import { AiConsentModal } from '../../components/AiConsentModal';
import { Screen } from '../../components/Screen';
import { BatchRowCard } from '../../components/capture/BatchRowCard';
import type { CorrectionDraft } from '../../components/capture/IdentityCorrectionForm';
import { SegmentedChoice } from '../../components/capture/SegmentedChoice';
import { ShutterCamera, type CapturedShot } from '../../components/capture/ShutterCamera';
import { itemToCandidate } from '../../lib/analysisState';
import { useSession } from '../../lib/auth';
import {
  PRIMARY_ROLE,
  QUICK_JPEG_QUALITY,
  QUICK_MAX_EDGE,
  SHEET_JPEG_QUALITY,
  SHEET_MAX_EDGE,
  countUnattached,
  createUploadTracker,
  formatEstimateRange,
  mediaForRecognition,
  settledStoragePaths,
} from '../../lib/batchCapture';
import {
  BATCH_CONCURRENCY,
  EMPTY_BATCH,
  RELIABLE_CONFIDENCE,
  batchReducer,
  batchSummary,
  displayOrder,
  effectiveCandidate,
  isRecognizedRow,
  nextToRun,
  photosInUse,
  rowsForSaveAll,
  supportsSheet,
  unsavedCount,
  type BatchRow,
} from '../../lib/batchQueue';
import {
  correctCandidate,
  createSerialQueue,
  insertCapturedItem,
  newItemFromCandidate,
  quickCaptureAttributes,
} from '../../lib/capturePersistence';
import { getVelumClient } from '../../lib/client';
import { isDemoMode } from '../../lib/env';
import { velumErrorCode } from '../../lib/errors';
import { useGoBack } from '../../lib/navigation';
import { routes } from '../../lib/routes';
import { uploadCaptureMedia } from '../../lib/uploadMedia';
import { useSettingsStore } from '../../stores/settingsStore';
import { showToast } from '../../stores/toastStore';

const DOMAINS: VelumDomain[] = ['wine', 'coin', 'art', 'stamp', 'watch'];

type SubMode = 'series' | 'sheet';

/** Résultat de l'enregistrement d'une ligne (photos non rattachées à signaler). */
type SaveOutcome = { ok: false } | { ok: true; unattached: number };

/** Codes d'erreur ayant un message dédié dans `errors.*`. */
const KNOWN_ERROR_CODES = new Set([
  'NO_OBSERVATIONS',
  'RECOGNITION_FAILED',
  'ANALYSIS_FAILED',
  'SOURCE_UNAVAILABLE',
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'BUDGET_EXCEEDED',
  'PLAN_REQUIRED',
]);

export default function BatchCapture() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const params = useLocalSearchParams<{ domain?: string }>();
  const domain: VelumDomain = DOMAINS.includes(params.domain as VelumDomain)
    ? (params.domain as VelumDomain)
    : 'stamp';
  const sheetAvailable = supportsSheet(domain);

  const [subMode, setSubMode] = useState<SubMode>(sheetAvailable ? 'sheet' : 'series');
  const [state, dispatch] = useReducer(batchReducer, EMPTY_BATCH);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Lu pendant « Tout enregistrer » (boucle asynchrone) : toujours la valeur courante.
  const editingRef = useRef<string | null>(null);
  editingRef.current = editingId;
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [savingAll, setSavingAll] = useState<{ done: number; total: number } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const aiConsent = useSettingsStore((s) => s.aiConsent);
  const setAiConsent = useSettingsStore((s) => s.setAiConsent);

  // Références stables pendant toute la session de classement.
  const stateRef = useRef(state);
  stateRef.current = state;
  const tracker = useRef(createUploadTracker(uploadCaptureMedia)).current;
  const trackedPhotos = useRef(new Set<string>());
  const inFlight = useRef(new Set<string>());
  const savingIds = useRef(new Set<string>());
  const idSeq = useRef(0);
  const valuationWarned = useRef(false);
  const warnValuation = useRef<() => void>(() => undefined);
  warnValuation.current = () => {
    // Un seul avertissement par session : pas de pluie de toasts sur une série.
    if (valuationWarned.current) return;
    valuationWarned.current = true;
    showToast(t('batch.valuationLater'), 'info');
  };
  const valuations = useRef(createSerialQueue(() => warnValuation.current())).current;

  // ── Sortie : rien n'est perdu en silence ─────────────────────────────────────
  const goBack = useGoBack(routes.captureTab());
  const pendingCount = unsavedCount(state);
  /** Action de navigation interceptée (objet `{ type, … }`, jamais une fonction). */
  type LeaveAction = Extract<Parameters<typeof navigation.dispatch>[0], { type: string }>;
  /** Sortie interceptée, rejouée sur « Quitter quand même ». */
  const pendingLeave = useRef<LeaveAction | null>(null);
  /** Sortie confirmée en cours : l'écouteur la laisse passer. */
  const leaveAllowed = useRef(false);

  // TOUTES les sorties de l'écran passent par `beforeRemove` : bouton Retour et
  // sceau de l'en-tête, retour matériel Android, retour du navigateur (web).
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (leaveAllowed.current || unsavedCount(stateRef.current) === 0) return;
        event.preventDefault();
        pendingLeave.current = event.data.action;
        setConfirmLeave(true);
      }),
    [navigation],
  );

  // Web : fermeture ou rechargement de l'onglet (hors navigation de l'app).
  const hasUnsaved = pendingCount > 0;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !hasUnsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Requis par certains navigateurs pour afficher la confirmation native.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  // VoiceOver n'annonce pas les régions « live » : annonce explicite à l'ouverture.
  useEffect(() => {
    if (!confirmLeave) return;
    AccessibilityInfo.announceForAccessibility(t('batch.leaveTitle', { count: unsavedCount(stateRef.current) }));
  }, [confirmLeave, t]);

  const stay = () => {
    const action = pendingLeave.current;
    pendingLeave.current = null;
    setConfirmLeave(false);
    // Web : le retour du navigateur (action RESET) a déjà changé l'URL ; on la rétablit.
    if (Platform.OS === 'web' && action?.type === 'RESET' && typeof window !== 'undefined') {
      window.history.forward();
    }
  };

  const leaveAnyway = () => {
    const action = pendingLeave.current;
    pendingLeave.current = null;
    setConfirmLeave(false);
    leaveAllowed.current = true;
    try {
      if (action) navigation.dispatch(action);
      else goBack();
    } finally {
      leaveAllowed.current = false;
    }
  };

  // Plus rien à perdre (enregistrement terminé pendant que la fenêtre est
  // ouverte) : elle se ferme, l'utilisateur reste sur l'écran.
  useEffect(() => {
    if (!hasUnsaved && pendingLeave.current !== null) stay();
    // `stay` ne lit que des références stables.
  }, [hasUnsaved]);

  /** Téléverse une photo (ou relance un téléversement en échec) ; le chemin rejoint ses lignes. */
  const startUpload = (photo: string) => {
    trackedPhotos.current.add(photo);
    void tracker.start(photo).then((path) => {
      if (path) dispatch({ type: 'uploaded', photo, storagePath: path });
    });
  };

  // ── Reconnaissance en arrière-plan, concurrence bornée ──────────────────────
  const recognizeRow = async (row: BatchRow) => {
    const client = getVelumClient();
    // Nouvel essai (réseau revenu) : un téléversement en échec est relancé.
    for (const media of row.media) {
      if (media.storagePath || !media.base64) continue;
      const upload = tracker.peek(media.base64);
      if (upload === undefined || upload.state === 'failed') startUpload(media.base64);
    }
    const shots = row.media
      .filter((m): m is typeof m & { base64: string } => typeof m.base64 === 'string')
      .map((m) => ({ role: m.role, base64: m.base64, ...(m.storagePath ? { storagePath: m.storagePath } : {}) }));
    const input: CaptureInput = { kind: 'photo', media: mediaForRecognition(shots, tracker) };
    try {
      if (row.source === 'sheet') {
        if (!client.edge.recognizeSheet) {
          throw new VelumError('SOURCE_UNAVAILABLE', 'Mode planche indisponible sur ce client');
        }
        const result = await client.edge.recognizeSheet(domain, input);
        dispatch({ type: 'sheetRecognized', id: row.id, detections: result.detections, truncated: result.truncated });
      } else {
        const result = await client.edge.recognize(domain, input);
        dispatch({ type: 'recognized', id: row.id, candidates: result.candidates });
      }
    } catch (error) {
      const code = velumErrorCode(error) ?? 'generic';
      dispatch({ type: 'failed', id: row.id, errorCode: code });
      // Quota atteint : inutile d'épuiser la file, elle se met en pause.
      if (code === 'BUDGET_EXCEEDED') setQuotaBlocked(true);
    }
  };

  // Mémoire bornée : une photo qu'aucune ligne en cours n'utilise est oubliée.
  useEffect(() => {
    const inUse = photosInUse(state);
    for (const photo of trackedPhotos.current) {
      if (inUse.has(photo)) continue;
      tracker.forget(photo);
      trackedPhotos.current.delete(photo);
    }
  }, [state, tracker]);

  useEffect(() => {
    if (quotaBlocked || aiConsent !== true) return;
    for (const id of nextToRun(state, BATCH_CONCURRENCY, inFlight.current)) {
      const row = state.rows.find((r) => r.id === id);
      if (!row) continue;
      inFlight.current.add(id);
      dispatch({ type: 'start', id });
      void recognizeRow(row).finally(() => {
        inFlight.current.delete(id);
      });
    }
    // recognizeRow ne lit que des valeurs stables pour la session (domaine, tracker).
  }, [state, quotaBlocked, aiConsent]);

  // ── Prise de vue ─────────────────────────────────────────────────────────────
  const onShot = (shot: CapturedShot) => {
    if (aiConsent !== true) {
      showToast(t('aiConsent.declinedBanner'), 'info');
      return;
    }
    idSeq.current += 1;
    const id = `row-${Date.now().toString(36)}-${idSeq.current}`;
    const sheet = subMode === 'sheet';
    dispatch({
      type: 'enqueue',
      id,
      source: sheet ? 'sheet' : 'shot',
      thumbnailUri: shot.uri,
      media: [{ role: sheet ? 'detail' : PRIMARY_ROLE[domain], base64: shot.dataUrl }],
    });
    // Téléversement immédiat : la reconnaissance ne l'attend pas, l'enregistrement s'en sert.
    startUpload(shot.dataUrl);
  };

  // ── Enregistrement ───────────────────────────────────────────────────────────
  const saveRow = async (rowId: string): Promise<SaveOutcome> => {
    const row = stateRef.current.rows.find((r) => r.id === rowId);
    const candidate = row ? effectiveCandidate(row) : null;
    if (!row || !candidate || savingIds.current.has(rowId)) return { ok: false };
    if (!isRecognizedRow(row)) return { ok: false };
    const ownerId = session?.user?.id;
    if (!ownerId) {
      showToast(t('errors.UNAUTHORIZED'), 'danger');
      return { ok: false };
    }
    const client = getVelumClient();
    savingIds.current.add(rowId);
    dispatch({ type: 'saving', id: rowId });
    try {
      const shots = row.media.map((m) => ({
        role: m.role,
        base64: m.base64 ?? '',
        ...(m.storagePath ? { storagePath: m.storagePath } : {}),
      }));
      // Un téléversement en échec est relancé une fois avant l'enregistrement.
      const paths = await settledStoragePaths(shots, tracker);
      const item = await insertCapturedItem(
        newItemFromCandidate(ownerId, domain, candidate, quickCaptureAttributes(candidate)),
        paths,
        { items: client.items, itemMedia: client.itemMedia },
      );
      dispatch({ type: 'saved', id: rowId, itemId: item.id });
      // Valorisations sérialisées, sans bloquer la suite du classement.
      void valuations
        .push(() => client.edge.valuate(domain, itemToCandidate(item), item.id))
        .then((outcome) => {
          if (outcome === 'ok') void queryClient.invalidateQueries({ queryKey: ['valuations', item.id] });
        });
      return { ok: true, unattached: countUnattached(paths) };
    } catch (error) {
      dispatch({ type: 'saveFailed', id: rowId, errorCode: velumErrorCode(error) ?? 'generic' });
      return { ok: false };
    } finally {
      savingIds.current.delete(rowId);
    }
  };

  /**
   * Objets enregistrés sans leur photo (téléversement en échec) : signalé,
   * jamais en silence — sauf en mode démo, qui ne conserve aucune photo.
   */
  const warnUnattached = (objects: number) => {
    if (objects > 0 && !isDemoMode()) showToast(t('batch.photoNotAttached', { count: objects }), 'info');
  };

  const saveOne = async (rowId: string) => {
    const outcome = await saveRow(rowId);
    if (!outcome.ok) return;
    void queryClient.invalidateQueries({ queryKey: ['items'] });
    warnUnattached(outcome.unattached > 0 ? 1 : 0);
  };

  const saveAll = async () => {
    if (savingAll !== null) return;
    const ids = rowsForSaveAll(stateRef.current, editingRef.current).map((row) => row.id);
    if (ids.length === 0) return;
    setSavingAll({ done: 0, total: ids.length });
    let saved = 0;
    let withoutPhoto = 0;
    for (const [index, id] of ids.entries()) {
      // Correction ouverte entre-temps sur cette ligne : elle attend la validation.
      if (id !== editingRef.current) {
        const outcome = await saveRow(id);
        if (outcome.ok) {
          saved += 1;
          if (outcome.unattached > 0) withoutPhoto += 1;
        }
      }
      setSavingAll({ done: index + 1, total: ids.length });
    }
    setSavingAll(null);
    void queryClient.invalidateQueries({ queryKey: ['items'] });
    showToast(t('batch.savedToast', { count: saved }), saved > 0 ? 'success' : 'info');
    warnUnattached(withoutPhoto);
  };

  const submitEdit = (rowId: string, draft: CorrectionDraft) => {
    // État COURANT de la ligne : elle a pu être enregistrée ou ignorée entre-temps.
    const row = stateRef.current.rows.find((r) => r.id === rowId);
    if (!row || !isRecognizedRow(row)) {
      setEditingId(null);
      showToast(t('batch.editLost'), 'danger');
      return;
    }
    const base: Candidate = effectiveCandidate(row) ?? {
      id: `${row.id}-manual`,
      domain,
      label: '',
      confidence: 0.3,
      attributes: {},
    };
    const { candidate } = correctCandidate({
      candidate: base,
      domain,
      values: draft.values,
      label: draft.label,
      now: new Date(),
    });
    dispatch({ type: 'edit', id: row.id, candidate });
    setEditingId(null);
  };

  const errorText = (code: string | undefined): string | undefined => {
    if (code === undefined) return undefined;
    if (code === 'NO_DETECTION') return t('batch.errors.noDetection');
    if (code === 'SHEET_INCOMPLETE') return t('batch.errors.sheetIncomplete');
    return KNOWN_ERROR_CODES.has(code) ? t(`errors.${code}`) : t('errors.generic');
  };

  const summary = batchSummary(state);
  const rows = displayOrder(state);
  const sheet = subMode === 'sheet';
  const tips = sheet ? t(`batch.sheetTips.${domain}`) : t(`capture.tips.${domain}`);

  return (
    <Screen title={t('batch.title', { domain: t(`domains.${domain}.name`) })} onBack={goBack}>
      {/* iOS : le balayage depuis le bord retirerait l'écran sans passer par la
          confirmation — désactivé tant qu'il reste des lignes non enregistrées. */}
      <Stack.Screen options={{ gestureEnabled: !hasUnsaved }} />
      <Modal visible={confirmLeave} transparent animationType="fade" onRequestClose={stay}>
        <View style={styles.backdrop}>
          <VCard tone="gilded" style={styles.dialog}>
            <VText variant="body" accessibilityRole="alert">
              {t('batch.leaveTitle', { count: pendingCount })}
            </VText>
            <View style={styles.row}>
              <View style={styles.cell}>
                <VButton label={t('batch.stay')} onPress={stay} />
              </View>
              <View style={styles.cell}>
                <VButton label={t('batch.leaveConfirm')} variant="ghost" onPress={leaveAnyway} />
              </View>
            </View>
          </VCard>
        </View>
      </Modal>

      {sheetAvailable ? (
        <SegmentedChoice
          accessibilityLabel={t('batch.modesLabel')}
          value={subMode}
          onChange={setSubMode}
          options={[
            { value: 'sheet', label: t('batch.modeSheet'), hint: t('batch.modeSheetHint') },
            { value: 'series', label: t('batch.modeSeries'), hint: t('batch.modeSeriesHint') },
          ]}
        />
      ) : null}
      <VText variant="caption" tone="dim" style={styles.hint}>
        {sheet ? t('batch.modeSheetHint') : t('batch.modeSeriesHint')}
      </VText>

      {aiConsent === false ? (
        <VText variant="body" tone="dim" style={styles.block}>
          {t('aiConsent.declinedBanner')}
        </VText>
      ) : null}

      {quotaBlocked ? (
        <VCard style={styles.block}>
          <VText variant="body" tone="danger" accessibilityLiveRegion="polite">
            {t('batch.quotaBlocked')}
          </VText>
          <VButton label={t('batch.seeOffers')} variant="secondary" onPress={() => router.push(routes.paywall())} />
        </VCard>
      ) : null}

      {aiConsent !== false ? (
        <View style={styles.block}>
          <ShutterCamera
            onCapture={onShot}
            quality={sheet ? SHEET_JPEG_QUALITY : QUICK_JPEG_QUALITY}
            maxEdge={sheet ? SHEET_MAX_EDGE : QUICK_MAX_EDGE}
            limitNativeResolution={sheet}
            height={sheet ? 280 : 220}
            shutterLabel={sheet ? t('batch.shootSheet') : t('batch.shoot')}
            galleryLabel={t('batch.importGallery')}
            multipleGallery
            disabled={quotaBlocked}
            guide={
              <VText variant="caption" tone="dim" center>
                {tips}
              </VText>
            }
          />
        </View>
      ) : null}

      {state.rows.length > 0 ? (
        <VCard style={styles.block}>
          <VText variant="body" accessibilityLiveRegion="polite">
            {t('batch.summary', {
              total: summary.total,
              identified: summary.identified,
              uncertain: summary.uncertain,
              failed: summary.failed,
              saved: summary.saved,
            })}
          </VText>
          {summary.waiting > 0 ? (
            <VText variant="caption" tone="gold">
              {t('batch.waiting', { count: summary.waiting })}
            </VText>
          ) : null}
          {summary.indicativeTotal ? (
            <VText variant="caption" tone="dim">
              {summary.pricedCount < summary.pricedOf
                ? // Total PARTIEL : jamais présenté comme la valeur de toute la série.
                  t('batch.indicativeTotalPartial', {
                    range: formatEstimateRange(summary.indicativeTotal, i18n.language),
                    priced: summary.pricedCount,
                    total: summary.pricedOf,
                  })
                : t('batch.indicativeTotal', {
                    range: formatEstimateRange(summary.indicativeTotal, i18n.language),
                  })}
            </VText>
          ) : null}
          <VButton
            label={
              savingAll
                ? t('batch.savingAll', { done: savingAll.done, total: savingAll.total })
                : t('batch.saveAll', { count: summary.reliable })
            }
            accessibilityHint={t('batch.saveAllHint', { percent: Math.round(RELIABLE_CONFIDENCE * 100) })}
            onPress={() => void saveAll()}
            loading={savingAll !== null}
            disabled={summary.reliable === 0}
          />
          {summary.saved > 0 ? (
            <VButton label={t('batch.toCollection')} variant="ghost" onPress={() => router.push(routes.collection())} />
          ) : null}
        </VCard>
      ) : null}

      {state.truncatedSheets.length > 0 ? (
        <VText variant="body" tone="gold" style={styles.block}>
          {t('batch.truncated')}
        </VText>
      ) : null}

      {state.rows.length === 0 ? (
        <VEmptyState title={t('batch.empty')} message={t('batch.emptyMessage')} />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <BatchRowCard
              key={row.id}
              row={row}
              domain={domain}
              number={row.seq + 1}
              editing={editingId === row.id}
              errorText={errorText(row.errorCode)}
              onSave={() => void saveOne(row.id)}
              onEdit={() => setEditingId(row.id)}
              onCancelEdit={() => setEditingId(null)}
              onSubmitEdit={(draft) => submitEdit(row.id, draft)}
              onChoose={(index) => dispatch({ type: 'choose', id: row.id, index })}
              onSkip={() => dispatch({ type: 'skip', id: row.id })}
              onRestore={() => dispatch({ type: 'restore', id: row.id })}
              onRetry={() => {
                setQuotaBlocked(false);
                dispatch({ type: 'retry', id: row.id });
              }}
              onRemove={() => dispatch({ type: 'remove', id: row.id })}
              onOpen={() => {
                if (row.itemId) router.push(routes.item(row.itemId));
              }}
            />
          ))}
        </View>
      )}

      <AiConsentModal
        visible={aiConsent === null}
        onAccept={() => setAiConsent(true)}
        onDecline={() => setAiConsent(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: velumSpacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dialog: { gap: velumSpacing.md },
  hint: { marginTop: velumSpacing.xs },
  block: { marginTop: velumSpacing.md, gap: velumSpacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm },
  cell: { flexGrow: 1, flexBasis: 140 },
  list: { marginTop: velumSpacing.md, gap: velumSpacing.md },
});
