/**
 * VELUM - Scanner Forensique
 * Version corrigée avec cleanup, gestion d'erreurs et accessibilité
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Loader2,
  ShieldCheck,
  Target,
  ScanEye,
  Camera,
  CameraOff
} from 'lucide-react';
import type { CollectionType, CollectorItem, VisualFlaw } from '../types';
import {
  detectObjectStream,
  performDeepAnalysis,
  restoreItemImage
} from '../services/geminiService';
import { useToast } from './Toast';
import { HolographicGrid } from './Animations';

// ============================================================================
// TYPES
// ============================================================================

interface ScannerProps {
  onIdentified: (items: CollectorItem[]) => void;
  type: CollectionType;
  onClose?: () => void;
}

type ScannerStatus =
  | 'initializing'
  | 'permission_denied'
  | 'ready'
  | 'scanning'
  | 'analyzing'
  | 'complete'
  | 'error';

// ============================================================================
// CONSTANTS
// ============================================================================

const DETECTION_INTERVAL = 1500; // ms entre les détections
const CAPTURE_QUALITY = 0.95;
const PREVIEW_QUALITY = 0.5;
const PREVIEW_SIZE = 300;

// ============================================================================
// SCANNER COMPONENT
// ============================================================================

export const Scanner = memo(function Scanner({
  onIdentified,
  type,
  onClose
}: ScannerProps) {
  const toast = useToast();

  // State
  const [status, setStatus] = useState<ScannerStatus>('initializing');
  const [arLabel, setArLabel] = useState('');
  const [flaws, setFlaws] = useState<VisualFlaw[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * Initialise le stream caméra
   */
  const initializeCamera = useCallback(async () => {
    try {
      setStatus('initializing');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus('ready');
    } catch (error) {
      console.error('[Scanner] Camera access denied:', error);
      setStatus('permission_denied');
      setErrorMessage('Accès à la caméra refusé. Veuillez autoriser l\'accès.');
    }
  }, []);

  /**
   * Arrête le stream caméra
   */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Capture une image depuis la vidéo
   */
  const captureImage = useCallback(
    (quality: number, size?: number): string | null => {
      const video = videoRef.current;
      if (!video || video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
        return null;
      }

      // Réutiliser le canvas
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const canvas = canvasRef.current;
      const width = size || video.videoWidth;
      const height = size
        ? Math.round((video.videoHeight / video.videoWidth) * size)
        : video.videoHeight;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    },
    []
  );

  /**
   * Détection continue d'objets
   */
  useEffect(() => {
    if (status !== 'ready' && status !== 'scanning') return;

    const detect = async () => {
      if (status === 'analyzing') return;

      const image = captureImage(PREVIEW_QUALITY, PREVIEW_SIZE);
      if (!image) return;

      try {
        const label = await detectObjectStream(image);
        if (label && label.length < 40) {
          setArLabel(label);
        }
      } catch {
        // Ignorer les erreurs de détection rapide
      }
    };

    // Démarrer la détection
    detect();
    intervalRef.current = setInterval(detect, DETECTION_INTERVAL);
    setStatus('scanning');

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, captureImage]);

  /**
   * Initialisation et cleanup
   */
  useEffect(() => {
    initializeCamera();

    return () => {
      // Cleanup complet
      stopCamera();

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [initializeCamera, stopCamera]);

  /**
   * Capture et analyse complète
   */
  const handleCapture = useCallback(async () => {
    if (status === 'analyzing') return;

    setStatus('analyzing');
    setFlaws([]);

    // Créer un AbortController pour cette opération
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Capture haute résolution
    const image = captureImage(CAPTURE_QUALITY);
    if (!image) {
      toast.error('Échec de la capture. Veuillez réessayer.');
      setStatus('scanning');
      return;
    }

    toast.ai('Analyse Forensique Multimodale en cours...');

    try {
      // Exécution parallèle: Analyse + Restauration
      const [analysis, restored] = await Promise.all([
        performDeepAnalysis({ type }, image, signal),
        restoreItemImage(image, signal)
      ]);

      if (signal.aborted) return;

      // Afficher les défauts détectés
      if (analysis.visualFlaws && analysis.visualFlaws.length > 0) {
        setFlaws(analysis.visualFlaws);
      }

      // Créer l'item
      const item: CollectorItem = {
        id: Date.now().toString(),
        type,
        title: arLabel || 'Objet Identifié',
        country: 'En cours d\'analyse',
        year: new Date().getFullYear(),
        condition: analysis.rarityIndex || 'Expertisé',
        value: analysis.estimatedValueMax || 0,
        imageUrl: image,
        restoredImageUrl: restored || undefined,
        description: analysis.report || analysis.historicalContext || '',
        isForSale: false,
        expertAnalysis: {
          report: analysis.report || '',
          sources: [],
          timestamp: new Date().toISOString(),
          deepData: analysis
        },
        tags: ['Forensics', 'Gemini Pro', analysis.rarityIndex].filter(
          Boolean
        ) as string[]
      };

      setStatus('complete');
      toast.success('Expertise terminée. Génération du certificat.');

      // Donner le temps de voir la heatmap
      setTimeout(() => {
        if (!signal.aborted) {
          onIdentified([item]);
        }
      }, 2500);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      console.error('[Scanner] Analysis failed:', error);
      toast.error('Échec de l\'expertise. Veuillez réessayer.');
      setStatus('scanning');
    }
  }, [status, type, arLabel, captureImage, onIdentified, toast]);

  /**
   * Rendu du bouton de capture
   */
  const renderCaptureButton = () => {
    const isDisabled = status === 'analyzing' || status === 'permission_denied';

    return (
      <div className="relative group pointer-events-auto">
        <motion.button
          onClick={handleCapture}
          disabled={isDisabled}
          whileHover={!isDisabled ? { scale: 1.1 } : undefined}
          whileTap={!isDisabled ? { scale: 0.9 } : undefined}
          aria-label={
            status === 'analyzing' ? 'Analyse en cours' : 'Capturer et analyser'
          }
          className="w-24 h-24 rounded-full border-4 border-gold-500/30 flex items-center justify-center bg-black/40 backdrop-blur-xl relative overflow-hidden group-hover:border-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-gold-500/50"
        >
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
              status === 'analyzing'
                ? 'bg-red-500 animate-pulse'
                : 'bg-gold-500 group-hover:bg-white'
            }`}
          >
            {status === 'analyzing' ? (
              <Loader2
                className="animate-spin text-white"
                size={32}
                aria-hidden="true"
              />
            ) : (
              <Zap className="text-black" size={32} aria-hidden="true" />
            )}
          </div>
        </motion.button>

        {/* Cercles rotatifs */}
        {status !== 'analyzing' && (
          <>
            <div
              className="absolute -inset-4 border border-gold-500/20 rounded-full motion-safe:animate-spin-slow pointer-events-none"
              style={{ animationDuration: '10s' }}
              aria-hidden="true"
            />
            <div
              className="absolute -inset-8 border border-gold-500/10 rounded-full motion-safe:animate-spin-slow pointer-events-none"
              style={{ animationDuration: '15s', animationDirection: 'reverse' }}
              aria-hidden="true"
            />
          </>
        )}
      </div>
    );
  };

  /**
   * Rendu de l'écran de permission refusée
   */
  if (status === 'permission_denied') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            <CameraOff className="text-red-400" size={40} />
          </div>
          <h2 className="text-xl font-display font-bold text-white">
            Accès Caméra Requis
          </h2>
          <p className="text-heritage-400 font-serif">
            {errorMessage}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={initializeCamera}
              className="px-6 py-3 bg-gold-500 text-black rounded-full font-display font-bold text-sm"
            >
              Réessayer
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 text-white rounded-full font-display text-sm"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black" role="application" aria-label="Scanner forensique">
      {/* Video Stream */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover opacity-60"
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />

      {/* Holographic Overlay */}
      <HolographicGrid />

      {/* Heatmap Defect Markers */}
      <AnimatePresence>
        {flaws.map((flaw, i) => (
          <motion.div
            key={`flaw-${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute w-12 h-12 flex items-center justify-center pointer-events-none"
            style={{
              left: `${flaw.x}%`,
              top: `${flaw.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
            <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,0,0,0.8)]" />
            <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-black/80 text-red-400 text-[10px] font-mono px-2 py-1 rounded border border-red-500/30 whitespace-nowrap z-10">
              {flaw.label}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Forensic HUD */}
      <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
        {/* Top HUD */}
        <div className="flex justify-between items-start pt-12">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-heritage-900/80 p-4 rounded-xl border border-gold-500/30 backdrop-blur-xl space-y-2 shadow-2xl max-w-[200px]"
          >
            <div className="flex items-center gap-2 text-gold-400 font-display font-bold text-xs">
              <ShieldCheck size={14} aria-hidden="true" /> SCANNER V5.0
            </div>
            <div className="text-[9px] text-heritage-300 font-mono leading-relaxed">
              MODEL: GEMINI PRO
              <br />
              VISION: NATIVE
              <br />
              HEATMAP: {flaws.length > 0 ? 'ACTIVE' : 'STANDBY'}
            </div>
          </motion.div>

          <div className="relative">
            <div className="absolute inset-0 bg-gold-500/20 blur-xl rounded-full" />
            <ScanEye
              className="text-gold-400 relative z-10 animate-pulse-slow"
              size={48}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="flex flex-col items-center gap-8 pb-12">
          {/* AR Label */}
          <AnimatePresence>
            {arLabel && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-black/60 text-gold-400 px-6 py-2 rounded-full font-mono text-xs border border-gold-500/30 backdrop-blur-md flex items-center gap-2"
                role="status"
                aria-live="polite"
              >
                <Target size={12} aria-hidden="true" /> {arLabel}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Capture Button */}
          {renderCaptureButton()}

          {/* Status Text */}
          <div className="text-center">
            <p className="text-[10px] text-heritage-400 font-mono uppercase tracking-widest">
              {status === 'initializing' && 'Initialisation...'}
              {status === 'scanning' && 'Pointez vers un objet'}
              {status === 'analyzing' && 'Analyse en cours...'}
              {status === 'complete' && 'Analyse terminée'}
            </p>
          </div>
        </div>
      </div>

      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Fermer le scanner"
          className="absolute top-6 right-6 p-3 bg-black/50 rounded-full text-white/70 hover:text-white hover:bg-black/70 transition-colors z-50 pointer-events-auto focus:outline-none focus:ring-2 focus:ring-gold-500/50"
        >
          <Camera size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export type { ScannerProps };
