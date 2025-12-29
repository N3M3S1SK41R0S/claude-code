/**
 * VELUM - Auction War Room
 * Version corrigée avec gestion d'erreurs, accessibilité et types stricts
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  TrendingUp,
  Gavel,
  Globe,
  Crosshair,
  AlertTriangle,
  Sparkles,
  Loader2,
  ExternalLink,
  Pencil
} from 'lucide-react';
import type { CollectorItem, AuctionStrategy } from '../types';
import { generateAuctionStrategy } from '../services/geminiService';
import { SpotlightCard, ActionButton } from './Shared';
import { HolographicGrid } from './Animations';
import { useToast } from './Toast';

// ============================================================================
// TYPES
// ============================================================================

interface AuctionRoomProps {
  item: CollectorItem;
  onClose: () => void;
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LOCATION = { lat: 48.8566, lng: 2.3522 }; // Paris

// ============================================================================
// AUCTION ROOM COMPONENT
// ============================================================================

export const AuctionRoom = memo(function AuctionRoom({
  item,
  onClose
}: AuctionRoomProps) {
  const toast = useToast();

  // State
  const [strategy, setStrategy] = useState<AuctionStrategy | null>(
    item.auctionData || null
  );
  const [loadingState, setLoadingState] = useState<LoadingState>(
    item.auctionData ? 'success' : 'loading'
  );
  const [targetPrice, setTargetPrice] = useState<string>(
    String(item.auctionData?.targetPrice || item.value || '')
  );
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * Charge la stratégie d'enchère
   */
  const loadStrategy = useCallback(async () => {
    if (item.auctionData) {
      setStrategy(item.auctionData);
      setTargetPrice(String(item.auctionData.targetPrice));
      return;
    }

    setLoadingState('loading');
    setErrorMessage('');

    try {
      // Essayer d'obtenir la localisation
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 300000 // Cache 5 min
        });
      }).catch(() => null);

      const lat = position?.coords.latitude ?? DEFAULT_LOCATION.lat;
      const lng = position?.coords.longitude ?? DEFAULT_LOCATION.lng;

      if (!position) {
        toast.info('Localisation non disponible, utilisation de Paris par défaut.');
      }

      const strat = await generateAuctionStrategy(item, lat, lng);

      setStrategy(strat);
      setTargetPrice(String(strat.targetPrice));
      setLoadingState('success');
    } catch (error) {
      console.error('[AuctionRoom] Strategy load failed:', error);
      setErrorMessage('Impossible de charger la stratégie. Veuillez réessayer.');
      setLoadingState('error');
      toast.error('Erreur lors du chargement de la stratégie.');
    }
  }, [item, toast]);

  // Charger au montage
  useEffect(() => {
    loadStrategy();
  }, [loadStrategy]);

  /**
   * Gère le changement de prix cible
   */
  const handlePriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Permettre seulement les nombres positifs
      if (value === '' || /^\d+$/.test(value)) {
        setTargetPrice(value);
      }
    },
    []
  );

  /**
   * Rendu du contenu principal
   */
  const renderContent = () => {
    if (loadingState === 'loading') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <div className="relative">
            <div className="w-32 h-32 border-4 border-gold-500/20 rounded-full motion-safe:animate-spin-slow" />
            <div className="absolute inset-0 border-t-4 border-gold-500 rounded-full animate-spin" />
            <Globe
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-400 animate-pulse"
              size={40}
              aria-hidden="true"
            />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">
              Analyse Mondiale
            </h3>
            <p className="text-xs text-heritage-400 font-mono">
              Scraping enchères • Géolocalisation • Analyse...
            </p>
          </div>
        </div>
      );
    }

    if (loadingState === 'error') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-8">
          <AlertTriangle className="text-red-400" size={48} />
          <p className="text-heritage-300 text-center">{errorMessage}</p>
          <ActionButton
            onClick={loadStrategy}
            label="Réessayer"
            icon={<Loader2 />}
            variant="secondary"
          />
        </div>
      );
    }

    if (!strategy) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-5xl mx-auto w-full pb-20"
      >
        {/* Main HUD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target Price (Editable) */}
          <SpotlightCard className="bg-green-900/10 border-green-500/30 flex flex-col items-center justify-center py-8 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_10px_#22c55e]" />
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil size={14} className="text-green-400" aria-hidden="true" />
            </div>
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-[0.2em] mb-3">
              Prix Cible
            </span>

            <div className="flex items-baseline gap-1 relative z-10">
              <label htmlFor="target-price" className="sr-only">
                Prix cible en euros
              </label>
              <input
                id="target-price"
                type="text"
                inputMode="numeric"
                value={targetPrice}
                onChange={handlePriceChange}
                aria-describedby="price-hint"
                className="text-5xl font-display font-bold text-white tracking-tighter bg-transparent text-right w-48 focus:outline-none focus:border-b focus:border-green-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-3xl font-display font-bold text-white">€</span>
            </div>
            <p id="price-hint" className="sr-only">
              Modifiez le prix cible pour votre enchère
            </p>

            <div className="flex items-center gap-1 text-green-500 mt-2 text-xs font-mono">
              <TrendingUp size={12} aria-hidden="true" /> +12% vs Marché
            </div>
          </SpotlightCard>

          {/* Global Demand */}
          <SpotlightCard className="bg-red-900/10 border-red-500/30 flex flex-col items-center justify-center py-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_10px_#ef4444]" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-[0.2em] mb-3">
              Demande Globale
            </span>
            <span className="text-4xl font-display font-bold text-white">
              {strategy.globalDemand}
            </span>
            <AlertTriangle
              className="text-red-500 mt-2 opacity-50"
              size={20}
              aria-hidden="true"
            />
          </SpotlightCard>

          {/* Optimal Timing */}
          <SpotlightCard className="bg-blue-900/10 border-blue-500/30 flex flex-col items-center justify-center py-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-3">
              Timing Optimal
            </span>
            <span className="text-2xl font-display font-bold text-white text-center px-4">
              {strategy.bestTimeToSend}
            </span>
            <Sparkles
              className="text-blue-500 mt-2 opacity-50"
              size={20}
              aria-hidden="true"
            />
          </SpotlightCard>
        </div>

        {/* Marketing Strategy */}
        <SpotlightCard className="p-8 border-gold-500/20">
          <h3 className="text-gold-400 font-display text-sm font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <Crosshair size={16} aria-hidden="true" /> Plan d'Attaque Marketing
          </h3>
          <blockquote className="text-heritage-100 font-serif text-xl leading-relaxed pl-6 border-l-2 border-gold-500">
            "{strategy.marketingHook}"
          </blockquote>
        </SpotlightCard>

        {/* Maps & Competitors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Physical Locations */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 opacity-70">
              <MapPin size={14} aria-hidden="true" /> Lieux Physiques
            </h3>
            {strategy.locations.length > 0 ? (
              strategy.locations.map((loc, i) => (
                <motion.div
                  key={`loc-${i}`}
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center group hover:bg-gold-500/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-heritage-800 flex items-center justify-center text-gold-500 font-bold text-xs">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{loc.name}</p>
                      <p className="text-[10px] text-heritage-400 font-mono">
                        {loc.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="bg-black/40 px-2 py-1 rounded text-[9px] font-mono text-gold-400 flex items-center gap-1">
                    <MapPin size={8} aria-hidden="true" />
                    {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-heritage-500 text-xs italic">
                Aucun lieu identifié
              </p>
            )}
          </div>

          {/* Competitor Listings */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 opacity-70">
              <Globe size={14} aria-hidden="true" /> Concurrence
            </h3>
            {strategy.competitorListings.length > 0 ? (
              strategy.competitorListings.map((comp, i) => (
                <a
                  key={`comp-${i}`}
                  href={comp.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-gold-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-white font-bold text-sm truncate pr-4">
                      {comp.title}
                    </p>
                    <ExternalLink
                      size={12}
                      className="text-white/30 group-hover:text-gold-400 shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <p className="text-[10px] text-heritage-400">
                      Vente similaire détectée
                    </p>
                    <p className="text-gold-400 font-mono font-bold">
                      {comp.price}
                    </p>
                  </div>
                </a>
              ))
            ) : (
              <p className="text-heritage-500 text-xs italic">
                Aucune vente similaire détectée
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      role="dialog"
      aria-label="Salle des enchères"
      aria-modal="true"
    >
      {/* Background */}
      <div
        className="absolute inset-0 opacity-30 bg-cover grayscale mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"%3E%3Crect fill=\"%23111\" width=\"100\" height=\"100\"/%3E%3C/svg%3E')"
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black"
        aria-hidden="true"
      />
      <HolographicGrid />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold text-white tracking-widest uppercase flex items-center gap-3">
              <Gavel className="text-gold-500" aria-hidden="true" /> WAR ROOM
            </h2>
            <p className="text-xs text-gold-400 font-mono mt-1 flex items-center gap-2">
              <span
                className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
                aria-hidden="true"
              />
              LIVE STRATEGY CENTER
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer la salle des enchères"
            className="p-3 bg-white/10 rounded-full text-white hover:bg-red-500/20 hover:text-red-400 border border-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          >
            <Crosshair size={24} aria-hidden="true" />
          </button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export type { AuctionRoomProps };
