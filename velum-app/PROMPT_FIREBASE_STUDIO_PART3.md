# PROMPT COMPLET - PARTIE 3 (FINALE)

## FICHIER 12: src/components/VirtualGallery.tsx

```typescript
/**
 * VELUM - Galerie Virtuelle 3D
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import type { CollectorItem } from '../types';

interface VirtualGalleryProps {
  items: CollectorItem[];
  onSelectItem?: (item: CollectorItem) => void;
  onClose: () => void;
}

export const VirtualGallery: React.FC<VirtualGalleryProps> = ({
  items,
  onSelectItem,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const currentItem = items[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % items.length);
  }, [items.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const handleImageError = useCallback((itemId: string) => {
    setImageErrors(prev => new Set(prev).add(itemId));
  }, []);

  const handleSelect = useCallback(() => {
    if (currentItem && onSelectItem) {
      onSelectItem(currentItem);
    }
  }, [currentItem, onSelectItem]);

  // Generate stars (limited for performance)
  const stars = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 3
  }));

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-heritage-950 flex items-center justify-center">
        <p className="text-heritage-400">Aucun objet dans la galerie</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-heritage-950 overflow-hidden"
    >
      {/* Stars background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {stars.map(star => (
          <motion.div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size
            }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 2,
              delay: star.delay,
              repeat: Infinity
            }}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 bg-heritage-800/80 rounded-full text-heritage-300 hover:text-white transition-colors"
        aria-label="Fermer la galerie"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main display */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.8, rotateY: 30 }}
          transition={{ type: 'spring', damping: 20 }}
          className={`relative ${isFullscreen ? 'w-full h-full' : 'max-w-2xl max-h-[70vh]'}`}
          style={{ perspective: '1000px' }}
        >
          {/* Frame */}
          <div className="relative bg-gradient-to-br from-gold-600 via-gold-500 to-gold-700 p-4 rounded-lg shadow-2xl">
            <div className="bg-heritage-900 p-2 rounded">
              {imageErrors.has(currentItem.id) ? (
                <div className="aspect-square flex items-center justify-center bg-heritage-800 rounded">
                  <span className="text-heritage-500">Image non disponible</span>
                </div>
              ) : (
                <img
                  src={currentItem.imageUrl}
                  alt={currentItem.name}
                  className="w-full h-auto rounded object-contain max-h-[60vh]"
                  loading="lazy"
                  onError={() => handleImageError(currentItem.id)}
                />
              )}
            </div>
          </div>

          {/* Info plaque */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-heritage-800/90 backdrop-blur-sm px-6 py-3 rounded-lg border border-gold-500/30 text-center min-w-[200px]"
          >
            <h3 className="font-display text-gold-500 text-lg">{currentItem.name}</h3>
            <p className="text-heritage-400 text-sm">{currentItem.category}</p>
          </motion.div>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-2 right-2 p-2 bg-heritage-900/80 rounded-full text-heritage-300 hover:text-white transition-colors"
            aria-label={isFullscreen ? 'Réduire' : 'Plein écran'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <button
          onClick={goPrev}
          className="p-3 bg-heritage-800/80 rounded-full text-heritage-300 hover:text-white hover:bg-heritage-700 transition-all"
          aria-label="Précédent"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-gold-500 w-4'
                  : 'bg-heritage-600 hover:bg-heritage-500'
              }`}
              aria-label={`Aller à ${item.name}`}
              aria-current={index === currentIndex ? 'true' : undefined}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="p-3 bg-heritage-800/80 rounded-full text-heritage-300 hover:text-white hover:bg-heritage-700 transition-all"
          aria-label="Suivant"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Click to select */}
      {onSelectItem && (
        <button
          onClick={handleSelect}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-gold-500 text-black rounded-lg font-medium hover:bg-gold-400 transition-colors"
        >
          Sélectionner cet objet
        </button>
      )}
    </motion.div>
  );
};
```

---

## FICHIER 13: src/components/AuctionRoom.tsx

```typescript
/**
 * VELUM - Salle des Enchères
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gavel, MapPin, Calendar, TrendingUp, ExternalLink, Loader2 } from 'lucide-react';
import { generateAuctionStrategy } from '../services/geminiService';
import { ActionButton, LoadingSpinner, SpotlightCard } from './Shared';
import type { CollectorItem, AuctionStrategy } from '../types';

interface AuctionRoomProps {
  item: CollectorItem;
  onClose: () => void;
}

export const AuctionRoom: React.FC<AuctionRoomProps> = ({ item, onClose }) => {
  const [strategy, setStrategy] = useState<AuctionStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState<string>('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Fallback to Paris
          setLocation({ lat: 48.8566, lng: 2.3522 });
        }
      );
    } else {
      setLocation({ lat: 48.8566, lng: 2.3522 });
    }
  }, []);

  // Generate strategy
  const generateStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const budgetNum = budget ? parseFloat(budget) : undefined;
      const result = await generateAuctionStrategy(item, location || undefined, budgetNum);
      setStrategy(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  }, [item, location, budget]);

  // Initial load
  useEffect(() => {
    if (location) {
      generateStrategy();
    }
  }, [location]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-heritage-950/95 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Gavel className="w-8 h-8 text-gold-500" />
            <div>
              <h2 className="text-2xl font-display text-gold-500">Salle des Enchères</h2>
              <p className="text-heritage-400">{item.name}</p>
            </div>
          </div>
          <ActionButton onClick={onClose} variant="ghost">
            Fermer
          </ActionButton>
        </div>

        {/* Budget input */}
        <div className="mb-6">
          <label className="block text-sm text-heritage-400 mb-2">Budget maximum (optionnel)</label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={budget}
              onChange={e => setBudget(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Ex: 10000"
              className="flex-1 bg-heritage-800 border border-heritage-600 rounded-lg px-4 py-2 text-heritage-100 focus:outline-none focus:border-gold-500"
            />
            <ActionButton onClick={generateStrategy} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualiser'}
            </ActionButton>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner text="Analyse du marché en cours..." />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-red-400">{error}</p>
            <ActionButton onClick={generateStrategy} variant="secondary" className="mt-4">
              Réessayer
            </ActionButton>
          </div>
        )}

        {/* Strategy */}
        {strategy && !loading && (
          <div className="space-y-6">
            {/* Bidding Strategy */}
            <SpotlightCard className="p-6">
              <h3 className="text-lg font-display text-gold-500 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Stratégie d'Enchères
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-heritage-500">Lieu recommandé</p>
                  <p className="text-heritage-200 font-medium">{strategy.biddingStrategy.recommendedVenue}</p>
                </div>
                <div>
                  <p className="text-sm text-heritage-500">Timing optimal</p>
                  <p className="text-heritage-200">{strategy.biddingStrategy.timing}</p>
                </div>
                <div>
                  <p className="text-sm text-heritage-500">Enchère maximale suggérée</p>
                  <p className="text-gold-500 font-bold text-xl">
                    {strategy.biddingStrategy.maxBid.toLocaleString('fr-FR')} €
                  </p>
                </div>
                <div>
                  <p className="text-sm text-heritage-500">Prix de retrait</p>
                  <p className="text-heritage-200">
                    {strategy.biddingStrategy.walkAwayPrice.toLocaleString('fr-FR')} €
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-heritage-500 mb-2">Tactiques</p>
                <ul className="space-y-1">
                  {strategy.biddingStrategy.tactics.map((tactic, i) => (
                    <li key={i} className="text-heritage-300 text-sm flex items-start gap-2">
                      <span className="text-gold-500">•</span>
                      {tactic}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 text-heritage-400 text-sm italic">{strategy.biddingStrategy.reasoning}</p>
            </SpotlightCard>

            {/* Upcoming Auctions */}
            <SpotlightCard className="p-6">
              <h3 className="text-lg font-display text-gold-500 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Prochaines Ventes
              </h3>
              <div className="space-y-3">
                {strategy.marketContext.upcomingAuctions.map((auction, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-heritage-800/50 rounded-lg">
                    <div>
                      <p className="text-heritage-200 font-medium">{auction.house}</p>
                      <p className="text-sm text-heritage-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {auction.location} - {auction.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gold-500">{auction.relevantLots} lots pertinents</p>
                    </div>
                  </div>
                ))}
              </div>
            </SpotlightCard>

            {/* Alternatives */}
            <SpotlightCard className="p-6">
              <h3 className="text-lg font-display text-gold-500 mb-4">Alternatives</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {strategy.alternatives.map((alt, i) => (
                  <div key={i} className="p-4 bg-heritage-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-heritage-200">{alt.venue}</span>
                      <span className="text-xs px-2 py-1 bg-heritage-700 rounded text-heritage-300">
                        {alt.type}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {alt.pros.map((pro, j) => (
                        <p key={j} className="text-sm text-green-400">+ {pro}</p>
                      ))}
                      {alt.cons.map((con, j) => (
                        <p key={j} className="text-sm text-red-400">- {con}</p>
                      ))}
                    </div>
                    <p className="mt-2 text-gold-500 font-medium">
                      Net estimé: {alt.estimatedNet.toLocaleString('fr-FR')} €
                    </p>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </div>
        )}
      </div>
    </motion.div>
  );
};
```

---

## FICHIER 14: src/components/MapsView.tsx

```typescript
/**
 * VELUM - Vue Cartes avec Recherche Grounded
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Search, ExternalLink, Loader2, X } from 'lucide-react';
import { groundedMapsSearch } from '../services/geminiService';
import { ActionButton, SpotlightCard } from './Shared';
import type { SearchSource } from '../types';

interface MapsViewProps {
  onClose: () => void;
}

export const MapsView: React.FC<MapsViewProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ text: string; sources: SearchSource[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);

  // Get location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation({ lat: 48.8566, lng: 2.3522 })
      );
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Search
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const result = await groundedMapsSearch(searchQuery, location || undefined);
      setResults(result);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[MapsView]', err);
      }
    } finally {
      setLoading(false);
    }
  }, [location]);

  // Debounced search
  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim().length > 2) {
        search(value);
      }
    }, 500);
  }, [search]);

  // Quick searches
  const quickSearches = [
    'Antiquaires près de moi',
    'Maisons de vente aux enchères',
    'Experts en art',
    'Restaurateurs d\'antiquités',
    'Musées d\'art décoratif'
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-heritage-950/95 overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-gold-500" />
            <h2 className="text-2xl font-display text-gold-500">Découvrir</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-heritage-400 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-heritage-500" />
          <input
            type="text"
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            placeholder="Rechercher antiquaires, ventes, experts..."
            className="w-full bg-heritage-800 border border-heritage-600 rounded-xl pl-12 pr-4 py-3 text-heritage-100 placeholder-heritage-500 focus:outline-none focus:border-gold-500"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-500 animate-spin" />
          )}
        </div>

        {/* Quick searches */}
        <div className="flex flex-wrap gap-2 mb-6">
          {quickSearches.map((qs, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(qs);
                search(qs);
              }}
              className="px-3 py-1.5 bg-heritage-800 text-heritage-300 rounded-full text-sm hover:bg-heritage-700 hover:text-white transition-colors"
            >
              {qs}
            </button>
          ))}
        </div>

        {/* Results */}
        {results && (
          <SpotlightCard className="p-6">
            <div className="prose prose-invert max-w-none">
              <p className="text-heritage-200 whitespace-pre-wrap">{results.text}</p>
            </div>

            {results.sources.length > 0 && (
              <div className="mt-6 pt-6 border-t border-heritage-700">
                <h3 className="text-sm text-heritage-500 mb-3">Sources</h3>
                <div className="space-y-2">
                  {results.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-3 bg-heritage-800/50 rounded-lg hover:bg-heritage-700/50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gold-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-heritage-200 font-medium">{source.title}</p>
                        {source.snippet && (
                          <p className="text-heritage-400 text-sm line-clamp-2">{source.snippet}</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </SpotlightCard>
        )}

        {/* Location indicator */}
        {location && (
          <p className="text-center text-heritage-500 text-sm mt-6">
            📍 Recherche autour de votre position
          </p>
        )}
      </div>
    </motion.div>
  );
};
```

---

## FICHIER 15: src/components/CreativeStudio.tsx

```typescript
/**
 * VELUM - Studio Créatif
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Image, Video, Sparkles, Upload, X, Download, Loader2 } from 'lucide-react';
import { generateProImage, generateVeoVideo, revokeObjectURL, createObjectURL } from '../services/geminiService';
import { ActionButton, SpotlightCard } from './Shared';
import type { CollectorItem } from '../types';

// ============================================================================
// TYPES
// ============================================================================

type CreativeMode = 'image' | 'video' | 'style';

interface CreativeStudioProps {
  currentItem?: CollectorItem;
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const STYLE_PRESETS = [
  { id: 'museum', label: 'Musée', prompt: 'exposition dans un musée prestigieux, éclairage muséal' },
  { id: 'baroque', label: 'Baroque', prompt: 'style baroque, dorures, velours rouge, opulent' },
  { id: 'minimal', label: 'Minimaliste', prompt: 'fond blanc épuré, ombres douces, moderne' },
  { id: 'vintage', label: 'Vintage', prompt: 'photographie ancienne, sépia, grain argentique' },
  { id: 'dramatic', label: 'Dramatique', prompt: 'clair-obscur, lumière dramatique, fond noir' }
];

// ============================================================================
// COMPONENT
// ============================================================================

export const CreativeStudio: React.FC<CreativeStudioProps> = ({ currentItem, onClose }) => {
  const [mode, setMode] = useState<CreativeMode>('image');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // File upload handler
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format non supporté. Utilisez JPEG, PNG ou WebP.');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setError('Fichier trop volumineux. Maximum 10MB.');
      return;
    }

    // Cleanup previous
    if (sourceImage) {
      revokeObjectURL(sourceImage);
    }

    const url = createObjectURL(file);
    setSourceImage(url);
    setError(null);
  }, [sourceImage]);

  // Generate
  const generate = useCallback(async () => {
    if (!prompt.trim() && !currentItem) {
      setError('Entrez une description ou sélectionnez un objet.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    abortRef.current = new AbortController();

    try {
      const fullPrompt = currentItem
        ? `${currentItem.name}: ${currentItem.description}. ${prompt}`
        : prompt;

      const stylePrompt = selectedStyle
        ? STYLE_PRESETS.find(s => s.id === selectedStyle)?.prompt
        : undefined;

      if (mode === 'video') {
        const videoUrl = await generateVeoVideo(fullPrompt, sourceImage || undefined);
        setResult(videoUrl);
      } else {
        const imageUrl = await generateProImage(fullPrompt, stylePrompt);
        setResult(imageUrl);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Erreur lors de la génération.');
      }
    } finally {
      setLoading(false);
    }
  }, [prompt, currentItem, selectedStyle, mode, sourceImage]);

  // Cancel
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  // Download result
  const downloadResult = useCallback(() => {
    if (!result) return;

    const link = document.createElement('a');
    link.href = result;
    link.download = `velum-${mode}-${Date.now()}.${mode === 'video' ? 'mp4' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [result, mode]);

  // Cleanup
  React.useEffect(() => {
    return () => {
      if (sourceImage) revokeObjectURL(sourceImage);
      abortRef.current?.abort();
    };
  }, [sourceImage]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-heritage-950/95 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Wand2 className="w-8 h-8 text-gold-500" />
            <h2 className="text-2xl font-display text-gold-500">Studio Créatif</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-heritage-400 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-6" role="tablist">
          {[
            { id: 'image', icon: Image, label: 'Image' },
            { id: 'video', icon: Video, label: 'Vidéo' },
            { id: 'style', icon: Sparkles, label: 'Style' }
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setMode(id as CreativeMode)}
              role="tab"
              aria-selected={mode === id}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                mode === id
                  ? 'bg-gold-500 text-black'
                  : 'bg-heritage-800 text-heritage-300 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input panel */}
          <SpotlightCard className="p-6">
            {/* Current item preview */}
            {currentItem && (
              <div className="mb-4 p-3 bg-heritage-800/50 rounded-lg flex items-center gap-3">
                <img
                  src={currentItem.imageUrl}
                  alt={currentItem.name}
                  className="w-12 h-12 rounded object-cover"
                />
                <div>
                  <p className="text-heritage-200 font-medium">{currentItem.name}</p>
                  <p className="text-heritage-500 text-sm">Objet sélectionné</p>
                </div>
              </div>
            )}

            {/* Prompt */}
            <div className="mb-4">
              <label className="block text-sm text-heritage-400 mb-2">Description</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Décrivez l'image ou la vidéo souhaitée..."
                rows={4}
                className="w-full bg-heritage-800 border border-heritage-600 rounded-lg px-4 py-2 text-heritage-100 placeholder-heritage-500 focus:outline-none focus:border-gold-500 resize-none"
              />
            </div>

            {/* Style presets */}
            {mode === 'style' && (
              <div className="mb-4">
                <label className="block text-sm text-heritage-400 mb-2">Style prédéfini</label>
                <div className="flex flex-wrap gap-2">
                  {STYLE_PRESETS.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        selectedStyle === style.id
                          ? 'bg-gold-500 text-black'
                          : 'bg-heritage-700 text-heritage-300 hover:bg-heritage-600'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Source image upload */}
            {mode === 'video' && (
              <div className="mb-4">
                <label className="block text-sm text-heritage-400 mb-2">Image source (optionnel)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {sourceImage ? (
                  <div className="relative">
                    <img
                      src={sourceImage}
                      alt="Source"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => {
                        if (sourceImage) revokeObjectURL(sourceImage);
                        setSourceImage(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-heritage-900/80 rounded-full text-heritage-300 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-heritage-600 rounded-lg flex flex-col items-center justify-center text-heritage-500 hover:border-gold-500 hover:text-gold-500 transition-colors"
                  >
                    <Upload className="w-6 h-6 mb-2" />
                    <span className="text-sm">Télécharger une image</span>
                  </button>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            {/* Generate button */}
            <div className="flex gap-2">
              <ActionButton
                onClick={generate}
                disabled={loading}
                loading={loading}
                className="flex-1"
              >
                {loading ? 'Génération...' : 'Générer'}
              </ActionButton>
              {loading && (
                <ActionButton onClick={cancel} variant="secondary">
                  Annuler
                </ActionButton>
              )}
            </div>
          </SpotlightCard>

          {/* Result panel */}
          <SpotlightCard className="p-6">
            <h3 className="text-lg font-display text-gold-500 mb-4">Résultat</h3>

            {loading && (
              <div className="aspect-square flex items-center justify-center bg-heritage-800/50 rounded-lg">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-2" />
                  <p className="text-heritage-400 text-sm">
                    {mode === 'video' ? 'Génération vidéo (1-2 min)...' : 'Génération image...'}
                  </p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div>
                {mode === 'video' ? (
                  <video
                    src={result}
                    controls
                    className="w-full rounded-lg"
                  />
                ) : (
                  <img
                    src={result}
                    alt="Résultat généré"
                    className="w-full rounded-lg"
                  />
                )}
                <ActionButton
                  onClick={downloadResult}
                  variant="secondary"
                  icon={<Download className="w-4 h-4" />}
                  className="w-full mt-4"
                >
                  Télécharger
                </ActionButton>
              </div>
            )}

            {!result && !loading && (
              <div className="aspect-square flex items-center justify-center bg-heritage-800/50 rounded-lg text-heritage-500">
                <p>Le résultat apparaîtra ici</p>
              </div>
            )}
          </SpotlightCard>
        </div>
      </div>
    </motion.div>
  );
};
```

---

## FICHIER 16: src/App.tsx

```typescript
/**
 * VELUM - Application Principale
 */

import React, { useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera, MessageCircle, Mic, Gavel, Map, Image, Wand2, Plus, ChevronRight,
  TrendingUp, Shield, Clock
} from 'lucide-react';

// Components
import { VelumLogo, ActionButton, SpotlightCard, LoadingSpinner, EmptyState } from './components/Shared';
import { ToastProvider, useToast } from './components/Toast';
import { Scanner } from './components/Scanner';
import { ChatBot } from './components/ChatBot';
import { LiveAssistant } from './components/LiveAssistant';
import { AuctionRoom } from './components/AuctionRoom';
import { MapsView } from './components/MapsView';
import { VirtualGallery } from './components/VirtualGallery';
import { CreativeStudio } from './components/CreativeStudio';
import { FadeIn, CursorTrail, useParticleBurst } from './components/Animations';

// Types
import type { CollectorItem, ViewType } from './types';

// ============================================================================
// ITEM DETAIL VIEW
// ============================================================================

interface ItemDetailProps {
  item: CollectorItem;
  onBack: () => void;
  onAnalyze: () => void;
  onFinancial: () => void;
  onAuction: () => void;
}

const ItemDetailView = React.memo<ItemDetailProps>(({
  item,
  onBack,
  onAnalyze,
  onFinancial,
  onAuction
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-heritage-400 hover:text-white mb-6 transition-colors"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        Retour à la collection
      </button>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="relative">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full rounded-xl shadow-2xl"
          />
        </div>

        {/* Details */}
        <div>
          <h1 className="text-3xl font-display text-gold-500 mb-2">{item.name}</h1>
          <p className="text-heritage-400 mb-6">{item.category}</p>
          <p className="text-heritage-200 mb-8">{item.description}</p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center p-4 bg-heritage-800/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-gold-500 mx-auto mb-2" />
              <p className="text-heritage-400 text-sm">Estimation</p>
              <p className="text-gold-500 font-bold">
                {item.currentEstimate?.toLocaleString('fr-FR') || '—'} €
              </p>
            </div>
            <div className="text-center p-4 bg-heritage-800/50 rounded-lg">
              <Shield className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-heritage-400 text-sm">Condition</p>
              <p className="text-heritage-200 font-medium capitalize">{item.condition || '—'}</p>
            </div>
            <div className="text-center p-4 bg-heritage-800/50 rounded-lg">
              <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-heritage-400 text-sm">Acquisition</p>
              <p className="text-heritage-200">{item.acquisitionDate || '—'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <ActionButton onClick={onAnalyze} icon={<Camera className="w-4 h-4" />}>
              Analyser
            </ActionButton>
            <ActionButton onClick={onFinancial} variant="secondary" icon={<TrendingUp className="w-4 h-4" />}>
              Thèse Financière
            </ActionButton>
            <ActionButton onClick={onAuction} variant="secondary" icon={<Gavel className="w-4 h-4" />}>
              Stratégie Enchères
            </ActionButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

ItemDetailView.displayName = 'ItemDetailView';

// ============================================================================
// MAIN APP
// ============================================================================

const AppContent: React.FC = () => {
  const { addToast } = useToast();
  const { trigger: triggerBurst, Component: ParticleBurstComponent } = useParticleBurst();

  // State
  const [view, setView] = useState<ViewType>('collection');
  const [items, setItems] = useState<CollectorItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CollectorItem | null>(null);
  const [loading, setLoading] = useState(false);

  // Navigation handlers
  const openScanner = useCallback(() => setView('scanner'), []);
  const openChat = useCallback(() => setView('chat'), []);
  const openLive = useCallback(() => setView('live'), []);
  const openAuction = useCallback(() => {
    if (selectedItem) setView('auction');
    else addToast({ type: 'warning', title: 'Sélectionnez d\'abord un objet' });
  }, [selectedItem, addToast]);
  const openMaps = useCallback(() => setView('maps'), []);
  const openGallery = useCallback(() => setView('gallery'), []);
  const openCreative = useCallback(() => setView('creative'), []);

  const closeOverlay = useCallback(() => setView('collection'), []);

  const selectItem = useCallback((item: CollectorItem) => {
    setSelectedItem(item);
    setView('detail');
  }, []);

  // Handle scanner capture
  const handleCapture = useCallback((imageBase64: string, analysis?: string) => {
    const newItem: CollectorItem = {
      id: crypto.randomUUID(),
      name: 'Nouvel objet',
      description: analysis || 'Objet scanné',
      category: 'Non classé',
      imageUrl: imageBase64,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setItems(prev => [newItem, ...prev]);
    setSelectedItem(newItem);
    setView('detail');

    addToast({ type: 'success', title: 'Objet ajouté à votre collection' });
  }, [addToast]);

  // Handle gallery select
  const handleGallerySelect = useCallback((item: CollectorItem) => {
    setSelectedItem(item);
    setView('detail');
  }, []);

  // Navigation items
  const navItems = useMemo(() => [
    { id: 'scanner', icon: Camera, label: 'Scanner', action: openScanner },
    { id: 'chat', icon: MessageCircle, label: 'Chat', action: openChat },
    { id: 'live', icon: Mic, label: 'Live', action: openLive },
    { id: 'auction', icon: Gavel, label: 'Enchères', action: openAuction },
    { id: 'maps', icon: Map, label: 'Explorer', action: openMaps },
    { id: 'gallery', icon: Image, label: 'Galerie', action: openGallery },
    { id: 'creative', icon: Wand2, label: 'Créatif', action: openCreative }
  ], [openScanner, openChat, openLive, openAuction, openMaps, openGallery, openCreative]);

  return (
    <div className="min-h-screen bg-heritage-950 text-heritage-100">
      <CursorTrail />
      {ParticleBurstComponent}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-heritage-950/80 backdrop-blur-lg border-b border-heritage-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <VelumLogo />

          <nav className="hidden md:flex items-center gap-2" aria-label="Navigation principale">
            {navItems.map(({ id, icon: Icon, label, action }) => (
              <button
                key={id}
                onClick={action}
                aria-current={view === id ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  view === id
                    ? 'bg-gold-500/20 text-gold-500'
                    : 'text-heritage-400 hover:text-white hover:bg-heritage-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'collection' && (
            <motion.div
              key="collection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <FadeIn>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-display text-gold-500 mb-2">Ma Collection</h1>
                    <p className="text-heritage-400">{items.length} objets</p>
                  </div>
                  <ActionButton onClick={openScanner} icon={<Plus className="w-4 h-4" />}>
                    Ajouter
                  </ActionButton>
                </div>
              </FadeIn>

              {items.length === 0 ? (
                <EmptyState
                  icon={<Camera className="w-16 h-16" />}
                  title="Votre collection est vide"
                  description="Scannez votre premier objet pour commencer à construire votre collection."
                  action={{ label: 'Scanner un objet', onClick: openScanner }}
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((item, index) => (
                    <FadeIn key={item.id} delay={index * 0.05}>
                      <SpotlightCard
                        interactive
                        onClick={() => selectItem(item)}
                        className="overflow-hidden"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                        <div className="p-3">
                          <h3 className="font-medium text-heritage-200 truncate">{item.name}</h3>
                          <p className="text-sm text-heritage-500">{item.category}</p>
                        </div>
                      </SpotlightCard>
                    </FadeIn>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'detail' && selectedItem && (
            <ItemDetailView
              key="detail"
              item={selectedItem}
              onBack={closeOverlay}
              onAnalyze={() => addToast({ type: 'info', title: 'Analyse en cours...' })}
              onFinancial={() => addToast({ type: 'info', title: 'Génération de la thèse...' })}
              onAuction={openAuction}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Mobile navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-heritage-950/95 backdrop-blur-lg border-t border-heritage-800 px-2 py-2">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map(({ id, icon: Icon, label, action }) => (
            <button
              key={id}
              onClick={action}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${
                view === id ? 'text-gold-500' : 'text-heritage-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Overlays */}
      <AnimatePresence>
        {view === 'scanner' && (
          <Scanner onCapture={handleCapture} onClose={closeOverlay} />
        )}
        {view === 'chat' && (
          <ChatBot currentItem={selectedItem || undefined} onClose={closeOverlay} />
        )}
        {view === 'live' && (
          <LiveAssistant currentItem={selectedItem || undefined} onClose={closeOverlay} />
        )}
        {view === 'auction' && selectedItem && (
          <AuctionRoom item={selectedItem} onClose={closeOverlay} />
        )}
        {view === 'maps' && (
          <MapsView onClose={closeOverlay} />
        )}
        {view === 'gallery' && (
          <VirtualGallery items={items} onSelectItem={handleGallerySelect} onClose={closeOverlay} />
        )}
        {view === 'creative' && (
          <CreativeStudio currentItem={selectedItem || undefined} onClose={closeOverlay} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// ROOT APP WITH PROVIDERS
// ============================================================================

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
```

---

## FICHIER 17: src/index.tsx

```typescript
/**
 * VELUM - Point d'Entrée
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[VELUM] Erreur capturée:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-heritage-950 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-display text-gold-500 mb-4">
              Une erreur est survenue
            </h1>
            <p className="text-heritage-400 mb-6">
              L'application a rencontré un problème. Veuillez rafraîchir la page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs text-red-400 bg-heritage-900 p-4 rounded-lg overflow-auto mb-6">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gold-500 text-black rounded-lg font-medium hover:bg-gold-400 transition-colors"
            >
              Rafraîchir
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// RENDER
// ============================================================================

const container = document.getElementById('root');

if (!container) {
  throw new Error('Container #root non trouvé');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Console branding
console.log(
  '%c VELUM %c v5.0 ',
  'background: linear-gradient(90deg, #D4AF37, #B8860B); color: black; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
  'background: #1a1a1a; color: #D4AF37; padding: 4px 8px; border-radius: 0 4px 4px 0;'
);
```

---

## FICHIER 18: public/index.html

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="VELUM - Application d'expertise d'objets de collection avec IA Gemini" />
  <meta name="theme-color" content="#020202" />
  <title>VELUM - Expertise Collection</title>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

  <!-- Tailwind -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            gold: { 400: '#FBBF24', 500: '#D4AF37', 600: '#B8860B', 700: '#92400E' },
            heritage: { 100: '#F5F5F5', 200: '#E5E5E5', 300: '#D4D4D4', 400: '#A3A3A3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0A0A0A' }
          },
          fontFamily: { display: ['Cinzel', 'serif'], serif: ['Cormorant Garamond', 'serif'], sans: ['Inter', 'sans-serif'] },
          animation: { 'spin-slow': 'spin 20s linear infinite', 'pulse-slow': 'pulse 4s ease-in-out infinite' },
          boxShadow: { 'glow-gold': '0 0 20px rgba(212,175,55,0.3)' }
        }
      }
    };
  </script>

  <style>
    body { font-family: 'Inter', sans-serif; background: #020202; color: #F5F5F5; }
    #root:empty { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    #root:empty::after { content: ''; width: 48px; height: 48px; border: 3px solid #262626; border-top-color: #D4AF37; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; } }
  </style>
</head>
<body class="dark">
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>
</html>
```

---

## FICHIER 19: package.json

```json
{
  "name": "velum-app",
  "version": "5.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "^0.7.0",
    "framer-motion": "^11.15.0",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

---

## FICHIER 20: vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: true }
});
```

---

## FICHIER 21: tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src"]
}
```

---

# INSTRUCTIONS POUR FIREBASE STUDIO

1. **Créer un nouveau projet** dans Firebase Studio / IDX
2. **Choisir le template**: React + TypeScript + Vite
3. **Copier chaque fichier** dans l'arborescence appropriée
4. **Configurer la clé API Gemini**:
   - Créer un fichier `.env` avec: `VITE_GEMINI_API_KEY=votre_clé`
   - Ou utiliser la variable `window.GEMINI_API_KEY`
5. **Installer les dépendances**: `npm install`
6. **Lancer**: `npm run dev`

---

# C'EST COMPLET !

Tu as maintenant TOUS les fichiers nécessaires pour recréer l'application VELUM dans Firebase Studio ou tout autre environnement.
