# PROMPT COMPLET - PARTIE 2

## COMPARAISON DES PLATEFORMES

| Plateforme | Avantages | Inconvénients | Recommandation |
|------------|-----------|---------------|----------------|
| **Firebase Studio / IDX** | - Intégration native Gemini API - Gratuit - Support Firebase | - Encore en preview | ⭐⭐⭐⭐⭐ **MEILLEUR CHOIX** |
| **Google AI Studio** | - Gratuit - Test rapide de l'API | - Pas de build complet | ⭐⭐⭐ |
| **Replit** | - Déploiement facile | - Payant pour features avancées | ⭐⭐⭐ |
| **CodeSandbox** | - Rapide | - Limité pour grosses apps | ⭐⭐ |
| **StackBlitz** | - WebContainer | - Parfois instable | ⭐⭐⭐ |

**VERDICT: Firebase Studio (IDX) est le meilleur choix car:**
1. Intégration native avec l'API Gemini
2. Gratuit avec quota généreux
3. Environnement VSCode complet
4. Déploiement Firebase intégré

---

## FICHIER 7: src/components/Toast.tsx

```typescript
/**
 * VELUM - Système de Toast Notifications
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ToastMessage } from '../types';

// ============================================================================
// CONTEXT
// ============================================================================

interface ToastContextValue {
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// ============================================================================
// TOAST ITEM
// ============================================================================

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const duration = toast.duration || 5000;

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const startTime = Date.now();
    const remainingTime = (progress / 100) * duration;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.max(0, ((remainingTime - elapsed) / duration) * 100);
      setProgress(newProgress);

      if (newProgress <= 0) {
        onRemove(toast.id);
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, progress, duration, toast.id, onRemove]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />
  };

  const colors = {
    success: 'border-green-500/30 bg-green-950/80',
    error: 'border-red-500/30 bg-red-950/80',
    warning: 'border-yellow-500/30 bg-yellow-950/80',
    info: 'border-blue-500/30 bg-blue-950/80'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`
        relative overflow-hidden rounded-lg border backdrop-blur-sm
        shadow-lg max-w-sm w-full
        ${colors[toast.type]}
      `}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0">{icons[toast.type]}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-heritage-100">{toast.title}</p>
          {toast.message && (
            <p className="text-sm text-heritage-400 mt-1">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-sm text-gold-400 hover:text-gold-300 mt-2 font-medium"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 text-heritage-500 hover:text-heritage-300 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-heritage-800">
        <motion.div
          className={`h-full ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
};

// ============================================================================
// PROVIDER
// ============================================================================

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts(prev => {
      const newToasts = [...prev, { ...toast, id }];
      return newToasts.slice(-maxToasts);
    });
    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, clearAll }}>
      {children}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-2"
        aria-label="Notifications"
      >
        <AnimatePresence mode="sync">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
