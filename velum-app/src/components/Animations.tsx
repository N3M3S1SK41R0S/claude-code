/**
 * VELUM - Composants d'Animation
 * Version corrigée avec support prefers-reduced-motion, cleanup et optimisations
 */

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo
} from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';

// ============================================================================
// HOOKS - Reduced Motion
// ============================================================================

/**
 * Hook pour détecter si l'utilisateur préfère les animations réduites
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

// ============================================================================
// CURSOR TRAIL
// ============================================================================

interface TrailPoint {
  x: number;
  y: number;
  id: number;
}

/**
 * Effet de traînée de curseur doré
 */
export const CursorTrail = memo(function CursorTrail() {
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const idRef = useRef(0);
  const prefersReduced = usePrefersReducedMotion();
  const throttleRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReduced) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      // Throttle à 60fps max
      if (now - throttleRef.current < 16) return;
      throttleRef.current = now;

      setTrail((prev) => [
        ...prev.slice(-12),
        { x: e.clientX, y: e.clientY, id: idRef.current++ }
      ]);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [prefersReduced]);

  if (prefersReduced) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]" aria-hidden="true">
      {trail.map((point) => (
        <motion.div
          key={point.id}
          className="absolute w-2 h-2 rounded-full blur-[1px]"
          style={{
            left: point.x,
            top: point.y,
            background: 'radial-gradient(circle, #D4AF37 0%, transparent 80%)',
            boxShadow: '0 0 10px rgba(212, 175, 55, 0.4)'
          }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
});

// ============================================================================
// HOLOGRAPHIC GRID
// ============================================================================

/**
 * Grille holographique pour le scanner
 */
export const HolographicGrid = memo(function HolographicGrid() {
  const prefersReduced = usePrefersReducedMotion();

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(212,175,55,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.1)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_10%,transparent_100%)] animate-pulse-slow" />

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gold-400/30" />
      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gold-400/30" />

      {/* Border animation */}
      {!prefersReduced && (
        <motion.div
          className="absolute inset-0 border-[20px] border-gold-500/5 rounded-[3rem]"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Corner markers */}
      <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-gold-500" />
      <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-gold-500" />
      <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-gold-500" />
      <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-gold-500" />
    </div>
  );
});

// ============================================================================
// FLOATING ORBS
// ============================================================================

/**
 * Orbes flottantes ambiantes
 */
export const FloatingOrbs = memo(function FloatingOrbs() {
  const prefersReduced = usePrefersReducedMotion();

  if (prefersReduced) {
    // Version statique pour reduced motion
    return (
      <div
        className="fixed inset-0 overflow-hidden pointer-events-none z-0"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-gold-600/5 blur-[120px]" />
        <div className="absolute -bottom-60 -right-60 w-[800px] h-[800px] rounded-full bg-heritage-800/20 blur-[150px]" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden="true"
    >
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -50, 100, 0],
          scale: [1, 1.2, 0.9, 1]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-gold-600/5 blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, -80, 60, 0],
          y: [0, 120, -40, 0],
          scale: [1, 0.8, 1.1, 1]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        className="absolute -bottom-60 -right-60 w-[800px] h-[800px] rounded-full bg-heritage-800/20 blur-[150px]"
      />
    </div>
  );
});

// ============================================================================
// TILT CARD
// ============================================================================

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}

/**
 * Carte avec effet de tilt 3D
 */
export const TiltCard = memo(function TiltCard({
  children,
  className = '',
  maxTilt = 20
}: TiltCardProps) {
  const prefersReduced = usePrefersReducedMotion();
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  const handleMouse = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReduced) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const xPct = (mouseX / width - 0.5) * maxTilt;
      const yPct = (mouseY / height - 0.5) * -maxTilt;
      rotateX.set(yPct);
      rotateY.set(xPct);
    },
    [maxTilt, prefersReduced, rotateX, rotateY]
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  if (prefersReduced) {
    return <div className={`relative ${className}`}>{children}</div>;
  }

  return (
    <motion.div
      onMouseMove={handleMouse}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: 'preserve-3d'
      }}
      className={`relative ${className}`}
    >
      <div style={{ transform: 'translateZ(50px)' }}>{children}</div>
    </motion.div>
  );
});

// ============================================================================
// STAGGERED REVEAL
// ============================================================================

interface StaggerRevealProps {
  children: React.ReactNode;
  delay?: number;
}

/**
 * Conteneur pour animations séquentielles
 */
export const StaggerReveal = memo(function StaggerReveal({
  children,
  delay = 0.1
}: StaggerRevealProps) {
  const prefersReduced = usePrefersReducedMotion();

  if (prefersReduced) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: delay }
        }
      }}
    >
      {children}
    </motion.div>
  );
});

/**
 * Item enfant pour StaggerReveal
 */
export const StaggerItem = memo(function StaggerItem({
  children
}: {
  children: React.ReactNode;
}) {
  const prefersReduced = usePrefersReducedMotion();

  if (prefersReduced) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
        visible: { opacity: 1, y: 0, filter: 'blur(0px)' }
      }}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// MAGNETIC BUTTON
// ============================================================================

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Bouton avec effet magnétique
 */
export const MagneticButton = memo(function MagneticButton({
  children,
  className = '',
  onClick,
  disabled = false,
  'aria-label': ariaLabel
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const prefersReduced = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15 });
  const springY = useSpring(y, { stiffness: 150, damping: 15 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current || prefersReduced || disabled) return;
      const { left, top, width, height } = ref.current.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      x.set(distanceX * 0.35);
      y.set(distanceY * 0.35);
    },
    [prefersReduced, disabled, x, y]
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  if (prefersReduced) {
    return (
      <button
        className={`relative ${className}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return (
    <motion.button
      ref={ref}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{ x: springX, y: springY }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
});

// ============================================================================
// PARTICLE BURST
// ============================================================================

interface Particle {
  x: number;
  y: number;
  id: number;
}

/**
 * Hook pour créer des effets de particules au clic
 */
export function useParticleBurst() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const prefersReduced = usePrefersReducedMotion();
  const timeoutRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Cleanup des timeouts au démontage
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  const trigger = useCallback(
    (x: number, y: number) => {
      if (prefersReduced) return;

      const id = Date.now();
      setParticles((prev) => [...prev, { x, y, id }]);

      const timeout = setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
        timeoutRefs.current.delete(timeout);
      }, 1000);

      timeoutRefs.current.add(timeout);
    },
    [prefersReduced]
  );

  // Mémoiser le composant pour éviter les re-renders
  const Particles = useMemo(() => {
    return function ParticlesComponent() {
      if (prefersReduced) return null;

      return (
        <AnimatePresence>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="fixed pointer-events-none z-[110]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-hidden="true"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-gold-400"
                  initial={{ x: p.x, y: p.y, scale: 1 }}
                  animate={{
                    x: p.x + (Math.random() - 0.5) * 150,
                    y: p.y + (Math.random() - 0.5) * 150,
                    scale: 0,
                    opacity: 0
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              ))}
            </motion.div>
          ))}
        </AnimatePresence>
      );
    };
  }, [particles, prefersReduced]);

  return { trigger, Particles };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { TiltCardProps, MagneticButtonProps, StaggerRevealProps };
