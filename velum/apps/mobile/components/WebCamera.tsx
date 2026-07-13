/**
 * Stub natif : sur iOS/Android c'est `CameraView` (expo-camera) qui est utilisé,
 * jamais ce composant. Metro substitue `WebCamera.web.tsx` sur le web.
 * Ce fichier n'existe que pour satisfaire la résolution de module et tsc.
 */
import type { ReactNode } from 'react';

export interface WebCameraProps {
  onCapture: (dataUrl: string) => void;
  guide?: ReactNode;
  labels: {
    takePhoto: string;
    starting: string;
    denied: string;
    useNativeCamera: string;
  };
}

export function WebCamera(_props: WebCameraProps): ReactNode {
  return null;
}