```

---

## FICHIER 8: src/components/Animations.tsx

```typescript
/**
 * VELUM - Composants d'Animation
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// HOOKS
// ============================================================================

export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

// ============================================================================
// PARTICLE BURST
// ============================================================================

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  life: number;
}

interface ParticleBurstProps {
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  onComplete?: () => void;
}

export const ParticleBurst: React.FC<ParticleBurstProps> = ({
  x,
  y,
  count = 20,
  colors = ['#D4AF37', '#F4E4BC', '#B8860B', '#FBBF24'],
  onComplete
}) => {
  const prefersReduced = usePrefersReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (prefersReduced) {
      onComplete?.();
      return;
    }

    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x,
      y,
      angle: (Math.PI * 2 * i) / count + Math.random() * 0.5,
      speed: 2 + Math.random() * 4,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1
    }));

    setParticles(newParticles);

    const timeout = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [x, y, count, colors, onComplete, prefersReduced]);

  if (prefersReduced || particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
      {particles.map(particle => (
        <motion.div
          key={particle.id}
          initial={{
            x: particle.x,
            y: particle.y,
            scale: 1,
            opacity: 1
          }}
          animate={{
            x: particle.x + Math.cos(particle.angle) * particle.speed * 50,
            y: particle.y + Math.sin(particle.angle) * particle.speed * 50 + 100,
            scale: 0,
            opacity: 0
          }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: particle.size,
            height: particle.size,
            borderRadius: '50%',
            backgroundColor: particle.color
          }}
        />
      ))}
    </div>
  );
};

// ============================================================================
// USE PARTICLE BURST HOOK
// ============================================================================

export function useParticleBurst() {
  const [burst, setBurst] = useState<{ x: number; y: number; key: number } | null>(null);
  const keyRef = useRef(0);

  const trigger = useCallback((x: number, y: number) => {
    keyRef.current += 1;
    setBurst({ x, y, key: keyRef.current });
  }, []);

  const clear = useCallback(() => {
    setBurst(null);
  }, []);

  const Component = burst ? (
    <ParticleBurst x={burst.x} y={burst.y} onComplete={clear} key={burst.key} />
  ) : null;

  return { trigger, Component };
}

// ============================================================================
// SHIMMER TEXT
// ============================================================================

interface ShimmerTextProps {
  children: string;
  className?: string;
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  children,
  className = ''
}) => {
  const prefersReduced = usePrefersReducedMotion();

  if (prefersReduced) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      className={`
        relative inline-block
        bg-gradient-to-r from-gold-400 via-gold-200 to-gold-400
        bg-[length:200%_100%]
        bg-clip-text text-transparent
        motion-safe:animate-shimmer
        ${className}
      `}
    >
      {children}
    </span>
  );
};

// ============================================================================
// FADE IN
// ============================================================================

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  direction = 'up',
  className = ''
}) => {
  const prefersReduced = usePrefersReducedMotion();

  const directionOffset = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
    none: {}
  };

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directionOffset[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ============================================================================
// CURSOR TRAIL
// ============================================================================

export const CursorTrail: React.FC = () => {
  const prefersReduced = usePrefersReducedMotion();
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);
  const idRef = useRef(0);
  const lastUpdate = useRef(0);

  useEffect(() => {
    if (prefersReduced) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdate.current < 16) return; // ~60fps
      lastUpdate.current = now;

      idRef.current += 1;
      setTrail(prev => [...prev.slice(-10), { x: e.clientX, y: e.clientY, id: idRef.current }]);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [prefersReduced]);

  if (prefersReduced) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
      {trail.map((point, i) => (
        <motion.div
          key={point.id}
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            left: point.x - 4,
            top: point.y - 4,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#D4AF37',
            opacity: (i + 1) / trail.length * 0.3
          }}
        />
      ))}
    </div>
  );
};
```

---

## FICHIER 9: src/components/Scanner.tsx

```typescript
/**
 * VELUM - Scanner de Caméra
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Zap, RotateCcw, FlipHorizontal } from 'lucide-react';
import { ActionButton, LoadingSpinner } from './Shared';
import { detectObjectStream } from '../services/geminiService';

// ============================================================================
// TYPES
// ============================================================================

type ScannerStatus = 'idle' | 'requesting' | 'active' | 'capturing' | 'analyzing' | 'error';

interface ScannerProps {
  onCapture: (imageBase64: string, analysis?: string) => void;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const Scanner: React.FC<ScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Cleanup function
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    cleanup();
    setStatus('requesting');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('active');
      }
    } catch (err) {
      setStatus('error');
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres.');
      } else {
        setError('Impossible d\'accéder à la caméra.');
      }
    }
  }, [facingMode, cleanup]);

  // Capture and analyze
  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setStatus('capturing');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);

    setStatus('analyzing');
    setAnalysis('');

    abortRef.current = new AbortController();

    try {
      let fullAnalysis = '';

      for await (const chunk of detectObjectStream(imageBase64)) {
        if (abortRef.current?.signal.aborted) break;
        fullAnalysis += chunk;
        setAnalysis(fullAnalysis);
      }

      onCapture(imageBase64, fullAnalysis);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Erreur lors de l\'analyse.');
        setStatus('error');
      }
    }
  }, [onCapture]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  // Effects
  useEffect(() => {
    startCamera();
    return cleanup;
  }, [startCamera, cleanup]);

  useEffect(() => {
    if (status === 'active' || status === 'error') {
      startCamera();
    }
  }, [facingMode]);

  // Render
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="text-lg font-display text-gold-500">Scanner</h2>
        <button
          onClick={onClose}
          className="p-2 text-heritage-300 hover:text-white transition-colors"
          aria-label="Fermer"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Video Feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Canvas (hidden) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlay */}
        {status === 'active' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-gold-500/50 rounded-lg">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gold-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gold-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gold-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gold-500 rounded-br-lg" />
            </div>
          </div>
        )}

        {/* Loading state */}
        {(status === 'requesting' || status === 'capturing') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <LoadingSpinner text={status === 'requesting' ? 'Accès caméra...' : 'Capture...'} />
          </div>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-8 text-center">
            <Camera className="w-16 h-16 text-heritage-500 mb-4" />
            <p className="text-heritage-300 mb-4">{error}</p>
            <ActionButton onClick={startCamera} icon={<RotateCcw className="w-4 h-4" />}>
              Réessayer
            </ActionButton>
          </div>
        )}

        {/* Analysis overlay */}
        <AnimatePresence>
          {status === 'analyzing' && analysis && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute bottom-0 left-0 right-0 bg-heritage-950/95 backdrop-blur-sm border-t border-heritage-700 p-4 max-h-[50%] overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-gold-500 animate-pulse" />
                <span className="text-sm font-medium text-gold-500">Analyse en cours...</span>
              </div>
              <p className="text-heritage-200 text-sm whitespace-pre-wrap">{analysis}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="p-6 bg-gradient-to-t from-black to-transparent">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={toggleCamera}
            disabled={status !== 'active'}
            className="p-3 rounded-full bg-heritage-800/80 text-heritage-300 hover:text-white disabled:opacity-50 transition-all"
            aria-label="Changer de caméra"
          >
            <FlipHorizontal className="w-6 h-6" />
          </button>

          <button
            onClick={capture}
            disabled={status !== 'active'}
            className="w-16 h-16 rounded-full bg-gold-500 hover:bg-gold-400 disabled:bg-heritage-600 disabled:opacity-50 flex items-center justify-center transition-all shadow-glow-gold"
            aria-label="Capturer"
          >
            <Camera className="w-8 h-8 text-black" />
          </button>

          <div className="w-12" /> {/* Spacer */}
        </div>
      </div>
    </motion.div>
  );
};
```

---

## FICHIER 10: src/components/ChatBot.tsx

```typescript
/**
 * VELUM - Interface Chat
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Mic, Search, ExternalLink, StopCircle } from 'lucide-react';
import { chatWithGemini, groundedSearch } from '../services/geminiService';
import type { ChatMessage, CollectorItem, SearchSource } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const SEARCH_KEYWORDS = [
  'recherche', 'trouve', 'search', 'find', 'google',
  'actualité', 'news', 'récent', 'recent', 'prix actuel',
  'marché', 'market', 'vente', 'auction', 'enchère'
];

// ============================================================================
// PROPS
// ============================================================================

interface ChatBotProps {
  currentItem?: CollectorItem;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ChatBot: React.FC<ChatBotProps> = ({ currentItem, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: currentItem
        ? `Bonjour ! Je suis prêt à répondre à vos questions sur "${currentItem.name}". Comment puis-je vous aider ?`
        : 'Bonjour ! Je suis VELUM, votre expert en objets de collection. Comment puis-je vous aider ?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Check if search is needed
  const needsSearch = useCallback((text: string): boolean => {
    const lower = text.toLowerCase();
    return SEARCH_KEYWORDS.some(kw => lower.includes(kw));
  }, []);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    // Use functional update to avoid stale state
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    abortRef.current = new AbortController();

    try {
      // Check if grounded search is needed
      if (needsSearch(userMessage.content)) {
        const { text, sources } = await groundedSearch(userMessage.content);

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: text, sources, isStreaming: false }
              : msg
          )
        );
      } else {
        // Regular chat
        let fullContent = '';
        const chatMessages = [...messages, userMessage].filter(m => m.role !== 'system');

        for await (const chunk of chatWithGemini(chatMessages, currentItem)) {
          if (abortRef.current?.signal.aborted) break;

          fullContent += chunk;

          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: fullContent }
                : msg
            )
          );
        }

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
                  error: error.message,
                  isStreaming: false
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, currentItem, needsSearch]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-4 md:inset-auto md:bottom-4 md:right-4 md:w-96 md:h-[600px] bg-heritage-900 rounded-2xl border border-heritage-700 shadow-2xl flex flex-col overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-heritage-700 bg-heritage-950">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="font-display text-gold-500">VELUM Assistant</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-heritage-400 hover:text-white transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map(message => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-gold-500/20 text-heritage-100 rounded-br-none'
                    : 'bg-heritage-800 text-heritage-200 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>

                {/* Streaming indicator */}
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-gold-500 animate-pulse ml-1" />
                )}

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-heritage-700">
                    <p className="text-xs text-heritage-500 mb-2 flex items-center gap-1">
                      <Search className="w-3 h-3" />
                      Sources
                    </p>
                    <div className="space-y-1">
                      {message.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 truncate"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-heritage-700 bg-heritage-950">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Posez votre question..."
            disabled={isStreaming}
            className="flex-1 bg-heritage-800 border border-heritage-600 rounded-xl px-4 py-2 text-heritage-100 placeholder-heritage-500 focus:outline-none focus:border-gold-500 disabled:opacity-50"
          />

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="p-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
              aria-label="Arrêter"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="p-2 bg-gold-500 text-black rounded-xl hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Envoyer"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
```

---

## FICHIER 11: src/components/LiveAssistant.tsx

```typescript
/**
 * VELUM - Assistant Vocal Live
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { liveService, LiveServiceStatus } from '../services/liveService';
import { audioEngine } from '../services/audioEngine';
import { ActionButton } from './Shared';
import type { CollectorItem } from '../types';

// ============================================================================
// PROPS
// ============================================================================

interface LiveAssistantProps {
  currentItem?: CollectorItem;
  onClose: () => void;
}

// ============================================================================
// STATUS MESSAGES
// ============================================================================

const STATUS_MESSAGES: Record<LiveServiceStatus, string> = {
  idle: 'Prêt à démarrer',
  connecting: 'Connexion...',
  connected: 'Connecté',
  disconnected: 'Déconnecté',
  error: 'Erreur de connexion',
  reconnecting: 'Reconnexion...'
};

// ============================================================================
// COMPONENT
// ============================================================================

export const LiveAssistant: React.FC<LiveAssistantProps> = ({ currentItem, onClose }) => {
  const [status, setStatus] = useState<LiveServiceStatus>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Visualizer animation
  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (status === 'connected') {
      const bars = 32;
      const barWidth = width / bars;

      for (let i = 0; i < bars; i++) {
        const barHeight = Math.random() * height * 0.8;
        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, '#D4AF37');
        gradient.addColorStop(1, '#B8860B');

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      }
    }

    animationRef.current = requestAnimationFrame(drawVisualizer);
  }, [status]);

  // Setup callbacks and visualizer
  useEffect(() => {
    liveService.setCallbacks({
      onStatusChange: setStatus,
      onTranscript: (text, isFinal) => {
        if (isFinal) {
          setTranscript(prev => [...prev, text].slice(-10));
        }
      },
      onAudioOutput: (audioData) => {
        if (!isSpeakerOff) {
          audioEngine.play(audioData);
        }
      },
      onError: (error) => {
        console.error('[LiveAssistant]', error);
      }
    });

    if (status === 'connected') {
      animationRef.current = requestAnimationFrame(drawVisualizer);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [status, isSpeakerOff, drawVisualizer]);

  // Connect
  const connect = useCallback(async () => {
    const context = currentItem
      ? `Tu es VELUM, expert en objets de collection. L'utilisateur examine actuellement: ${currentItem.name}. ${currentItem.description}`
      : undefined;

    await liveService.connect(context);
    await liveService.startAudioInput();
  }, [currentItem]);

  // Disconnect
  const disconnect = useCallback(() => {
    liveService.disconnect();
    audioEngine.stop();
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (isMuted) {
      liveService.startAudioInput();
    } else {
      liveService.stopAudioInput();
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    if (!isSpeakerOff) {
      audioEngine.stop();
    }
    setIsSpeakerOff(!isSpeakerOff);
  }, [isSpeakerOff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const isConnected = status === 'connected';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-4 md:inset-auto md:bottom-4 md:right-4 md:w-80 bg-heritage-900 rounded-2xl border border-heritage-700 shadow-2xl overflow-hidden z-50"
    >
      {/* Header */}
      <div className="p-4 border-b border-heritage-700 bg-heritage-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-heritage-500'}`} />
            <span className="font-display text-gold-500">Assistant Vocal</span>
          </div>
          <span className="text-xs text-heritage-400">{STATUS_MESSAGES[status]}</span>
        </div>
      </div>

      {/* Visualizer */}
      <div className="p-6">
        <div className="relative aspect-square rounded-full bg-heritage-800 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={200}
            height={200}
            className="absolute inset-0 w-full h-full"
          />
          <div className="relative z-10">
            {isConnected ? (
              <Mic className="w-12 h-12 text-gold-500" />
            ) : (
              <MicOff className="w-12 h-12 text-heritage-500" />
            )}
          </div>
        </div>
      </div>

      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="px-4 pb-4 max-h-32 overflow-y-auto">
          {transcript.map((text, i) => (
            <p key={i} className="text-sm text-heritage-300 mb-1">{text}</p>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="p-4 border-t border-heritage-700 bg-heritage-950">
        <div className="flex items-center justify-center gap-4">
          {/* Mute */}
          <button
            onClick={toggleMute}
            disabled={!isConnected}
            className={`p-3 rounded-full transition-colors disabled:opacity-50 ${
              isMuted ? 'bg-red-500/20 text-red-400' : 'bg-heritage-800 text-heritage-300 hover:text-white'
            }`}
            aria-label={isMuted ? 'Activer micro' : 'Désactiver micro'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Connect/Disconnect */}
          <button
            onClick={isConnected ? disconnect : connect}
            className={`p-4 rounded-full transition-colors ${
              isConnected
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-gold-500 hover:bg-gold-400 text-black'
            }`}
            aria-label={isConnected ? 'Terminer' : 'Démarrer'}
          >
            {isConnected ? <PhoneOff className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </button>

          {/* Speaker */}
          <button
            onClick={toggleSpeaker}
            disabled={!isConnected}
            className={`p-3 rounded-full transition-colors disabled:opacity-50 ${
              isSpeakerOff ? 'bg-red-500/20 text-red-400' : 'bg-heritage-800 text-heritage-300 hover:text-white'
            }`}
            aria-label={isSpeakerOff ? 'Activer son' : 'Désactiver son'}
          >
            {isSpeakerOff ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Close button */}
        <div className="mt-4">
          <ActionButton onClick={onClose} variant="ghost" className="w-full">
            Fermer
          </ActionButton>
        </div>
      </div>
    </motion.div>
  );
};
```

---

[CONTINUER AVEC PARTIE 3 - Réponds "CONTINUE" pour les composants restants, App.tsx, index.tsx et index.html]
