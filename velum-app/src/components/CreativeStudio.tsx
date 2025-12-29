/**
 * VELUM - Studio Créatif IA
 * Version corrigée avec validation, cleanup et accessibilité
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  memo,
  useId
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  Download,
  Loader2,
  Camera,
  Film,
  Image as ImageIcon,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  generateProImage,
  editWithAI,
  generateVeoVideo,
  analyzeCollectionVideo,
  revokeObjectURL
} from '../services/geminiService';
import { ActionButton, Badge } from './Shared';
import { useToast } from './Toast';
import { TiltCard } from './Animations';

// ============================================================================
// TYPES
// ============================================================================

type StudioMode = 'IMAGEN' | 'VEO' | 'EDIT';

interface StudioState {
  mode: StudioMode;
  prompt: string;
  source: string | null;
  result: string | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODES: { key: StudioMode; label: string; icon: React.ReactNode }[] = [
  { key: 'IMAGEN', label: 'Image', icon: <ImageIcon size={14} /> },
  { key: 'VEO', label: 'Vidéo', icon: <Film size={14} /> },
  { key: 'EDIT', label: 'Édition', icon: <Wand2 size={14} /> }
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// ============================================================================
// WATERMARK COMPONENT
// ============================================================================

const Watermark = memo(function Watermark() {
  return (
    <div
      className="absolute bottom-4 right-4 pointer-events-none z-30 opacity-30 flex items-center gap-2 mix-blend-screen"
      aria-hidden="true"
    >
      <div className="w-[1px] h-3 bg-gold-400" />
      <span className="text-[8px] font-display font-bold tracking-[0.4em] text-white uppercase">
        VELUM
      </span>
    </div>
  );
});

// ============================================================================
// CREATIVE STUDIO COMPONENT
// ============================================================================

export const CreativeStudio = memo(function CreativeStudio() {
  const toast = useToast();
  const fileInputId = useId();
  const promptId = useId();

  // State
  const [state, setState] = useState<StudioState>({
    mode: 'IMAGEN',
    prompt: '',
    source: null,
    result: null,
    isLoading: false,
    error: null
  });

  // Refs
  const fileRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  // Cleanup result URL au démontage ou changement
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) {
        revokeObjectURL(resultUrlRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Met à jour partiellement l'état
   */
  const updateState = useCallback((updates: Partial<StudioState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Change le mode
   */
  const handleModeChange = useCallback(
    (mode: StudioMode) => {
      // Cleanup previous result
      if (resultUrlRef.current && state.mode === 'VEO') {
        revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }
      updateState({ mode, result: null, error: null });
    },
    [state.mode, updateState]
  );

  /**
   * Valide un fichier
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > MAX_FILE_SIZE) {
        return 'Fichier trop volumineux (max 10MB)';
      }

      const allowedTypes =
        state.mode === 'VEO'
          ? [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]
          : ALLOWED_IMAGE_TYPES;

      if (!allowedTypes.includes(file.type)) {
        return 'Format de fichier non supporté';
      }

      return null;
    },
    [state.mode]
  );

  /**
   * Gère le chargement d'un fichier
   */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        updateState({ source: reader.result as string, error: null });
      };
      reader.onerror = () => {
        toast.error('Erreur lors du chargement du fichier');
      };
      reader.readAsDataURL(file);

      // Reset input pour permettre de resélectionner le même fichier
      e.target.value = '';
    },
    [validateFile, updateState, toast]
  );

  /**
   * Supprime la source
   */
  const handleRemoveSource = useCallback(() => {
    updateState({ source: null });
  }, [updateState]);

  /**
   * Lance le processus de création
   */
  const handleProcess = useCallback(async () => {
    const { mode, prompt, source } = state;

    // Validation
    if (!prompt.trim() && mode !== 'EDIT') {
      toast.error('Description requise.');
      return;
    }

    if ((mode === 'VEO' || mode === 'EDIT') && !source) {
      toast.error('Image source requise.');
      return;
    }

    // Cleanup previous result
    if (resultUrlRef.current && mode === 'VEO') {
      revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }

    updateState({ isLoading: true, error: null, result: null });
    abortControllerRef.current = new AbortController();

    try {
      let result: string;

      switch (mode) {
        case 'IMAGEN':
          toast.ai('Génération d\'image en cours...');
          result = await generateProImage(prompt, '1K', abortControllerRef.current.signal);
          break;

        case 'VEO':
          toast.ai('Production vidéo en cours (peut prendre quelques minutes)...');
          result = await generateVeoVideo(
            source || undefined,
            prompt,
            abortControllerRef.current.signal
          );
          // Track for cleanup
          resultUrlRef.current = result;
          break;

        case 'EDIT':
          if (!source) throw new Error('Source requise');
          toast.ai('Édition de l\'image en cours...');
          result = await editWithAI(source, prompt, abortControllerRef.current.signal);
          break;

        default:
          throw new Error('Mode non supporté');
      }

      updateState({ result, isLoading: false });
      toast.success('Création terminée !');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        updateState({ isLoading: false });
        return;
      }

      console.error('[CreativeStudio] Process failed:', error);
      const errorMessage = (error as Error).message || 'Erreur de génération';
      updateState({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  }, [state, updateState, toast]);

  /**
   * Annule le processus en cours
   */
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    updateState({ isLoading: false });
  }, [updateState]);

  /**
   * Télécharge le résultat
   */
  const handleDownload = useCallback(() => {
    if (!state.result) return;

    const link = document.createElement('a');
    link.href = state.result;
    link.download = `velum-${state.mode.toLowerCase()}-${Date.now()}.${
      state.mode === 'VEO' ? 'mp4' : 'png'
    }`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [state.result, state.mode]);

  /**
   * Réinitialise le studio
   */
  const handleReset = useCallback(() => {
    if (resultUrlRef.current) {
      revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    updateState({ result: null, error: null, source: null, prompt: '' });
  }, [updateState]);

  const needsSource = state.mode === 'VEO' || state.mode === 'EDIT';

  return (
    <div className="pt-32 px-6 pb-32 min-h-screen">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <Badge text="Atelier Royal" />
          <h2 className="text-4xl font-display font-bold text-white tracking-widest uppercase flex items-center justify-center gap-3">
            <Sparkles className="text-gold-400" aria-hidden="true" /> STUDIO IA
          </h2>
        </div>

        {/* Mode Selector */}
        <div
          className="flex bg-heritage-900/50 p-1 rounded-2xl border border-white/5"
          role="tablist"
          aria-label="Mode de création"
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => handleModeChange(m.key)}
              role="tab"
              aria-selected={state.mode === m.key}
              aria-controls={`panel-${m.key}`}
              className={`flex-1 py-3 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                state.mode === m.key
                  ? 'bg-gold-500 text-black'
                  : 'text-heritage-500 hover:text-white'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Source Upload (for VEO and EDIT) */}
          {needsSource && (
            <div
              className={`aspect-video rounded-3xl border border-dashed ${
                state.source ? 'border-gold-500/30' : 'border-white/10'
              } bg-black/40 flex items-center justify-center relative overflow-hidden group`}
            >
              {state.source ? (
                <>
                  <img
                    src={state.source}
                    alt="Image source"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={handleRemoveSource}
                    aria-label="Supprimer l'image source"
                    className="absolute top-4 right-4 p-2 bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-2 text-heritage-500 hover:text-gold-400 transition-colors p-8 focus:outline-none focus:ring-2 focus:ring-gold-500/50 rounded-2xl"
                >
                  <Camera size={32} aria-hidden="true" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">
                    Charger une image
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Prompt Input */}
          <div>
            <label htmlFor={promptId} className="sr-only">
              Description de votre création
            </label>
            <textarea
              id={promptId}
              value={state.prompt}
              onChange={(e) => updateState({ prompt: e.target.value })}
              placeholder={
                state.mode === 'EDIT'
                  ? 'Décris les modifications à apporter...'
                  : 'Décris ta vision artistique...'
              }
              disabled={state.isLoading}
              className="w-full h-32 bg-heritage-900 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-gold-500/50 outline-none resize-none font-serif italic disabled:opacity-50"
            />
          </div>

          {/* Error Display */}
          {state.error && (
            <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <AlertCircle size={16} aria-hidden="true" />
              {state.error}
            </div>
          )}

          {/* Action Button */}
          {state.isLoading ? (
            <div className="flex gap-4">
              <div className="flex-1 py-4 px-6 bg-heritage-800 rounded flex items-center justify-center gap-2 text-gold-400 font-display text-xs uppercase">
                <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                Création en cours...
              </div>
              <ActionButton
                onClick={handleCancel}
                label="Annuler"
                variant="danger"
                compact
              />
            </div>
          ) : (
            <ActionButton
              onClick={handleProcess}
              disabled={!state.prompt.trim() && state.mode !== 'EDIT'}
              label="Lancer la Création"
              icon={<Wand2 />}
              className="w-full"
            />
          )}
        </div>

        {/* Result Display */}
        <AnimatePresence>
          {state.result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <TiltCard className="relative aspect-square rounded-[2rem] overflow-hidden shadow-glow-gold border border-gold-400/30">
                {state.mode === 'VEO' ? (
                  <video
                    src={state.result}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                    aria-label="Vidéo générée"
                  />
                ) : (
                  <img
                    src={state.result}
                    alt="Image générée par l'IA"
                    className="w-full h-full object-cover"
                  />
                )}
                <Watermark />
              </TiltCard>

              <div className="flex gap-4">
                <ActionButton
                  onClick={handleDownload}
                  label="Télécharger"
                  icon={<Download />}
                  variant="secondary"
                  className="flex-1"
                />
                <ActionButton
                  onClick={handleReset}
                  label="Nouveau"
                  icon={<Sparkles />}
                  variant="ghost"
                  compact
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileRef}
        id={fileInputId}
        hidden
        accept={
          state.mode === 'VEO'
            ? [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',')
            : ALLOWED_IMAGE_TYPES.join(',')
        }
        onChange={handleFileChange}
        aria-label="Sélectionner un fichier"
      />
    </div>
  );
});
