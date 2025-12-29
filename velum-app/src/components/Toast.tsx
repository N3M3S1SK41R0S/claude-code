/**
 * VELUM - Système de Notifications Toast
 * Version corrigée avec accessibilité, cleanup des timeouts et pause au hover
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo
} from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'ai';

export interface ToastData {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration: number;
  createdAt: number;
  pausedAt?: number;
  remainingTime: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastContextType {
  success: (msg: string, options?: ToastOptions) => string;
  error: (msg: string, options?: ToastOptions) => string;
  info: (msg: string, options?: ToastOptions) => string;
  warning: (msg: string, options?: ToastOptions) => string;
  ai: (msg: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Hook pour utiliser le système de toasts
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  defaultDuration?: number;
}

/**
 * Provider pour le système de toasts
 */
export function ToastProvider({
  children,
  maxToasts = 5,
  defaultDuration = 5000
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup des timeouts au démontage
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  /**
   * Planifie la suppression automatique d'un toast
   */
  const scheduleRemoval = useCallback((id: string, delay: number) => {
    // Clear existing timeout if any
    const existingTimeout = timeoutRefs.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timeoutRefs.current.delete(id);
    }, delay);

    timeoutRefs.current.set(id, timeout);
  }, []);

  /**
   * Ajoute un nouveau toast
   */
  const addToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const duration = options?.duration ?? defaultDuration;
      const now = Date.now();

      const newToast: ToastData = {
        id,
        title: options?.title,
        message,
        type,
        duration,
        createdAt: now,
        remainingTime: duration
      };

      setToasts((prev) => {
        // Limiter le nombre de toasts
        const updated = [newToast, ...prev];
        if (updated.length > maxToasts) {
          const removed = updated.pop();
          if (removed) {
            const timeout = timeoutRefs.current.get(removed.id);
            if (timeout) {
              clearTimeout(timeout);
              timeoutRefs.current.delete(removed.id);
            }
          }
        }
        return updated;
      });

      scheduleRemoval(id, duration);

      return id;
    },
    [defaultDuration, maxToasts, scheduleRemoval]
  );

  /**
   * Supprime un toast par ID
   */
  const dismiss = useCallback((id: string) => {
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * Supprime tous les toasts
   */
  const dismissAll = useCallback(() => {
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current.clear();
    setToasts([]);
  }, []);

  /**
   * Met en pause un toast (appelé au hover)
   */
  const pauseToast = useCallback((id: string) => {
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }

    setToasts((prev) =>
      prev.map((t) => {
        if (t.id === id && !t.pausedAt) {
          const elapsed = Date.now() - t.createdAt;
          return {
            ...t,
            pausedAt: Date.now(),
            remainingTime: Math.max(0, t.duration - elapsed)
          };
        }
        return t;
      })
    );
  }, []);

  /**
   * Reprend un toast (appelé quand le hover se termine)
   */
  const resumeToast = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id === id && t.pausedAt) {
            scheduleRemoval(id, t.remainingTime);
            return {
              ...t,
              pausedAt: undefined,
              createdAt: Date.now() - (t.duration - t.remainingTime)
            };
          }
          return t;
        })
      );
    },
    [scheduleRemoval]
  );

  const contextValue = useMemo(
    () => ({
      success: (msg: string, options?: ToastOptions) =>
        addToast('success', msg, options),
      error: (msg: string, options?: ToastOptions) =>
        addToast('error', msg, options),
      info: (msg: string, options?: ToastOptions) =>
        addToast('info', msg, options),
      warning: (msg: string, options?: ToastOptions) =>
        addToast('warning', msg, options),
      ai: (msg: string, options?: ToastOptions) =>
        addToast('ai', msg, { ...options, title: options?.title || 'VELUM Intelligence' }),
      dismiss,
      dismissAll
    }),
    [addToast, dismiss, dismissAll]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={dismiss}
              onPause={pauseToast}
              onResume={resumeToast}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ============================================================================
// TOAST ITEM
// ============================================================================

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

const ToastItem = memo(function ToastItem({
  toast,
  onDismiss,
  onPause,
  onResume
}: ToastItemProps) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="text-green-400" size={20} />,
    error: <AlertCircle className="text-red-400" size={20} />,
    warning: <AlertTriangle className="text-yellow-400" size={20} />,
    info: <Info className="text-blue-400" size={20} />,
    ai: <Sparkles className="text-gold-400" size={20} />
  };

  const styles: Record<ToastType, string> = {
    success: 'border-green-500/30 bg-green-900/90',
    error: 'border-red-500/30 bg-red-900/90',
    warning: 'border-yellow-500/30 bg-yellow-900/90',
    info: 'border-blue-500/30 bg-blue-900/90',
    ai: 'border-gold-500/30 bg-heritage-900/95 shadow-glow-gold'
  };

  const handleMouseEnter = useCallback(() => {
    onPause(toast.id);
  }, [toast.id, onPause]);

  const handleMouseLeave = useCallback(() => {
    onResume(toast.id);
  }, [toast.id, onResume]);

  const handleDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [toast.id, onDismiss]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss(toast.id);
      }
    },
    [toast.id, onDismiss]
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      tabIndex={0}
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 ${
        styles[toast.type]
      }`}
    >
      <div className="mt-0.5 shrink-0" aria-hidden="true">
        {icons[toast.type]}
      </div>

      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="font-bold text-sm text-white font-display tracking-wider uppercase mb-1">
            {toast.title}
          </h4>
        )}
        <p className="text-sm text-white/90 font-serif leading-snug">
          {toast.message}
        </p>
      </div>

      <button
        onClick={handleDismiss}
        aria-label="Fermer la notification"
        className="text-white/50 hover:text-white transition-colors shrink-0 focus:outline-none focus:text-white"
      >
        <X size={16} aria-hidden="true" />
      </button>

      {/* Progress bar */}
      {!toast.pausedAt && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-white/20 rounded-b-xl"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{
            duration: toast.remainingTime / 1000,
            ease: 'linear'
          }}
        />
      )}
    </motion.div>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export type { ToastData, ToastOptions, ToastProviderProps };
