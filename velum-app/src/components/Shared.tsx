/**
 * VELUM - Composants Partagés
 * Version corrigée avec accessibilité, types stricts et optimisations
 */

import React, {
  useRef,
  useState,
  useCallback,
  useId,
  memo,
  forwardRef
} from 'react';
import { Shield, Check, Menu } from 'lucide-react';

// ============================================================================
// VELUM LOGO
// ============================================================================

interface VelumLogoProps {
  size?: number;
  className?: string;
  id?: string;
}

/**
 * Logo VELUM avec dégradé doré
 */
export const VelumLogo = memo(function VelumLogo({
  size = 32,
  className = '',
  id
}: VelumLogoProps) {
  // ID unique pour éviter les collisions de gradient
  const uniqueId = useId();
  const gradientId = id ? `goldGradient-${id}` : `goldGradient-${uniqueId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Logo VELUM"
    >
      <title>VELUM</title>
      <path
        d="M50 0L95 25V75L50 100L5 75V25L50 0Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        fill="rgba(0,0,0,0.5)"
      />
      <path
        d="M50 15L80 32V68L50 85L20 68V32L50 15Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        d="M35 35L50 70L65 35"
        stroke="#D4AF37"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F9F1D0" />
          <stop offset="0.5" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#8A6E2F" />
        </linearGradient>
      </defs>
    </svg>
  );
});

// ============================================================================
// PARTICLE BACKGROUND
// ============================================================================

/**
 * Fond avec particules ambiantes (optimisé)
 */
export const ParticleBackground = memo(function ParticleBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 bg-heritage-950"
      aria-hidden="true"
    >
      {/* Ambient Nebula */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-gold-900/10 blur-[150px] animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-heritage-800/20 blur-[150px]" />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
    </div>
  );
});

// ============================================================================
// SPOTLIGHT CARD
// ============================================================================

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  noPadding?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Carte avec effet spotlight au survol
 */
export const SpotlightCard = memo(function SpotlightCard({
  children,
  className = '',
  onClick,
  noPadding = false,
  as: Component = 'div'
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOpacity(0);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <Component
      ref={divRef as any}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative rounded-xl overflow-hidden glass-card transition-all duration-500 group ${
        onClick ? 'cursor-pointer hover:border-gold-400/30 hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-gold-500/50' : ''
      } ${className}`}
    >
      {/* Golden Shine Effect */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(212, 175, 55, 0.1), transparent 40%)`
        }}
        aria-hidden="true"
      />
      <div className={`relative z-10 h-full ${noPadding ? '' : 'p-4'}`}>
        {children}
      </div>
    </Component>
  );
});

// ============================================================================
// WAX SEAL
// ============================================================================

interface WaxSealProps {
  verified?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Sceau de cire d'authentification
 */
export const WaxSeal = memo(function WaxSeal({
  verified = true,
  size = 'md'
}: WaxSealProps) {
  const sizeClasses = {
    sm: { outer: 'w-10 h-10', inner: 'w-7 h-7', icon: 16 },
    md: { outer: 'w-16 h-16', inner: 'w-12 h-12', icon: 24 },
    lg: { outer: 'w-20 h-20', inner: 'w-14 h-14', icon: 32 }
  };

  const { outer, inner, icon } = sizeClasses[size];

  return (
    <div
      className={`relative ${outer} flex items-center justify-center filter drop-shadow-xl`}
      role="img"
      aria-label={verified ? 'Authenticité vérifiée' : 'Non vérifié'}
    >
      {/* SVG Wax Seal shape - animation uniquement si pas reduced motion */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full text-gold-600 fill-current motion-safe:animate-spin-slow"
        style={{ animationDuration: '20s' }}
        aria-hidden="true"
      >
        <path d="M50 5 C55 5, 58 10, 62 8 C68 5, 72 12, 78 12 C85 12, 88 20, 92 22 C98 25, 95 32, 98 38 C100 45, 95 50, 98 58 C100 65, 92 70, 92 78 C92 85, 82 88, 78 92 C72 95, 65 90, 58 92 C50 95, 45 100, 38 98 C30 95, 28 88, 22 85 C15 82, 20 75, 15 70 C10 65, 5 60, 8 52 C10 45, 5 40, 8 32 C10 25, 18 22, 22 18 C28 12, 35 15, 42 12 C48 10, 50 0, 50 5 Z" />
      </svg>

      <div
        className={`relative ${inner} rounded-full flex items-center justify-center bg-gradient-to-br ${
          verified ? 'from-gold-400 to-gold-700' : 'from-red-600 to-red-900'
        } shadow-inner`}
      >
        {verified ? (
          <Shield className="text-black/80 drop-shadow-md" size={icon} />
        ) : (
          <span className="text-[8px] font-bold text-white/80 font-display">
            VOID
          </span>
        )}
      </div>

      {verified && (
        <div className="absolute -bottom-1 -right-1 bg-heritage-950 rounded-full p-1 border border-gold-400">
          <Check className="text-gold-400" size={size === 'sm' ? 8 : 10} />
        </div>
      )}
    </div>
  );
});

// ============================================================================
// ACTION BUTTON
// ============================================================================

interface ActionButtonProps {
  onClick: () => void | Promise<void>;
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
}

/**
 * Bouton d'action stylisé
 */
export const ActionButton = memo(
  forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
    {
      onClick,
      label,
      icon,
      variant = 'primary',
      disabled = false,
      loading = false,
      compact = false,
      className = '',
      type = 'button',
      'aria-label': ariaLabel
    },
    ref
  ) {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = useCallback(async () => {
      if (disabled || isLoading || loading) return;

      const result = onClick();
      if (result instanceof Promise) {
        setIsLoading(true);
        try {
          await result;
        } finally {
          setIsLoading(false);
        }
      }
    }, [onClick, disabled, isLoading, loading]);

    const isDisabled = disabled || isLoading || loading;
    const showLoading = isLoading || loading;

    const baseClasses = `relative flex items-center justify-center gap-2 rounded transition-all duration-300 font-display font-medium tracking-wider uppercase active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gold-500/50 ${
      compact ? 'py-3 px-4 text-[10px]' : 'py-4 px-6 text-xs'
    }`;

    const variants = {
      primary:
        'bg-gold-400 text-heritage-950 hover:bg-white border border-gold-300 shadow-glow-gold',
      secondary:
        'btn-luxury text-gold-300 hover:text-white hover:border-gold-400/50',
      accent:
        'bg-vinea-900 border border-vinea-800 text-vinea-400 hover:bg-vinea-800',
      ghost: 'text-heritage-300 hover:text-white hover:bg-white/5',
      danger: 'bg-red-900/50 border border-red-500/30 text-red-400 hover:bg-red-900'
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={ariaLabel || label}
        aria-busy={showLoading}
        className={`${baseClasses} ${variants[variant]} ${className}`}
      >
        {showLoading ? (
          <span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        ) : (
          icon && (
            <span className="w-4 h-4" aria-hidden="true">
              {icon}
            </span>
          )
        )}
        <span>{label}</span>
      </button>
    );
  })
);

// ============================================================================
// CARD
// ============================================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

/**
 * Carte container générique
 */
export const Card = memo(function Card({
  children,
  className = '',
  title,
  action
}: CardProps) {
  return (
    <div className={`glass-card rounded-xl p-6 ${className}`}>
      {(title || action) && (
        <div className="flex justify-between items-center mb-6 pb-2 border-b border-white/5">
          {title && (
            <h3 className="text-xs font-bold text-gold-400 uppercase tracking-[0.2em] font-display">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
});

// ============================================================================
// HEADER
// ============================================================================

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

/**
 * En-tête de l'application
 */
export const Header = memo(function Header({
  title,
  subtitle,
  onMenuClick
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-24 bg-gradient-to-b from-heritage-950 via-heritage-950/90 to-transparent backdrop-blur-md">
      <div className="max-w-md mx-auto h-full flex justify-between items-start pt-6 px-6">
        <div className="flex gap-4 items-center">
          <div className="p-2 bg-heritage-900/50 rounded-lg border border-white/5 backdrop-blur">
            <VelumLogo size={28} id="header" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-white tracking-[0.2em] leading-none">
              {title || 'VELUM'}
            </h1>
            <p className="font-serif italic text-xs text-gold-400/80 mt-1">
              {subtitle || 'Cabinet de Curiosités'}
            </p>
          </div>
        </div>

        <button
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 hover:bg-gold-500/10 hover:border-gold-500/30 transition-all text-white/70 hover:text-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
});

// ============================================================================
// BADGE
// ============================================================================

interface BadgeProps {
  text: string;
  variant?: 'gold' | 'dark' | 'success' | 'warning' | 'error';
}

/**
 * Badge de catégorisation
 */
export const Badge = memo(function Badge({
  text,
  variant = 'gold'
}: BadgeProps) {
  const variants = {
    gold: 'bg-gold-500/10 text-gold-300 border-gold-500/20',
    dark: 'bg-black/50 text-heritage-300 border-white/10',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20'
  };

  return (
    <span
      className={`px-3 py-1 rounded text-[9px] font-bold tracking-[0.15em] uppercase border ${variants[variant]}`}
    >
      {text}
    </span>
  );
});

// ============================================================================
// LOADING SPINNER
// ============================================================================

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Indicateur de chargement
 */
export const LoadingSpinner = memo(function LoadingSpinner({
  size = 'md',
  className = ''
}: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  };

  return (
    <div
      className={`${sizes[size]} border-gold-500 border-t-transparent rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Chargement"
    >
      <span className="sr-only">Chargement...</span>
    </div>
  );
});

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * État vide pour les listes
 */
export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="mb-4 text-heritage-500" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-display font-bold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-heritage-400 font-serif max-w-xs mb-6">
          {description}
        </p>
      )}
      {action}
    </div>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  VelumLogoProps,
  SpotlightCardProps,
  WaxSealProps,
  ActionButtonProps,
  CardProps,
  HeaderProps,
  BadgeProps,
  LoadingSpinnerProps,
  EmptyStateProps
};
