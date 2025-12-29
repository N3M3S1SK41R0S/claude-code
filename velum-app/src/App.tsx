/**
 * VELUM - Application Principale
 * Version corrigée avec gestion d'état améliorée et accessibilité
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  Zap,
  Volume2,
  Wand2,
  MessageSquare,
  MapPin,
  Globe,
  Film,
  Gavel,
  Crown,
  History,
  ShieldCheck,
  PlayCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppView, CollectionType } from './types';
import type { CollectorItem, AIAnalysis } from './types';
import {
  Header,
  ActionButton,
  WaxSeal,
  Badge,
  SpotlightCard
} from './components/Shared';
import { Scanner } from './components/Scanner';
import {
  generateFinancialThesis,
  generateEraBackground,
  generateItemBiography,
  generateDocumentaryVideo
} from './services/geminiService';
import { audioEngine } from './services/audioEngine';
import { ToastProvider, useToast } from './components/Toast';
import { LiveAssistant } from './components/LiveAssistant';
import { CreativeStudio } from './components/CreativeStudio';
import { ChatBot } from './components/ChatBot';
import { MapsView } from './components/MapsView';
import { VirtualGallery } from './components/VirtualGallery';
import { AuctionRoom } from './components/AuctionRoom';
import {
  CursorTrail,
  FloatingOrbs,
  useParticleBurst,
  MagneticButton,
  TiltCard
} from './components/Animations';

// ============================================================================
// ITEM DETAIL VIEW
// ============================================================================

interface ItemDetailViewProps {
  item: CollectorItem;
  onClose: () => void;
  onAuction: () => void;
}

const ItemDetailView = memo(function ItemDetailView({
  item,
  onClose,
  onAuction
}: ItemDetailViewProps) {
  const [tab, setTab] = useState<'INFO' | 'FORENSICS' | 'FINANCE' | 'MEDIA'>('INFO');
  const [bg, setBg] = useState('');
  const [financialData, setFinancialData] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const toast = useToast();

  const expertData: AIAnalysis | undefined = item.expertAnalysis?.deepData;

  // Charger l'arrière-plan d'époque
  React.useEffect(() => {
    let mounted = true;
    generateEraBackground(item.year.toString())
      .then((url) => {
        if (mounted) setBg(url);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [item.year]);

  // Charger les données financières quand on passe à l'onglet FINANCE
  React.useEffect(() => {
    if (tab === 'FINANCE' && !financialData && !loadingFinance) {
      setLoadingFinance(true);
      toast.ai('Analyse financière approfondie (Thinking Mode)...');
      generateFinancialThesis(item)
        .then(setFinancialData)
        .catch((error) => {
          console.error('Financial analysis failed:', error);
          toast.error('Échec de l\'analyse financière.');
        })
        .finally(() => setLoadingFinance(false));
    }
  }, [tab, financialData, loadingFinance, item, toast]);

  const handleGenerateVideo = useCallback(async () => {
    setGeneratingVideo(true);
    toast.ai('Production du documentaire historique (Veo + Imagen)...');
    try {
      const url = await generateDocumentaryVideo(item);
      setVideoUrl(url);
      toast.success('Documentaire prêt.');
    } catch (e) {
      console.error('Video generation failed:', e);
      toast.error('Échec de la production vidéo.');
    } finally {
      setGeneratingVideo(false);
    }
  }, [item, toast]);

  const handleNarrate = useCallback(async () => {
    try {
      const bio = await generateItemBiography(item);
      audioEngine.speak(bio);
    } catch (error) {
      toast.error('Échec de la narration.');
    }
  }, [item, toast]);

  const tabs = ['INFO', 'FORENSICS', 'FINANCE', 'MEDIA'] as const;

  return (
    <div className="pt-24 px-6 pb-32 min-h-screen bg-heritage-950/90 backdrop-blur-3xl animate-fade-in relative z-20 overflow-y-auto">
      {bg && (
        <img
          src={bg}
          alt=""
          className="fixed inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          aria-hidden="true"
        />
      )}

      <TiltCard className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-8 bg-black">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full h-full object-cover"
            aria-label={`Documentaire sur ${item.title}`}
          />
        ) : (
          <img
            src={item.restoredImageUrl || item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        )}

        {!videoUrl && (
          <div className="absolute top-4 right-4">
            <WaxSeal verified={(expertData?.authenticityScore || 0) > 70} />
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="Fermer les détails"
          className="absolute top-4 left-4 p-3 bg-black/40 rounded-full text-white backdrop-blur-xl border border-white/10 hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/50"
        >
          ✕
        </button>
      </TiltCard>

      <div className="space-y-6 relative z-10">
        <div className="text-center">
          <Badge text={item.type} />
          <h1 className="text-4xl font-display font-bold text-white tracking-widest mt-2 uppercase">
            {item.title}
          </h1>
          <p className="text-gold-400 font-serif italic text-lg">
            {item.country}, {item.year}
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex bg-heritage-900/80 p-1 rounded-2xl border border-white/5 overflow-x-auto"
          role="tablist"
        >
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              role="tab"
              aria-selected={tab === t}
              className={`flex-1 py-3 px-4 text-[9px] font-bold rounded-xl transition-all uppercase tracking-widest ${
                tab === t ? 'bg-gold-500 text-black' : 'text-heritage-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="min-h-[200px] space-y-6"
          >
            {tab === 'INFO' && (
              <div className="space-y-6">
                <SpotlightCard className="p-6">
                  <h3 className="text-xs font-display font-bold text-gold-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <History size={14} aria-hidden="true" /> Contexte Historique
                  </h3>
                  <p className="font-serif text-lg leading-relaxed text-heritage-100">
                    {expertData?.historicalContext || item.description}
                  </p>
                </SpotlightCard>

                <div className="flex gap-4">
                  <ActionButton
                    onClick={handleNarrate}
                    label="Écouter l'Histoire"
                    icon={<Volume2 />}
                    variant="secondary"
                    className="flex-1"
                  />
                </div>
              </div>
            )}

            {tab === 'FORENSICS' && expertData && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <SpotlightCard className="p-6 text-center border-green-500/20">
                    <span className="text-[9px] uppercase text-heritage-500 tracking-widest">
                      Authenticité
                    </span>
                    <p
                      className={`text-3xl font-bold font-display mt-2 ${
                        expertData.authenticityScore > 80
                          ? 'text-green-400'
                          : 'text-yellow-500'
                      }`}
                    >
                      {expertData.authenticityScore}%
                    </p>
                  </SpotlightCard>
                  <SpotlightCard className="p-6 text-center border-gold-500/20">
                    <span className="text-[9px] uppercase text-heritage-500 tracking-widest">
                      Rareté
                    </span>
                    <p className="text-3xl font-bold font-display text-gold-400 mt-2">
                      {expertData.rarityIndex}
                    </p>
                  </SpotlightCard>
                </div>

                <div className="space-y-3">
                  {expertData.authenticityMarkers.map((m, i) => (
                    <div
                      key={i}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4 items-center"
                    >
                      <ShieldCheck
                        className="text-gold-500 shrink-0"
                        size={16}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-xs font-bold text-white uppercase">
                          {m.label}
                        </p>
                        <p className="text-[10px] text-heritage-400 font-mono mt-1">
                          {m.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'FINANCE' && (
              <div className="space-y-6">
                {loadingFinance ? (
                  <div className="py-12 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-gold-400" size={32} />
                    <p className="text-heritage-400 text-sm">Analyse en cours...</p>
                  </div>
                ) : financialData ? (
                  <>
                    <SpotlightCard
                      className={`p-6 border-l-4 ${
                        financialData.investmentRating === 'BUY'
                          ? 'border-l-green-500'
                          : financialData.investmentRating === 'SELL'
                          ? 'border-l-red-500'
                          : 'border-l-yellow-500'
                      }`}
                    >
                      <h3 className="text-xs font-bold text-heritage-500 uppercase mb-2 tracking-widest">
                        Recommandation
                      </h3>
                      <p
                        className={`text-4xl font-display font-bold ${
                          financialData.investmentRating === 'BUY'
                            ? 'text-green-400'
                            : financialData.investmentRating === 'SELL'
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        }`}
                      >
                        {financialData.investmentRating}
                      </p>
                      <p className="mt-4 text-sm font-serif text-white italic">
                        "{financialData.reasoning}"
                      </p>
                    </SpotlightCard>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-[9px] uppercase text-heritage-500">
                          ROI 5 ANS
                        </p>
                        <p className="text-xl font-bold text-white mt-1">
                          {financialData.roiProjection5Years}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-[9px] uppercase text-heritage-500">
                          Liquidité
                        </p>
                        <p className="text-xl font-bold text-white mt-1">
                          {financialData.liquidityScore}/100
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-heritage-400 text-center py-8">
                    Données financières non disponibles
                  </p>
                )}
              </div>
            )}

            {tab === 'MEDIA' && (
              <div className="space-y-6">
                <SpotlightCard className="p-8 text-center space-y-4">
                  <Film className="mx-auto text-gold-500" size={40} aria-hidden="true" />
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest">
                      Documentaire Veo
                    </h3>
                    <p className="text-xs text-heritage-400 mt-2">
                      Générer un film historique immersif basé sur cet objet.
                    </p>
                  </div>
                  <ActionButton
                    onClick={handleGenerateVideo}
                    disabled={generatingVideo}
                    label={generatingVideo ? 'Tournage en cours...' : 'Produire le Film'}
                    icon={generatingVideo ? <Loader2 className="animate-spin" /> : <PlayCircle />}
                    className="w-full"
                  />
                </SpotlightCard>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="pt-6 border-t border-white/10">
          <ActionButton
            onClick={onAuction}
            label="Accéder à la War Room (Enchères)"
            icon={<Gavel />}
            className="w-full py-5 text-sm"
          />
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// APP CONTENT
// ============================================================================

function AppContent() {
  const [view, setView] = useState(AppView.HOME);
  const [items, setItems] = useState<CollectorItem[]>([]);
  const [selected, setSelected] = useState<CollectorItem | null>(null);
  const [showLiveAssistant, setShowLiveAssistant] = useState(true);
  const { trigger, Particles } = useParticleBurst();

  const handleItemsIdentified = useCallback((newItems: CollectorItem[]) => {
    setItems((prev) => [...newItems, ...prev]);
    setView(AppView.COLLECTION);
  }, []);

  const handleSelectItem = useCallback((item: CollectorItem) => {
    setSelected(item);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelected(null);
  }, []);

  const handleOpenAuction = useCallback(() => {
    setView(AppView.AUCTION);
  }, []);

  const handleParticleClick = useCallback(
    (e: React.MouseEvent) => {
      trigger(e.clientX, e.clientY);
    },
    [trigger]
  );

  return (
    <div
      className="min-h-screen bg-heritage-950 overflow-x-hidden relative font-sans text-white selection:bg-gold-500 selection:text-black"
      onClick={handleParticleClick}
    >
      <CursorTrail />
      <FloatingOrbs />
      <Particles />
      <Header />

      <AnimatePresence mode="wait">
        {/* HOME */}
        {view === AppView.HOME && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-40 px-6 max-w-xl mx-auto space-y-12"
          >
            <div className="text-center space-y-4">
              <div className="inline-block p-4 rounded-full border border-gold-500/20 bg-gold-500/5 mb-4 animate-pulse-slow">
                <Crown size={40} className="text-gold-400" aria-hidden="true" />
              </div>
              <h2 className="text-6xl font-display font-bold text-white tracking-[0.2em] leading-none">
                VELUM
              </h2>
              <p className="text-gold-400 text-[10px] tracking-[0.5em] uppercase font-bold">
                VULCAIN OMEGA V5.0
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <MagneticButton
                onClick={() => setView(AppView.SCAN)}
                className="w-full"
                aria-label="Ouvrir le scanner"
              >
                <TiltCard className="h-56 rounded-[2.5rem] bg-gradient-to-br from-heritage-900 to-black border border-gold-500/30 flex flex-col justify-center items-center gap-6 group hover:border-gold-400/60 transition-colors relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.1),transparent_50%)]" />
                  <Zap
                    size={48}
                    className="text-gold-500 drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]"
                    aria-hidden="true"
                  />
                  <div className="text-center z-10">
                    <h3 className="text-2xl font-display font-bold text-white uppercase tracking-widest">
                      Scanner Vivant
                    </h3>
                    <p className="text-[10px] text-gold-400 font-mono mt-2 tracking-[0.2em]">
                      FORENSICS + GROUNDING
                    </p>
                  </div>
                </TiltCard>
              </MagneticButton>

              <div className="grid grid-cols-2 gap-4">
                <MagneticButton
                  onClick={() => setView(AppView.GALLERY)}
                  className="h-40 bg-white/5 rounded-[2rem] border border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-colors group"
                  aria-label="Ouvrir la galerie"
                >
                  <Globe
                    size={32}
                    className="text-heritage-400 group-hover:text-gold-400 transition-colors"
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-bold text-white tracking-[0.2em] uppercase">
                    Galerie
                  </span>
                </MagneticButton>
                <MagneticButton
                  onClick={() => setView(AppView.STUDIO)}
                  className="h-40 bg-white/5 rounded-[2rem] border border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-colors group"
                  aria-label="Ouvrir le studio IA"
                >
                  <Wand2
                    size={32}
                    className="text-heritage-400 group-hover:text-gold-400 transition-colors"
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-bold text-white tracking-[0.2em] uppercase">
                    Studio IA
                  </span>
                </MagneticButton>
              </div>
            </div>
          </motion.div>
        )}

        {/* SCAN */}
        {view === AppView.SCAN && (
          <Scanner
            key="scanner"
            type={CollectionType.STAMP}
            onIdentified={handleItemsIdentified}
            onClose={() => setView(AppView.HOME)}
          />
        )}

        {/* COLLECTION */}
        {view === AppView.COLLECTION && !selected && (
          <motion.div
            key="collection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-32 px-6 pb-32 max-w-xl mx-auto"
          >
            <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-4">
              <h2 className="text-3xl font-display font-bold text-white uppercase tracking-widest">
                Inventaire
              </h2>
              <span className="text-gold-400 font-mono text-xs">
                {items.length} ACTIFS
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => handleSelectItem(i)}
                  className="aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 relative group cursor-pointer hover:scale-[1.02] transition-transform text-left focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <img
                    src={i.imageUrl}
                    alt={i.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-0 p-4 w-full">
                    <p className="text-gold-400 text-[9px] font-bold uppercase tracking-widest mb-1">
                      {i.year}
                    </p>
                    <p className="text-white text-sm font-bold font-display uppercase leading-none">
                      {i.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ITEM DETAIL */}
        {selected && view !== AppView.AUCTION && (
          <ItemDetailView
            key={`detail-${selected.id}`}
            item={selected}
            onClose={handleCloseDetail}
            onAuction={handleOpenAuction}
          />
        )}

        {/* AUCTION */}
        {view === AppView.AUCTION && selected && (
          <AuctionRoom
            key="auction"
            item={selected}
            onClose={() => setView(AppView.COLLECTION)}
          />
        )}

        {/* STUDIO */}
        {view === AppView.STUDIO && <CreativeStudio key="studio" />}

        {/* MARKET/MAPS */}
        {view === AppView.MARKET && <MapsView key="maps" />}

        {/* GALLERY */}
        {view === AppView.GALLERY && (
          <VirtualGallery
            key="gallery"
            items={items}
            onClose={() => setView(AppView.HOME)}
            onSelectItem={handleSelectItem}
          />
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav
        className="fixed bottom-8 left-1/2 -translate-x-1/2 h-16 bg-heritage-900/90 backdrop-blur-xl border border-white/10 rounded-full px-8 flex justify-center items-center gap-12 shadow-2xl z-40"
        aria-label="Navigation principale"
      >
        <button
          onClick={() => setView(AppView.HOME)}
          aria-label="Accueil"
          aria-current={view === AppView.HOME ? 'page' : undefined}
          className="p-2 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-gold-500/50 rounded-full"
        >
          <Zap
            className={view === AppView.HOME ? 'text-gold-500' : 'text-white/30'}
            size={24}
            aria-hidden="true"
          />
        </button>
        <button
          onClick={() => setView(AppView.MARKET)}
          aria-label="Carte"
          aria-current={view === AppView.MARKET ? 'page' : undefined}
          className="p-2 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-gold-500/50 rounded-full"
        >
          <MapPin
            className={view === AppView.MARKET ? 'text-gold-500' : 'text-white/30'}
            size={24}
            aria-hidden="true"
          />
        </button>
        <button
          onClick={() => setView(AppView.CHAT)}
          aria-label="Chat"
          aria-current={view === AppView.CHAT ? 'page' : undefined}
          className="p-2 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-gold-500/50 rounded-full"
        >
          <MessageSquare
            className={view === AppView.CHAT ? 'text-gold-500' : 'text-white/30'}
            size={24}
            aria-hidden="true"
          />
        </button>
      </nav>

      {/* Live Assistant */}
      {showLiveAssistant && (
        <LiveAssistant onClose={() => setShowLiveAssistant(false)} />
      )}

      {/* ChatBot */}
      {view === AppView.CHAT && <ChatBot onClose={() => setView(AppView.HOME)} />}
    </div>
  );
}

// ============================================================================
// APP WITH PROVIDERS
// ============================================================================

export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
