/**
 * Viseur + déclencheur + import galerie, natif (expo-camera) ou web
 * (WebCamera), avec la qualité d'image du mode (scan éclair léger, planche
 * détaillée). Gère la permission caméra et ses refus sans bloquer : la
 * galerie reste toujours disponible.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { VButton, VText, velumColors, velumSpacing } from '@velum/ui';

import { pictureSizeWithin } from '../../lib/batchCapture';
import { errorMessage } from '../../lib/errors';
import { showToast } from '../../stores/toastStore';
import { WebCamera } from '../WebCamera';

/** Photos importées d'un coup depuis la galerie (mode série). */
const MAX_GALLERY_SELECTION = 12;

export interface CapturedShot {
  /** Data URL JPEG (envoyée à la reconnaissance, clé du téléversement). */
  dataUrl: string;
  /** URI d'aperçu. */
  uri: string;
}

export interface ShutterCameraProps {
  onCapture: (shot: CapturedShot) => void;
  /** Qualité JPEG 0..1. */
  quality: number;
  /**
   * Grand côté maximal. Web : toujours appliqué. Natif : seulement avec
   * `limitNativeResolution` (sinon résolution du capteur).
   */
  maxEdge: number;
  /**
   * Plafonne aussi la résolution NATIVE à `maxEdge` (taille de capteur la plus
   * proche). Pour la planche : photo dense à qualité élevée, qui dépasserait
   * sinon la limite de poids par image du fournisseur.
   */
  limitNativeResolution?: boolean;
  shutterLabel: string;
  galleryLabel: string;
  /** Galerie à sélection multiple (mode série). */
  multipleGallery?: boolean;
  height?: number;
  /** Surimpression de cadrage. */
  guide?: ReactNode;
  /** Contenu entre le viseur et les boutons (vignettes par rôle…). */
  belowViewfinder?: ReactNode;
  disabled?: boolean;
}

export function ShutterCamera({
  onCapture,
  quality,
  maxEdge,
  shutterLabel,
  galleryLabel,
  multipleGallery = false,
  height = 320,
  guide,
  belowViewfinder,
  disabled = false,
  limitNativeResolution = false,
}: ShutterCameraProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  // Prise en cours : un double appui pendant takePictureAsync (200 à 800 ms)
  // ne lance pas une seconde capture — donc pas une seconde identification.
  const capturing = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!cameraReady || !limitNativeResolution) {
      setPictureSize(undefined);
      return;
    }
    let cancelled = false;
    cameraRef.current
      ?.getAvailablePictureSizesAsync()
      .then((sizes) => {
        if (!cancelled) setPictureSize(pictureSizeWithin(sizes, maxEdge));
      })
      .catch(() => {
        // Tailles indisponibles : résolution par défaut (le serveur borne le poids).
      });
    return () => {
      cancelled = true;
    };
  }, [cameraReady, limitNativeResolution, maxEdge]);

  const takePhoto = async () => {
    if (disabled || capturing.current) return;
    capturing.current = true;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality });
      if (!photo?.base64) return;
      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      onCapture({ dataUrl, uri: photo.uri || dataUrl });
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    } finally {
      capturing.current = false;
    }
  };

  const pickFromGallery = async () => {
    if (disabled) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality,
        allowsMultipleSelection: multipleGallery,
        // Borne mémoire : chaque photo est gardée en base64 jusqu'à son identification.
        ...(multipleGallery ? { selectionLimit: MAX_GALLERY_SELECTION } : {}),
      });
      if (result.canceled) return;
      for (const asset of result.assets ?? []) {
        if (!asset.base64) continue;
        const dataUrl = asset.base64.startsWith('data:')
          ? asset.base64
          : `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
        onCapture({ dataUrl, uri: asset.uri || dataUrl });
      }
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  const gallery = (
    <VButton label={galleryLabel} variant="ghost" onPress={() => void pickFromGallery()} disabled={disabled} />
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.block} pointerEvents={disabled ? 'none' : 'auto'}>
        <WebCamera
          onCapture={(dataUrl) => onCapture({ dataUrl, uri: dataUrl })}
          maxEdge={maxEdge}
          quality={quality}
          height={height}
          labels={{
            takePhoto: shutterLabel,
            starting: t('capture.cameraStarting'),
            denied: t('capture.cameraDeniedWeb'),
            useNativeCamera: t('capture.useNativeCamera'),
          }}
          guide={guide}
        />
        {belowViewfinder}
        {gallery}
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.fallback} pointerEvents={disabled ? 'none' : 'auto'}>
        <VText variant="heading" center>
          {t('capture.cameraPermissionTitle')}
        </VText>
        <VText variant="body" tone="dim" center>
          {t('capture.cameraPermissionMessage')}
        </VText>
        <VButton label={t('capture.cameraPermissionButton')} onPress={() => void requestPermission()} />
        {belowViewfinder}
        {gallery}
      </View>
    );
  }

  return (
    <View style={styles.block} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.frame}>
        <CameraView
          ref={cameraRef}
          style={{ height }}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
          {...(pictureSize !== undefined ? { pictureSize } : {})}
        />
        {guide ? (
          <View pointerEvents="none" style={styles.guide}>
            {guide}
          </View>
        ) : null}
      </View>
      {belowViewfinder}
      <VButton label={shutterLabel} onPress={() => void takePhoto()} disabled={disabled} />
      {gallery}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: velumSpacing.sm },
  fallback: { gap: velumSpacing.md, paddingVertical: velumSpacing.lg },
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: velumColors.ink.border,
  },
  guide: {
    position: 'absolute',
    bottom: velumSpacing.sm,
    left: velumSpacing.sm,
    right: velumSpacing.sm,
    backgroundColor: 'rgba(20, 9, 11, 0.75)',
    borderRadius: 8,
    padding: velumSpacing.sm,
  },
});
