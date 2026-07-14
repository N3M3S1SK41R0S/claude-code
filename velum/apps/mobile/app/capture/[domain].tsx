/**
 * Modal de capture par domaine : caméra avec guides de cadrage multi-clichés
 * (rôles MediaRole propres au domaine), import galerie, saisie texte libre,
 * import de fichier CSV/JSON. Les photos sont téléversées avant `recognize` et
 * leurs chemins restent dans le brouillon jusqu'à la création de l'objet.
 */
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VText, VTextInput, velumColors, velumSpacing } from '@velum/ui';
import type { CaptureInput, MediaRole, VelumDomain } from '@velum/core';

import { AiConsentModal } from '../../components/AiConsentModal';
import { MediaCapturePreview } from '../../components/MediaCapturePreview';
import { Screen } from '../../components/Screen';
import { WebCamera } from '../../components/WebCamera';
import { getVelumClient } from '../../lib/client';
import { errorMessage, velumErrorCode } from '../../lib/errors';
import { uploadCaptureMedia } from '../../lib/uploadMedia';
import { useCaptureStore } from '../../stores/captureStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { showToast } from '../../stores/toastStore';

/** Guides de cadrage : rôles de clichés attendus par domaine (§6.1.2). */
const DOMAIN_ROLES: Record<VelumDomain, MediaRole[]> = {
  wine: ['label', 'capsule'],
  coin: ['obverse', 'reverse', 'edge'],
  art: ['front', 'signature', 'back'],
  stamp: ['front', 'back'],
};

