/**
 * VELUM - Audio Engine (TTS)
 * Version corrigée avec cache LRU, cleanup et gestion d'état améliorée
 */

import { generateSpeech } from './geminiService';

// ============================================================================
// TYPES
// ============================================================================

interface CacheEntry {
  buffer: AudioBuffer;
  lastAccess: number;
  size: number;
}

interface QueueItem {
  text: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface AudioEngineState {
  isSpeaking: boolean;
  isLoading: boolean;
  queueLength: number;
  cacheSize: number;
}

// ============================================================================
// AUDIO ENGINE CLASS
// ============================================================================

/**
 * Moteur audio pour la synthèse vocale (TTS) avec Gemini
 * Pattern Singleton avec cache LRU et gestion de queue
 */
export class AudioEngine {
  private static instance: AudioEngine;

  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private ttsQueue: QueueItem[] = [];
  private _isSpeaking = false;
  private _isLoading = false;
  private abortController: AbortController | null = null;

  // Cache LRU
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize = 50; // Max 50 entrées
  private maxCacheBytes = 50 * 1024 * 1024; // Max 50MB
  private currentCacheBytes = 0;

  // Listeners
  private stateListeners: Set<(state: AudioEngineState) => void> = new Set();

  private constructor() {
    // Initialisation lazy du contexte audio
  }

  /**
   * Récupère l'instance singleton
   */
  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Initialise le contexte audio (doit être appelé après une interaction utilisateur)
   */
  private ensureAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 24000 });
    }

    // Résumer si suspendu (politique autoplay des navigateurs)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Décode des données PCM brutes en AudioBuffer
   */
  private async decodeRawPCM(data: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.ensureAudioContext();
    const numChannels = 1;
    const sampleRate = 24000;
    const dataInt16 = new Int16Array(data);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    return buffer;
  }

  /**
   * Vérifie si l'engine parle actuellement
   */
  public isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /**
   * Vérifie si l'engine charge de l'audio
   */
  public isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Retourne l'état actuel de l'engine
   */
  public getState(): AudioEngineState {
    return {
      isSpeaking: this._isSpeaking,
      isLoading: this._isLoading,
      queueLength: this.ttsQueue.length,
      cacheSize: this.cache.size
    };
  }

  /**
   * Ajoute un listener d'état
   */
  public addStateListener(listener: (state: AudioEngineState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Notifie les listeners d'un changement d'état
   */
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateListeners.forEach((listener) => listener(state));
  }

  /**
   * Synthétise et lit un texte
   */
  public async speak(text: string): Promise<void> {
    // Vérifier si en cache
    const cached = this.getFromCache(text);
    if (cached) {
      return this.playBuffer(cached);
    }

    // Si déjà en train de parler, ajouter à la queue
    if (this._isSpeaking || this._isLoading) {
      return new Promise((resolve, reject) => {
        this.ttsQueue.push({ text, resolve, reject });
        this.notifyStateChange();
      });
    }

    return this.processText(text);
  }

  /**
   * Traite un texte (génération + lecture)
   */
  private async processText(text: string): Promise<void> {
    this._isLoading = true;
    this.abortController = new AbortController();
    this.notifyStateChange();

    try {
      const base64Data = await generateSpeech(text, this.abortController.signal);

      if (!base64Data) {
        throw new Error('Aucune donnée audio reçue');
      }

      // Décoder base64 en ArrayBuffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await this.decodeRawPCM(bytes.buffer);

      // Mettre en cache
      this.addToCache(text, audioBuffer);

      // Jouer
      await this.playBuffer(audioBuffer);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.warn('[AudioEngine] TTS failed:', error);
      }
      throw error;
    } finally {
      this._isLoading = false;
      this.abortController = null;
      this.notifyStateChange();
      this.processQueue();
    }
  }

  /**
   * Joue un AudioBuffer
   */
  private async playBuffer(buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ctx = this.ensureAudioContext();
        this._isSpeaking = true;
        this.notifyStateChange();

        const source = ctx.createBufferSource();
        this.currentSource = source;
        source.buffer = buffer;
        source.connect(ctx.destination);

        source.onended = () => {
          this._isSpeaking = false;
          this.currentSource = null;
          this.notifyStateChange();
          this.processQueue();
          resolve();
        };

        source.start();
      } catch (error) {
        this._isSpeaking = false;
        this.currentSource = null;
        this.notifyStateChange();
        reject(error);
      }
    });
  }

  /**
   * Traite la queue de textes en attente
   */
  private processQueue(): void {
    if (this.ttsQueue.length === 0 || this._isSpeaking || this._isLoading) {
      return;
    }

    const next = this.ttsQueue.shift();
    if (next) {
      this.notifyStateChange();
      this.processText(next.text)
        .then(next.resolve)
        .catch(next.reject);
    }
  }

  /**
   * Arrête la lecture en cours et vide la queue
   */
  public stop(): void {
    // Annuler la génération en cours
    this.abortController?.abort();

    // Arrêter la lecture
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Ignorer si déjà arrêté
      }
      this.currentSource = null;
    }

    // Rejeter les items en queue
    this.ttsQueue.forEach((item) => {
      item.reject(new Error('Lecture annulée'));
    });

    // Reset état
    this.ttsQueue = [];
    this._isSpeaking = false;
    this._isLoading = false;
    this.notifyStateChange();
  }

  /**
   * Met en pause/reprend
   */
  public togglePause(): void {
    if (!this.audioContext) return;

    if (this.audioContext.state === 'running') {
      this.audioContext.suspend();
    } else {
      this.audioContext.resume();
    }
  }

  // ============================================================================
  // CACHE LRU
  // ============================================================================

  /**
   * Récupère un buffer depuis le cache
   */
  private getFromCache(text: string): AudioBuffer | null {
    const entry = this.cache.get(text);
    if (entry) {
      // Mettre à jour lastAccess pour LRU
      entry.lastAccess = Date.now();
      return entry.buffer;
    }
    return null;
  }

  /**
   * Ajoute un buffer au cache
   */
  private addToCache(text: string, buffer: AudioBuffer): void {
    const size = buffer.length * buffer.numberOfChannels * 4; // Float32 = 4 bytes

    // Éviction si nécessaire
    while (
      (this.cache.size >= this.maxCacheSize ||
        this.currentCacheBytes + size > this.maxCacheBytes) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    this.cache.set(text, {
      buffer,
      lastAccess: Date.now(),
      size
    });
    this.currentCacheBytes += size;
  }

  /**
   * Évicte l'entrée la moins récemment utilisée
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentCacheBytes -= entry.size;
      }
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Vide le cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.currentCacheBytes = 0;
  }

  /**
   * Nettoie toutes les ressources
   */
  public dispose(): void {
    this.stop();
    this.clearCache();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.stateListeners.clear();
  }
}

// Export singleton
export const audioEngine = AudioEngine.getInstance();
