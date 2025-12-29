/**
 * VELUM - Assistant Live Audio
 * Version corrigée avec gestion d'état robuste et visualisation canvas
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo
} from 'react';
import { motion } from 'framer-motion';
import { Mic, X, Activity } from 'lucide-react';
import { liveService, LiveServiceStatus } from '../services/liveService';

// ============================================================================
// TYPES
// ============================================================================

interface LiveAssistantProps {
  onClose: () => void;
  defaultVisible?: boolean;
}

// ============================================================================
// STATUS MESSAGES
// ============================================================================

const STATUS_MESSAGES: Record<LiveServiceStatus, string> = {
  idle: 'En veille',
  connecting: 'Connexion...',
  connected: 'Lien Actif',
  disconnected: 'Déconnecté',
  error: 'Erreur',
  permission_denied: 'Accès refusé'
};

// ============================================================================
// LIVE ASSISTANT COMPONENT
// ============================================================================

export const LiveAssistant = memo(function LiveAssistant({
  onClose,
  defaultVisible = true
}: LiveAssistantProps) {
  const [isVisible, setIsVisible] = useState(defaultVisible);
  const [status, setStatus] = useState<LiveServiceStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('En veille');
  const [volume, setVolume] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  /**
   * Configure les callbacks du service live
   */
  useEffect(() => {
    liveService.setCallbacks({
      onStatusChange: (newStatus, message) => {
        setStatus(newStatus);
        setStatusMessage(message || STATUS_MESSAGES[newStatus]);
      },
      onVolumeChange: setVolume,
      onError: (error) => {
        console.error('[LiveAssistant] Error:', error);
      }
    });

    // Cleanup
    return () => {
      liveService.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  /**
   * Animation du visualiseur
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const isActive = status === 'connected';

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 30;
      const pulse = volume * 50;
      const radius = baseRadius + pulse;

      // Glow
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius,
        centerX,
        centerY,
        radius + 20
      );

      if (isActive) {
        gradient.addColorStop(0, 'rgba(212, 175, 55, 1)');
        gradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.3)');
      } else {
        gradient.addColorStop(0, 'rgba(50, 50, 50, 1)');
        gradient.addColorStop(0.5, 'rgba(50, 50, 50, 0.3)');
      }
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 30, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = isActive ? '#D4AF37' : '#333';
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(10, radius * 0.5), 0, Math.PI * 2);
      ctx.fill();

      // Rings (only when active)
      if (isActive) {
        ctx.strokeStyle = `rgba(212, 175, 55, ${0.5 - pulse / 100})`;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY,
          radius + 10 + Math.sin(phase) * 5,
          0,
          Math.PI * 2
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY,
          radius + 25 + Math.cos(phase) * 5,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      phase += 0.05;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [status, volume]);

  /**
   * Toggle connexion
   */
  const handleToggle = useCallback(async () => {
    if (status === 'connected') {
      liveService.disconnect();
    } else if (status !== 'connecting') {
      await liveService.connect();
    }
  }, [status]);

  /**
   * Toggle visibilité
   */
  const handleClose = useCallback(() => {
    setIsVisible(false);
    liveService.disconnect();
    onClose();
  }, [onClose]);

  if (!isVisible) {
    return null;
  }

  const isActive = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <div className="fixed bottom-28 right-6 z-50 pointer-events-none">
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        role="region"
        aria-label="Assistant vocal"
        className="pointer-events-auto bg-heritage-950/90 border border-gold-500/30 rounded-[2rem] p-4 w-72 shadow-2xl backdrop-blur-xl flex flex-col items-center"
      >
        {/* Header */}
        <div className="w-full flex justify-between items-center mb-4 px-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isActive
                  ? 'bg-green-500 animate-pulse'
                  : status === 'error' || status === 'permission_denied'
                  ? 'bg-red-500'
                  : 'bg-heritage-500'
              }`}
              aria-hidden="true"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold-400">
              Gemini Live
            </span>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fermer l'assistant"
            className="text-white/30 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/50 rounded-full p-1"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Canvas Visualizer */}
        <div className="relative w-full h-32 mb-4">
          <canvas
            ref={canvasRef}
            width={250}
            height={128}
            className="w-full h-full"
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 text-center">
            <p
              className="text-[9px] font-mono text-heritage-400 uppercase tracking-[0.2em]"
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </p>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={handleToggle}
          disabled={isConnecting}
          aria-label={isActive ? 'Terminer la conversation' : 'Démarrer la conversation'}
          aria-pressed={isActive}
          className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-display font-bold uppercase text-xs tracking-widest focus:outline-none focus:ring-2 focus:ring-gold-500/50 disabled:opacity-50 ${
            isActive
              ? 'bg-red-500/20 text-red-500 border border-red-500/50'
              : 'bg-gold-500 text-black shadow-glow-gold hover:scale-105'
          }`}
        >
          {isActive ? (
            <>
              <Activity size={14} className="animate-pulse" aria-hidden="true" />
              Terminer
            </>
          ) : isConnecting ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Connexion...
            </>
          ) : (
            <>
              <Mic size={14} aria-hidden="true" />
              Consulter
            </>
          )}
        </button>

        {/* Permission denied message */}
        {status === 'permission_denied' && (
          <p className="text-[9px] text-red-400 mt-2 text-center">
            Veuillez autoriser l'accès au microphone
          </p>
        )}
      </motion.div>
    </div>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export type { LiveAssistantProps };
