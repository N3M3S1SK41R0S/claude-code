/**
 * Capture d'un objet, en deux modes :
 *  - « Scan éclair » (défaut) : UNE photo, l'identification démarre aussitôt
 *    (identification + classement + fourchette indicative en un appel) ;
 *  - « Saisie complète » : tous les clichés du domaine (guides de cadrage par
 *    rôle), texte libre ou import CSV/JSON, puis « Analyser ».
 * Le téléversement de chaque photo démarre dès la prise de vue ; la
 * reconnaissance ne l'attend pas (voir lib/batchCapture.ts).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VText, VTextInput, velumSpacing } from '@velum/ui';
import type { CaptureInput, MediaRole, VelumDomain } from '@velum/core';

import { AiConsentModal } from '../../components/AiConsentModal';
import { MediaCapturePreview } from '../../components/MediaCapturePreview';
import { Screen } from '../../components/Screen';
import { SegmentedChoice } from '../../components/capture/SegmentedChoice';
import { ShutterCamera, type CapturedShot } from '../../components/capture/ShutterCamera';
import {
  PRIMARY_ROLE,
  QUICK_JPEG_QUALITY,
  QUICK_MAX_EDGE,
  mediaForRecognition,
  startStopwatch,
} from '../../lib/batchCapture';
import { getVelumClient } from '../../lib/client';
import { errorMessage, velumErrorCode } from '../../lib/errors';
import { routes } from '../../lib/routes';
import { captureUploads } from '../../lib/uploadMedia';
import { useCaptureStore, type CaptureMode, type DraftMedia } from '../../stores/captureStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { showToast } from '../../stores/toastStore';

/** Guides de cadrage : rôles de clichés attendus par domaine (§6.1.2), saisie complète. */
const DOMAIN_ROLES: Record<VelumDomain, MediaRole[]> = {
  wine: ['label', 'capsule'],
  coin: ['obverse', 'reverse', 'edge'],
  art: ['front', 'signature', 'back'],
  stamp: ['front', 'back'],
  watch: ['dial', 'caseback', 'clasp'],
};

const DOMAINS: VelumDomain[] = ['wine', 'coin', 'art', 'stamp', 'watch'];

/** Qualité JPEG de la saisie complète (plusieurs clichés détaillés). */
const FULL_JPEG_QUALITY = 0.7;
const FULL_MAX_EDGE = 2000;

type Tab = 'photo' | 'text' | 'file';

/** Parse minimal CSV : première ligne = en-têtes, séparateur virgule. */
function parseCsv(content: string): Record<string, unknown>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headerLine = lines[0];
  if (!headerLine) return [];
  const headers = headerLine.split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      row[header] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

function parseRows(content: string, name: string): Record<string, unknown>[] {
  if (name.toLowerCase().endsWith('.json')) {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error('JSON : tableau attendu');
    return parsed.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
  }
  return parseCsv(content);
}

