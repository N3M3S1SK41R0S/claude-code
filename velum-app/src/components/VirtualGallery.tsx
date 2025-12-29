/**
 * VELUM - Galerie Virtuelle (Chronosphere)
 * Version corrigée avec lazy loading, accessibilité et optimisations
 */

import React, { useState, useRef, useMemo, memo } from 'react';
import { motion, useScroll } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { CollectorItem } from '../types';
import { TiltCard, usePrefersReducedMotion } from './Animations';
import { WaxSeal, EmptyState } from './Shared';

// ============================================================================
// TYPES
// ============================================================================

interface VirtualGalleryProps {
  items: CollectorItem[];
  onClose: () => void;
  onSelectItem?: (item: CollectorItem) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_STARS = 30; // Limiter pour la performance

// ============================================================================
// VIRTUAL GALLERY COMPONENT
// ============================================================================

export const VirtualGallery = memo(function VirtualGallery({
  items,
  onClose,
  onSelectItem
}: VirtualGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced = usePrefersReducedMotion();
  const { scrollXProgress } = useScroll({
    container: containerRef,
    axis: 'x'
  });

  // Générer les étoiles de façon stable
  const stars = useMemo(
    () =>
      Array.from({ length: MAX_STARS }).map((_, i) => ({
        id: i,
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 5
      })),
    []
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black text-white flex flex-col"
      role="dialog"
      aria-label="Galerie virtuelle"
      aria-modal="true"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black to-transparent">
        <button
          onClick={onClose}
          aria-label="Fermer la galerie"
          className="p-3 bg-white/10 rounded-full hover:bg-gold-500/20 transition-all border border-white/10 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="text-2xl font-display font-bold tracking-[0.3em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-gold-300 to-gold-600">
          CHRONOSPHERE
        </h2>
        <div className="w-10" aria-hidden="true" />
      </div>

      {/* Ambient Background */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {!prefersReduced &&
          stars.map((s) => (
            <motion.div
              key={s.id}
              className="absolute rounded-full bg-white"
              style={{ left: s.x, top: s.y, width: s.size, height: s.size }}
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 3, delay: s.delay, repeat: Infinity }}
            />
          ))}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-gold-900/10 to-transparent" />
      </div>

      {/* Gallery Content */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <EmptyState
            icon={<Sparkles size={48} />}
            title="Chronosphère Vide"
            description="Scannez des artefacts pour peupler votre galerie virtuelle."
          />
        </div>
      ) : (
        <>
          {/* Horizontal Scroll Container */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center overflow-x-auto snap-x snap-mandatory scrollbar-hide px-[20vw]"
            role="list"
            aria-label="Collection d'objets"
            tabIndex={0}
          >
            <div className="flex gap-20 py-20 items-center">
              {items.map((item, i) => (
                <GalleryItem
                  key={item.id}
                  item={item}
                  index={i}
                  onClick={onSelectItem}
                />
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div
            className="absolute bottom-10 left-10 right-10 h-1 bg-white/10 rounded-full overflow-hidden"
            role="progressbar"
            aria-label="Progression dans la galerie"
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className="h-full bg-gold-500 shadow-glow-gold"
              style={{ scaleX: scrollXProgress, transformOrigin: 'left' }}
            />
          </div>
        </>
      )}
    </div>
  );
});

// ============================================================================
// GALLERY ITEM
// ============================================================================

interface GalleryItemProps {
  item: CollectorItem;
  index: number;
  onClick?: (item: CollectorItem) => void;
}

const GalleryItem = memo(function GalleryItem({
  item,
  index,
  onClick
}: GalleryItemProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const prefersReduced = usePrefersReducedMotion();

  const handleClick = () => {
    onClick?.(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(item);
    }
  };

  const Container = prefersReduced ? 'div' : motion.div;
  const containerProps = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1 },
        transition: { delay: index * 0.1 }
      };

  return (
    <Container
      {...containerProps}
      className="snap-center shrink-0 w-[280px] md:w-[350px] aspect-[3/4] perspective-1000"
      role="listitem"
    >
      <TiltCard className="w-full h-full rounded-[2rem] relative overflow-hidden group shadow-2xl border border-white/10 bg-gradient-to-br from-heritage-900 to-black">
        <button
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className="w-full h-full text-left focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-inset rounded-[2rem]"
          aria-label={`Voir ${item.title}`}
        >
          {/* Image */}
          {!imageError ? (
            <img
              src={item.imageUrl}
              alt={`${item.title} - ${item.type} de ${item.country}, ${item.year}`}
              className={`w-full h-full object-cover transition-opacity duration-700 ${
                imageLoaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-heritage-800 flex items-center justify-center">
              <span className="text-heritage-500 text-xs">Image non disponible</span>
            </div>
          )}

          {/* Loading placeholder */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-heritage-900 animate-pulse" />
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"
            aria-hidden="true"
          />

          {/* Holographic Border */}
          <div
            className="absolute inset-0 border border-gold-500/30 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          />

          {/* Wax Seal */}
          <div className="absolute top-4 right-4">
            <WaxSeal
              verified={(item.expertAnalysis?.deepData?.authenticityScore || 0) > 70}
              size="sm"
            />
          </div>

          {/* Info */}
          <div className="absolute bottom-8 left-6 right-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <div
              className="h-[1px] w-10 bg-gold-500 mb-4"
              aria-hidden="true"
            />
            <h3 className="text-2xl font-display font-bold text-white uppercase leading-none mb-1">
              {item.title}
            </h3>
            <p className="text-gold-400 font-serif italic text-sm">
              {item.country}, {item.year}
            </p>
            <p className="text-white/60 text-[10px] mt-2 font-mono tracking-widest">
              {item.value.toLocaleString('fr-FR')} EUR • {item.condition}
            </p>
          </div>
        </button>
      </TiltCard>

      {/* Reflection Effect (decorative) */}
      <div
        className="absolute top-full left-0 right-0 h-20 opacity-20 pointer-events-none overflow-hidden"
        aria-hidden="true"
        style={{
          transform: 'scaleY(-0.3)',
          maskImage: 'linear-gradient(to bottom, black, transparent)'
        }}
      >
        {imageLoaded && !imageError && (
          <img
            src={item.imageUrl}
            alt=""
            className="w-full h-full object-cover blur-sm"
          />
        )}
      </div>
    </Container>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export type { VirtualGalleryProps };
