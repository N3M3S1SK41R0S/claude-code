/**
 * VELUM - Vue Maps avec Grounding
 * Version corrigée avec gestion d'état, debounce et accessibilité
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  useId
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Search,
  Compass,
  ExternalLink,
  Loader2,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { groundedMapsSearch } from '../services/geminiService';
import { SpotlightCard, ActionButton } from './Shared';
import { useToast } from './Toast';
import type { GroundingSource } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface MapsViewProps {
  onClose?: () => void;
}

interface SearchResult {
  text: string;
  sources: GroundingSource[];
}

type SearchState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_QUERY = 'Ventes aux enchères et numismates à proximité';
const DEBOUNCE_DELAY = 500;
const DEFAULT_LOCATION = { lat: 48.8566, lng: 2.3522 }; // Paris

// ============================================================================
// MAPS VIEW COMPONENT
// ============================================================================

export const MapsView = memo(function MapsView({ onClose }: MapsViewProps) {
  const toast = useToast();
  const inputId = useId();

  // State
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Obtient la localisation de l'utilisateur
   */
  const getUserLocation = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          setUserLocation(location);
          resolve(location);
        },
        () => {
          toast.info('Localisation non disponible, recherche globale.');
          resolve(null);
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    });
  }, [toast]);

  /**
   * Effectue la recherche
   */
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      // Annuler la recherche précédente
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setSearchState('loading');

      try {
        // Obtenir la localisation si pas encore fait
        let location = userLocation;
        if (!location) {
          location = await getUserLocation();
        }

        const res = await groundedMapsSearch(
          searchQuery,
          location?.lat,
          location?.lng,
          abortControllerRef.current.signal
        );

        setResults(res);
        setSearchState('success');
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;

        console.error('[MapsView] Search failed:', error);
        toast.error('Erreur de recherche Maps.');
        setSearchState('error');
      }
    },
    [userLocation, getUserLocation, toast]
  );

  /**
   * Gère la soumission du formulaire
   */
  const handleSearch = useCallback(() => {
    performSearch(query);
  }, [performSearch, query]);

  /**
   * Gère le changement de l'input avec debounce
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      // Debounce la recherche automatique
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (value.trim().length > 3) {
        debounceRef.current = setTimeout(() => {
          performSearch(value);
        }, DEBOUNCE_DELAY);
      }
    },
    [performSearch]
  );

  /**
   * Gère les touches clavier
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Annuler le debounce
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        handleSearch();
      }
    },
    [handleSearch]
  );

  // Recherche initiale
  useEffect(() => {
    performSearch(DEFAULT_QUERY);

    return () => {
      abortControllerRef.current?.abort();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  /**
   * Rendu du contenu des résultats
   */
  const renderResults = () => {
    if (searchState === 'loading') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="py-20 flex flex-col items-center justify-center gap-4"
        >
          <Compass
            className="text-gold-400 motion-safe:animate-spin-slow"
            size={40}
            aria-hidden="true"
          />
          <p className="text-[10px] font-display font-bold tracking-[0.2em] text-heritage-500 uppercase">
            Cartographie en cours...
          </p>
        </motion.div>
      );
    }

    if (searchState === 'error') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-20 flex flex-col items-center justify-center gap-4"
        >
          <p className="text-heritage-400 text-sm">
            Une erreur est survenue. Veuillez réessayer.
          </p>
          <ActionButton
            onClick={handleSearch}
            label="Réessayer"
            icon={<RefreshCw size={14} />}
            variant="secondary"
            compact
          />
        </motion.div>
      );
    }

    if (!results) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Analysis Text */}
        <SpotlightCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-gold-400" size={14} aria-hidden="true" />
            <h3 className="text-xs font-display font-bold uppercase tracking-widest text-gold-300">
              Analyse de Proximité
            </h3>
          </div>
          <div className="text-heritage-200 font-serif text-base leading-relaxed whitespace-pre-wrap">
            {results.text || 'Aucun résultat trouvé pour cette recherche.'}
          </div>
        </SpotlightCard>

        {/* Sources/Locations */}
        {results.sources.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-[10px] font-display font-bold uppercase tracking-widest text-heritage-500">
              Lieux Identifiés
            </h4>
            {results.sources.map((source, i) => (
              <SpotlightCard key={`source-${i}`} className="group">
                <div className="flex justify-between items-start p-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-bold text-white group-hover:text-gold-400 transition-colors truncate">
                      {source.maps?.title || source.web?.title || 'Lieu'}
                    </p>
                    {source.maps?.address && (
                      <p className="text-[10px] text-heritage-400 font-serif italic truncate">
                        {source.maps.address}
                      </p>
                    )}
                  </div>
                  <a
                    href={source.maps?.uri || source.web?.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ouvrir ${source.maps?.title || source.web?.title || 'ce lieu'} dans un nouvel onglet`}
                    className="p-2 bg-white/5 rounded-full text-heritage-500 hover:text-gold-400 transition-all border border-transparent hover:border-gold-500/30 focus:outline-none focus:ring-2 focus:ring-gold-500/50 shrink-0 ml-2"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </div>
              </SpotlightCard>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="pt-32 px-6 pb-32 min-h-screen">
      <div className="space-y-8 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-display font-bold text-white tracking-widest uppercase flex items-center justify-center gap-3">
            <MapPin className="text-gold-400" aria-hidden="true" /> Patrimoine Local
          </h2>
          <p className="text-xs text-heritage-400 font-serif italic">
            Découvrez les lieux d'exception pour vos collections.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative group">
          <label htmlFor={inputId} className="sr-only">
            Rechercher des lieux
          </label>
          <input
            id={inputId}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="w-full bg-heritage-900/80 border border-white/10 rounded-full px-6 py-4 text-xs font-serif text-heritage-100 focus:border-gold-500/50 outline-none transition-all pr-14"
            placeholder="Rechercher des boutiques, musées..."
          />
          <button
            onClick={handleSearch}
            disabled={searchState === 'loading'}
            aria-label="Lancer la recherche"
            className="absolute right-2 top-2 w-10 h-10 rounded-full bg-gold-500 text-black flex items-center justify-center hover:scale-105 transition-transform shadow-glow-gold disabled:opacity-50 disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          >
            {searchState === 'loading' ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Location Status */}
        {userLocation && (
          <p className="text-[9px] text-heritage-500 text-center font-mono">
            📍 Position: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
          </p>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">{renderResults()}</AnimatePresence>
      </div>
    </div>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export type { MapsViewProps };