export default function CaptureModal() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ domain: string; mode?: string }>();
  const domain: VelumDomain = DOMAINS.includes(params.domain as VelumDomain)
    ? (params.domain as VelumDomain)
    : 'wine';
  const mode: CaptureMode = params.mode === 'full' ? 'full' : 'quick';

  const roles = mode === 'full' ? DOMAIN_ROLES[domain] : [PRIMARY_ROLE[domain]];
  const [tab, setTab] = useState<Tab>('photo');
  const [submitting, setSubmitting] = useState(false);
  // Consentement IA : photo et texte partent au LLM ; l'import fichier est
  // un mapping local (kind 'file' ne passe pas par deps.vision) → non gated.
  const aiConsent = useSettingsStore((s) => s.aiConsent);
  const setAiConsent = useSettingsStore((s) => s.setAiConsent);
  const consentNeeded = (tab === 'photo' || tab === 'text') && aiConsent === null;
  const consentDenied = (tab === 'photo' || tab === 'text') && aiConsent === false;
  const [activeRole, setActiveRole] = useState<MediaRole>(roles[0] ?? 'detail');

  const storeDomain = useCaptureStore((s) => s.domain);
  const media = useCaptureStore((s) => s.media);
  const text = useCaptureStore((s) => s.text);
  const fileRows = useCaptureStore((s) => s.fileRows);
  const fileName = useCaptureStore((s) => s.fileName);
  const setDomain = useCaptureStore((s) => s.setDomain);
  const setMode = useCaptureStore((s) => s.setMode);
  const addMedia = useCaptureStore((s) => s.addMedia);
  const setMediaStoragePath = useCaptureStore((s) => s.setMediaStoragePath);
  const setText = useCaptureStore((s) => s.setText);
  const setFileRows = useCaptureStore((s) => s.setFileRows);
  const setRecognition = useCaptureStore((s) => s.setRecognition);

  // Lien direct (/capture/stamp?mode=full) : le brouillon suit l'URL.
  useEffect(() => {
    if (storeDomain !== domain) setDomain(domain);
  }, [storeDomain, domain, setDomain]);
  useEffect(() => {
    setMode(mode);
    const modeRoles = mode === 'full' ? DOMAIN_ROLES[domain] : [PRIMARY_ROLE[domain]];
    setActiveRole((current) => (modeRoles.includes(current) ? current : (modeRoles[0] ?? 'detail')));
  }, [mode, domain, setMode]);

  const recognizeMutation = useMutation({
    mutationFn: (input: CaptureInput) => getVelumClient().edge.recognize(domain, input),
  });
  const pending = submitting || recognizeMutation.isPending;

  const identify = async (shots: DraftMedia[], currentTab: Tab) => {
    if (pending) return;
    if ((currentTab === 'photo' || currentTab === 'text') && aiConsent !== true) {
      showToast(t('aiConsent.declinedBanner'), 'info');
      return;
    }
    if (
      (currentTab === 'photo' && shots.length === 0) ||
      (currentTab === 'text' && text.trim().length === 0) ||
      (currentTab === 'file' && fileRows.length === 0)
    ) {
      showToast(t('capture.noInput'), 'info');
      return;
    }

    setSubmitting(true);
    const watch = startStopwatch(() => Date.now());
    try {
      const input: CaptureInput =
        currentTab === 'photo'
          ? // Photo déjà téléversée → chemin ; téléversement en cours → base64, sans attendre.
            { kind: 'photo', media: mediaForRecognition(shots, captureUploads) }
          : currentTab === 'text'
            ? { kind: 'text', text: text.trim() }
            : { kind: 'file', fileRows };
      const result = await recognizeMutation.mutateAsync(input);
      setRecognition(result, watch.elapsed());
      router.push(routes.candidates());
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
      if (velumErrorCode(error) === 'BUDGET_EXCEEDED') router.push(routes.paywall());
    } finally {
      setSubmitting(false);
    }
  };

  /** Cliché accepté : téléversement immédiat ; en scan éclair, identification aussitôt. */
  const acceptShot = (shot: CapturedShot) => {
    if (pending) return;
    const draft: DraftMedia = { role: activeRole, base64: shot.dataUrl, uri: shot.uri };
    addMedia(draft);
    void captureUploads.start(shot.dataUrl).then((path) => {
      if (path) setMediaStoragePath(draft.role, draft.base64, path);
    });
    if (mode === 'quick') {
      void identify(useCaptureStore.getState().media, 'photo');
      return;
    }
    const current = useCaptureStore.getState().media;
    const remaining = roles.find((role) => role !== activeRole && !current.some((m) => m.role === role));
    if (remaining) setActiveRole(remaining);
  };

  const pickFile = async () => {
    if (pending) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset || pending) return;
      const content = await FileSystem.readAsStringAsync(asset.uri);
      const rows = parseRows(content, asset.name);
      setFileRows(rows, asset.name);
      showToast(t('capture.filePicked', { count: rows.length, name: asset.name }), 'success');
    } catch {
      showToast(t('capture.fileParseError'), 'danger');
    }
  };

  const switchMode = (next: CaptureMode) => {
    if (pending) return;
    router.setParams({ mode: next });
  };

  const guide = (
    <>
      <VText variant="caption" tone="gold" center>
        {t('capture.guideTitle', { role: t(`roles.${activeRole}`) })}
      </VText>
      <VText variant="caption" tone="dim" center>
        {t(`capture.tips.${domain}`)}
      </VText>
    </>
  );

  const renderPhotoTab = () => (
    <ShutterCamera
      onCapture={acceptShot}
      quality={mode === 'quick' ? QUICK_JPEG_QUALITY : FULL_JPEG_QUALITY}
      maxEdge={mode === 'quick' ? QUICK_MAX_EDGE : FULL_MAX_EDGE}
      shutterLabel={mode === 'quick' ? t('capture.shootAndIdentify') : t('capture.takePhoto')}
      galleryLabel={t('capture.fromGallery')}
      guide={guide}
      disabled={pending}
      belowViewfinder={
        mode === 'full' ? (
          <>
            <MediaCapturePreview
              roles={roles}
              media={media}
              activeRole={activeRole}
              roleLabel={(role) => t(`roles.${role}`)}
              onSelectRole={(role) => {
                if (!pending) setActiveRole(role);
              }}
            />
            <VText variant="caption" tone="dim" center>
              {t('capture.photosCount', { done: media.length, total: roles.length })}
            </VText>
          </>
        ) : (
          <VText variant="caption" tone="dim" center>
            {t('capture.quickShotHint')}
          </VText>
        )
      }
    />
  );

  return (
    <Screen title={t(`domains.${domain}.name`)}>
      <SegmentedChoice
        accessibilityLabel={t('capture.modesLabel')}
        value={mode}
        onChange={switchMode}
        disabled={pending}
        options={[
          { value: 'quick', label: t('capture.modeQuick'), hint: t('capture.modeQuickHint') },
          { value: 'full', label: t('capture.modeFull'), hint: t('capture.modeFullHint') },
        ]}
      />
      <VText variant="caption" tone="dim" style={styles.modeHint}>
        {mode === 'quick' ? t('capture.modeQuickHint') : t('capture.modeFullHint')}
      </VText>

      <View style={styles.tabs}>
        <SegmentedChoice
          accessibilityLabel={t('capture.inputLabel')}
          value={tab}
          onChange={(next) => {
            if (!pending) setTab(next);
          }}
          disabled={pending}
          options={[
            { value: 'photo', label: t('capture.tabPhoto') },
            { value: 'text', label: t('capture.tabText') },
            { value: 'file', label: t('capture.tabFile') },
          ]}
        />
      </View>

      {consentDenied ? (
        <View style={styles.block} pointerEvents={pending ? 'none' : 'auto'}>
          <VText variant="body" tone="dim" center>
            {t('aiConsent.declinedBanner')}
          </VText>
          <VButton label={t('capture.tabFile')} variant="secondary" onPress={() => setTab('file')} />
        </View>
      ) : null}

      {pending ? (
        <View style={styles.identifying} accessibilityLiveRegion="polite">
          <VText variant="body" tone="gold" center>
            {t('capture.identifying')}
          </VText>
        </View>
      ) : null}

      {tab === 'photo' && !consentDenied ? renderPhotoTab() : null}

      {tab === 'text' && !consentDenied ? (
        <View style={styles.block} pointerEvents={pending ? 'none' : 'auto'}>
          <VTextInput
            label={t('capture.textLabel')}
            value={text}
            onChangeText={setText}
            placeholder={t('capture.textPlaceholder')}
          />
        </View>
      ) : null}

      {tab === 'file' ? (
        <View style={styles.block} pointerEvents={pending ? 'none' : 'auto'}>
          <VText variant="body" tone="dim">
            {t('capture.fileHint')}
          </VText>
          <VButton label={t('capture.pickFile')} variant="secondary" onPress={() => void pickFile()} />
          {fileName !== null ? (
            <VText variant="caption" tone="gold">
              {t('capture.filePicked', { count: fileRows.length, name: fileName })}
            </VText>
          ) : null}
        </View>
      ) : null}

      {/* En scan éclair photo, la prise de vue lance l'identification : pas de bouton en plus. */}
      {mode === 'full' || tab !== 'photo' ? (
        <View style={styles.analyze}>
          <VButton
            label={pending ? t('capture.analyzing') : t('capture.analyze')}
            onPress={() => void identify(media, tab)}
            loading={pending}
          />
        </View>
      ) : null}

      <View style={styles.more}>
        <VButton
          label={t('capture.modeBatch')}
          accessibilityHint={t('capture.modeBatchHint')}
          variant="ghost"
          onPress={() => {
            if (!pending) router.push(routes.captureBatch(domain));
          }}
        />
      </View>

      <AiConsentModal
        visible={consentNeeded}
        onAccept={() => setAiConsent(true)}
        onDecline={() => setAiConsent(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeHint: { marginTop: velumSpacing.xs },
  tabs: { marginTop: velumSpacing.md, marginBottom: velumSpacing.md },
  identifying: { paddingVertical: velumSpacing.sm },
  block: { gap: velumSpacing.md, paddingVertical: velumSpacing.md },
  analyze: { marginTop: velumSpacing.lg, gap: velumSpacing.sm },
  more: { marginTop: velumSpacing.md },
});
