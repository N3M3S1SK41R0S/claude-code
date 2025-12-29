/**
 * VELUM - ChatBot Expert
 * Version corrigée avec types stricts, accessibilité et gestion du streaming
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useId
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  X,
  Bot,
  Sparkles,
  Search,
  Loader2,
  User
} from 'lucide-react';
import { chatWithGemini, groundedSearch } from '../services/geminiService';
import { useToast } from './Toast';
import type { ChatMessage, GroundingSource } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface ChatBotProps {
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Mots-clés pour déclencher la recherche grounded
const SEARCH_KEYWORDS = [
  // Français
  'trouve', 'cherche', 'recherche', 'où', 'quand', 'combien',
  'prix', 'valeur', 'récent', 'actuel', 'aujourd\'hui',
  // Anglais
  'find', 'search', 'where', 'when', 'how much', 'price',
  'value', 'recent', 'current', 'today', 'latest'
];

// ============================================================================
// CHATBOT COMPONENT
// ============================================================================

export const ChatBot = memo(function ChatBot({ onClose }: ChatBotProps) {
  const toast = useToast();
  const inputId = useId();

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Scroll vers le bas quand les messages changent
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  /**
   * Focus sur l'input au montage
   */
  useEffect(() => {
    inputRef.current?.focus();

    // Cleanup à la fermeture
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Détecte si le message nécessite une recherche grounded
   */
  const shouldUseGroundedSearch = useCallback((text: string): boolean => {
    const lowerText = text.toLowerCase();
    return SEARCH_KEYWORDS.some((keyword) => lowerText.includes(keyword));
  }, []);

  /**
   * Crée un nouveau message
   */
  const createMessage = useCallback(
    (role: 'user' | 'ai', text: string, sources?: GroundingSource[]): ChatMessage => ({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      text,
      timestamp: new Date(),
      sources
    }),
    []
  );

  /**
   * Envoie un message
   */
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Créer le message utilisateur
    const userMessage = createMessage('user', trimmedInput);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Créer un placeholder pour la réponse AI
    const aiMessageId = `msg-${Date.now()}-ai`;
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'ai',
      text: '',
      timestamp: new Date(),
      isStreaming: true
    };
    setMessages((prev) => [...prev, aiMessage]);

    // Créer AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Vérifier si on doit utiliser la recherche grounded
      if (shouldUseGroundedSearch(trimmedInput)) {
        setIsStreaming(false);

        const result = await groundedSearch(trimmedInput, signal);

        if (signal.aborted) return;

        // Mettre à jour le message avec les résultats
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  text: result.text,
                  sources: result.sources,
                  isStreaming: false
                }
              : msg
          )
        );
      } else {
        // Chat streaming normal
        setIsStreaming(true);
        let responseText = '';

        for await (const chunk of chatWithGemini(trimmedInput, signal)) {
          if (signal.aborted) break;

          responseText += chunk;

          // Mettre à jour le message en streaming (sans mutation)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, text: responseText }
                : msg
            )
          );
        }

        // Marquer comme terminé
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      console.error('[ChatBot] Error:', error);
      toast.error('Erreur de communication avec l\'assistant.');

      // Mettre à jour avec un message d'erreur
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                text: 'Désolé, une erreur est survenue. Veuillez réessayer.',
                isStreaming: false
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, createMessage, shouldUseGroundedSearch, toast]);

  /**
   * Gère les touches clavier
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /**
   * Annule la requête en cours
   */
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-x-0 bottom-24 z-50 px-4"
      role="dialog"
      aria-label="Chat avec l'expert"
      aria-modal="true"
    >
      <div className="max-w-md mx-auto h-[70vh] glass-card rounded-3xl flex flex-col border border-gold-500/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-black">
              <Bot size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xs font-display font-bold text-white tracking-widest uppercase">
                Expert Curateur
              </h2>
              <p className="text-[10px] text-gold-400 font-mono">
                Gemini Pro Active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le chat"
            className="p-2 text-heritage-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/50 rounded-full"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
          role="log"
          aria-live="polite"
          aria-label="Historique des messages"
        >
          {messages.length === 0 && (
            <div className="text-center py-20 opacity-50 space-y-4">
              <Sparkles
                className="mx-auto text-gold-500"
                size={32}
                aria-hidden="true"
              />
              <p className="text-xs font-serif italic">
                Posez vos questions sur la philatélie, la numismatique ou
                l'histoire des objets de collection.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        {/* Input */}
        <div className="p-4 bg-black/40 border-t border-white/10">
          <div className="flex gap-2">
            <label htmlFor={inputId} className="sr-only">
              Votre message
            </label>
            <input
              ref={inputRef}
              id={inputId}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Demander une expertise..."
              disabled={isLoading}
              className="flex-1 bg-heritage-900 border border-white/10 rounded-full px-5 py-3 text-xs outline-none focus:border-gold-500/50 transition-all disabled:opacity-50"
            />
            <button
              onClick={isStreaming ? handleCancel : handleSend}
              disabled={!isStreaming && (!input.trim() || isLoading)}
              aria-label={isStreaming ? 'Annuler' : 'Envoyer'}
              className="w-12 h-12 rounded-full bg-gold-500 text-black flex items-center justify-center shadow-glow-gold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            >
              {isLoading && !isStreaming ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : isStreaming ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <Send size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed ${
          isUser
            ? 'bg-gold-500 text-black font-bold'
            : 'bg-white/5 text-heritage-200 border border-white/5'
        }`}
      >
        {/* Message content */}
        {message.text || (message.isStreaming && (
          <Loader2
            className="animate-spin"
            size={12}
            aria-label="Réponse en cours..."
          />
        ))}

        {/* Streaming indicator */}
        {message.isStreaming && message.text && (
          <span className="inline-block w-1 h-4 bg-gold-500 ml-1 animate-pulse" aria-hidden="true" />
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
            <p className="text-[9px] uppercase tracking-widest text-gold-500 font-bold flex items-center gap-1">
              <Search size={10} aria-hidden="true" /> Sources
            </p>
            {message.sources.map((source, index) => (
              <a
                key={index}
                href={source.web?.uri || source.maps?.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[9px] text-heritage-400 hover:text-gold-300 underline truncate focus:outline-none focus:text-gold-400"
              >
                {source.web?.title || source.maps?.title || 'Source'}
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export type { ChatBotProps };