const DOMAINS: VelumDomain[] = ['wine', 'coin', 'art', 'stamp'];

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
  const params = useLocalSearchParams<{ domain: string }>();
  const domain: VelumDomain = DOMAINS.includes(params.domain as VelumDomain)
    ? (params.domain as VelumDomain)
    : 'wine';

  const roles = DOMAIN_ROLES[domain];
  const [tab, setTab] = useState<Tab>('photo');
  const [submitting, setSubmitting] = useState(false);
  // Consentement IA : photo et texte partent au LLM ; l'import fichier est
  // un mapping local (kind 'file' ne passe pas par deps.vision) → non gated.
  const aiConsent = useSettingsStore((s) => s.aiConsent);
  const setAiConsent = useSettingsStore((s) => s.setAiConsent);
  const consentNeeded = (tab === 'photo' || tab === 'text') && aiConsent === null;
  const consentDenied = (tab === 'photo' || tab === 'text') && aiConsent === false;
  const [activeRole, setActiveRole] = useState<MediaRole>(roles[0] ?? 'detail');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const media = useCaptureStore((s) => s.media);
  const text = useCaptureStore((s) => s.text);
  const fileRows = useCaptureStore((s) => s.fileRows);
  const fileName = useCaptureStore((s) => s.fileName);
  const addMedia = useCaptureStore((s) => s.addMedia);
  const setMediaStoragePath = useCaptureStore((s) => s.setMediaStoragePath);
  const setText = useCaptureStore((s) => s.setText);
  const setFileRows = useCaptureStore((s) => s.setFileRows);
  const setRecognition = useCaptureStore((s) => s.setRecognition);

  const recognizeMutation = useMutation({
    mutationFn: (input: CaptureInput) => getVelumClient().edge.recognize(domain, input),
  });
  const pending = submitting || recognizeMutation.isPending;

  /** Ajoute un cliché et avance vers le rôle suivant restant (multi-clichés). */
  const acceptShot = (dataUrl: string) => {
    addMedia({ role: activeRole, base64: dataUrl, uri: dataUrl });
    const remaining = roles.find(
      (role) => role !== activeRole && !media.some((m) => m.role === role),
    );
    if (remaining) setActiveRole(remaining);
  };

  const takePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) return;
      acceptShot(`data:image/jpeg;base64,${photo.base64}`);
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.7,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.base64) return;
      addMedia({
        role: activeRole,
        base64: `data:image/jpeg;base64,${asset.base64}`,
        uri: asset.uri,
      });
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const content = await FileSystem.readAsStringAsync(asset.uri);
      const rows = parseRows(content, asset.name);
      setFileRows(rows, asset.name);
      showToast(t('capture.filePicked', { count: rows.length, name: asset.name }), 'success');
    } catch {
      showToast(t('capture.fileParseError'), 'danger');
    }
  };

  const analyze = async () => {
    if (pending) return;
    if ((tab === 'photo' || tab === 'text') && aiConsent !== true) {
      showToast(t('aiConsent.declinedBanner'), 'info');
      return;
    }
    if (
      (tab === 'photo' && media.length === 0) ||
      (tab === 'text' && text.trim().length === 0) ||
      (tab === 'file' && fileRows.length === 0)
    ) {
      showToast(t('capture.noInput'), 'info');
      return;
    }

    setSubmitting(true);
    try {
      let input: CaptureInput;
      if (tab === 'photo') {
        // Un chemin déjà téléversé est réutilisé après une erreur de reconnaissance :
        // aucun doublon Storage n'est créé lors d'une nouvelle tentative.
        const uploaded = await Promise.all(
          media.map(async (entry) => {
            const path = entry.storagePath ?? (await uploadCaptureMedia(entry.base64));
            if (path !== null && entry.storagePath !== path) {
              setMediaStoragePath(entry.role, path);
            }
            return { media: entry, path };
          }),
        );
        input = {
          kind: 'photo',
          media: uploaded.map(({ media: entry, path }) =>
            path === null
              ? { role: entry.role, storagePath: '', base64: entry.base64 }
              : { role: entry.role, storagePath: path },
          ),
        };
      } else if (tab === 'text') {
        input = { kind: 'text', text: text.trim() };
      } else {
        input = { kind: 'file', fileRows };
      }

      const result = await recognizeMutation.mutateAsync(input);
      setRecognition(result);
      router.push('/capture/candidates');
    } catch (error) {
      if (velumErrorCode(error) === 'BUDGET_EXCEEDED') {
        showToast(errorMessage(error, t), 'danger');
        router.push('/paywall');
      } else {
        showToast(errorMessage(error, t), 'danger');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderPhotoTab = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.cameraBlock}>
          <WebCamera
            onCapture={acceptShot}
            labels={{
              takePhoto: t('capture.takePhoto'),
              starting: t('capture.cameraStarting'),
              denied: t('capture.cameraDeniedWeb'),
              useNativeCamera: t('capture.useNativeCamera'),
            }}
            guide={
              <>
                <VText variant="caption" tone="gold" center>
                  {t('capture.guideTitle', { role: t(`roles.${activeRole}`) })}
                </VText>
                <VText variant="caption" tone="dim" center>
                  {t('capture.guideHint')}
                </VText>
              </>
            }
          />
          <MediaCapturePreview
            roles={roles}
            media={media}
            activeRole={activeRole}
            roleLabel={(role) => t(`roles.${role}`)}
            onSelectRole={setActiveRole}
          />
          <VText variant="caption" tone="dim" center>
            {t('capture.photosCount', { done: media.length, total: roles.length })}
          </VText>
          <VButton
            label={t('capture.fromGallery')}
            variant="ghost"
            onPress={() => void pickFromGallery()}
          />
        </View>
      );
    }
    if (!permission?.granted) {
      return (
        <View style={styles.cameraFallback}>
          <VText variant="heading" center>
            {t('capture.cameraPermissionTitle')}
          </VText>
          <VText variant="body" tone="dim" center>
            {t('capture.cameraPermissionMessage')}
          </VText>
          <VButton label={t('capture.cameraPermissionButton')} onPress={() => void requestPermission()} />
          <VButton label={t('capture.fromGallery')} variant="secondary" onPress={() => void pickFromGallery()} />
        </View>
      );
    }
    return (
      <View style={styles.cameraBlock}>
        <View style={styles.cameraFrame}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View pointerEvents="none" style={styles.guide}>
            <VText variant="caption" tone="gold" center>
              {t('capture.guideTitle', { role: t(`roles.${activeRole}`) })}
            </VText>
            <VText variant="caption" tone="dim" center>
              {t('capture.guideHint')}
            </VText>
          </View>
        </View>
        <MediaCapturePreview
          roles={roles}
          media={media}
          activeRole={activeRole}
          roleLabel={(role) => t(`roles.${role}`)}
          onSelectRole={setActiveRole}
        />
        <VText variant="caption" tone="dim" center>
          {t('capture.photosCount', { done: media.length, total: roles.length })}
        </VText>
        <View style={styles.actions}>
          <VButton label={t('capture.takePhoto')} onPress={() => void takePhoto()} />
          <VButton label={t('capture.fromGallery')} variant="ghost" onPress={() => void pickFromGallery()} />
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <VText variant="title">{t(`domains.${domain}.name`)}</VText>
      <VText variant="caption" tone="dim">
        {t(`domains.${domain}.subtitle`)}
      </VText>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['photo', 'text', 'file'] as Tab[]).map((tabId) => (
          <Pressable
            key={tabId}
            onPress={() => setTab(tabId)}
            accessibilityRole="tab"
            accessibilityLabel={t(`capture.tab${tabId.charAt(0).toUpperCase()}${tabId.slice(1)}`)}
            accessibilityState={{ selected: tab === tabId }}
            style={[styles.tab, tab === tabId && styles.tabActive]}
          >
            <VText variant="body" tone={tab === tabId ? 'gold' : 'dim'} center>
              {t(`capture.tab${tabId.charAt(0).toUpperCase()}${tabId.slice(1)}`)}
            </VText>
          </Pressable>
        ))}
      </View>

      {consentDenied ? (
        <View style={styles.block}>
          <VText variant="body" tone="dim" center>
            {t('aiConsent.declinedBanner')}
          </VText>
          <VButton label={t('capture.tabFile')} variant="secondary" onPress={() => setTab('file')} />
        </View>
      ) : null}

      {tab === 'photo' && !consentDenied ? renderPhotoTab() : null}

      {tab === 'text' && !consentDenied ? (
        <View style={styles.block}>
          <VTextInput
            label={t('capture.textLabel')}
            value={text}
            onChangeText={setText}
            placeholder={t('capture.textPlaceholder')}
          />
        </View>
      ) : null}

      {tab === 'file' ? (
        <View style={styles.block}>
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

      <View style={styles.analyze}>
        <VButton
          label={pending ? t('capture.analyzing') : t('capture.analyze')}
          onPress={() => void analyze()}
          loading={pending}
        />
        <VButton label={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
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
  tabs: {
    flexDirection: 'row',
    marginTop: velumSpacing.lg,
    marginBottom: velumSpacing.md,
    borderRadius: 12,
    backgroundColor: velumColors.ink.raised,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: velumSpacing.sm,
    borderRadius: 9,
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: velumColors.ink.soft, borderWidth: 1, borderColor: velumColors.gold.faint },
  cameraBlock: { gap: velumSpacing.sm },
  cameraFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: velumColors.ink.border,
  },
  camera: { height: 320 },
  guide: {
    position: 'absolute',
    bottom: velumSpacing.sm,
    left: velumSpacing.sm,
    right: velumSpacing.sm,
    backgroundColor: 'rgba(20, 9, 11, 0.75)',
    borderRadius: 8,
    padding: velumSpacing.sm,
  },
  cameraFallback: { gap: velumSpacing.md, paddingVertical: velumSpacing.xl },
  actions: { gap: velumSpacing.sm },
  block: { gap: velumSpacing.md, paddingVertical: velumSpacing.md },
  analyze: { marginTop: velumSpacing.xl, gap: velumSpacing.sm },
});
