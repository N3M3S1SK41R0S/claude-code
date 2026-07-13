/**
 * Caméra web (PWA iPhone incluse) — le pendant de `CameraView` côté navigateur.
 *
 * Deux chemins, du meilleur au plus robuste :
 *  1. `getUserMedia` → viseur live dans l'app + capture via <canvas>. Garde les
 *     guides de cadrage et l'enchaînement multi-clichés.
 *  2. Repli `<input type="file" capture="environment">` → ouvre l'appareil photo
 *     natif d'iOS. Fonctionne même si getUserMedia est refusé ou indisponible.
 *
 * Fichier `.web.tsx` : Metro le substitue automatiquement sur le web, la version
 * native (`WebCamera.tsx`) n'est jamais chargée ici et réciproquement.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface WebCameraProps {
  /** Reçoit une data-URL JPEG (`data:image/jpeg;base64,...`). */
  onCapture: (dataUrl: string) => void;
  /** Overlay de guidage affiché par-dessus le viseur. */
  guide?: ReactNode;
  labels: {
    takePhoto: string;
    starting: string;
    denied: string;
    useNativeCamera: string;
  };
}

/** Borne le grand côté : au-delà, l'image ne gagne rien en lisibilité et alourdit la requête. */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.7;

type Status = 'starting' | 'live' | 'unavailable';

export function WebCamera({ onCapture, guide, labels }: WebCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('starting');

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      // Contexte non sécurisé, navigateur ancien, ou API absente → repli direct.
      if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // caméra arrière
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // iOS exige `playsInline` (posé sur l'élément) + un play() explicite.
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus('live');
      } catch {
        // Permission refusée, aucune caméra, ou caméra déjà occupée.
        if (!cancelled) setStatus('unavailable');
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
  }, [onCapture]);

  /** Repli : l'appareil photo natif d'iOS, via un input fichier. */
  const onFallbackFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // permet de reprendre la même photo deux fois
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') onCapture(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [onCapture],
  );

  const nativeCameraInput = (
    <label style={styles.fallbackLabel}>
      {status === 'live' ? labels.useNativeCamera : labels.takePhoto}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFallbackFile}
        style={styles.hiddenInput}
      />
    </label>
  );

  if (status === 'unavailable') {
    return (
      <div style={styles.wrap}>
        <p style={styles.notice}>{labels.denied}</p>
        {nativeCameraInput}
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.frame}>
        <video ref={videoRef} playsInline muted autoPlay style={styles.video} />
        {guide ? <div style={styles.guide}>{guide}</div> : null}
        {status === 'starting' ? <p style={styles.notice}>{labels.starting}</p> : null}
      </div>
      <button type="button" onClick={shoot} disabled={status !== 'live'} style={styles.shutter}>
        {labels.takePhoto}
      </button>
      {nativeCameraInput}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  frame: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid #3a2a2e',
    background: '#14090b',
    minHeight: 240,
  },
  video: { width: '100%', height: 320, objectFit: 'cover', display: 'block' },
  guide: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    background: 'rgba(20, 9, 11, 0.75)',
    borderRadius: 8,
    padding: 12,
  },
  notice: { color: '#b8a99b', textAlign: 'center', padding: 12, margin: 0 },
  shutter: {
    minHeight: 48,
    borderRadius: 12,
    border: '1px solid #c8a253',
    background: '#c8a253',
    color: '#14090b',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  fallbackLabel: {
    display: 'block',
    minHeight: 48,
    lineHeight: '48px',
    borderRadius: 12,
    border: '1px solid #3a2a2e',
    color: '#e8ddd0',
    textAlign: 'center',
    fontSize: 15,
    cursor: 'pointer',
  },
  hiddenInput: { display: 'none' },
};
