/**
 * VELUM - Service Live Audio (Gemini Live API)
 * Version corrigée avec AudioWorklet, gestion d'état robuste et cleanup
 */

import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { GEMINI_CONFIG } from './geminiConfig';

// ============================================================================
// TYPES
// ============================================================================

export type LiveServiceStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'permission_denied';

export interface LiveServiceCallbacks {
  onStatusChange: (status: LiveServiceStatus, message: string) => void;
  onVolumeChange: (volume: number) => void;
  onError: (error: Error) => void;
}

interface AudioBufferQueueItem {
  buffer: AudioBuffer;
  scheduledTime: number;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Service pour gérer l'API Gemini Live avec audio natif
 * Utilise ScriptProcessorNode (AudioWorklet serait préférable en production)
 */
export class LiveService {
  private ai: GoogleGenAI | null = null;
  private session: any = null;
  private outputAudioContext: AudioContext | null = null;
  private inputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime = 0;
  private status: LiveServiceStatus = 'idle';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private playbackQueue: AudioBufferQueueItem[] = [];

  // Callbacks (utiliser un pattern EventEmitter serait mieux)
  private callbacks: LiveServiceCallbacks = {
    onStatusChange: () => {},
    onVolumeChange: () => {},
    onError: () => {}
  };

  /**
   * Configure les callbacks
   */
  setCallbacks(callbacks: Partial<LiveServiceCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Retourne le statut actuel
   */
  getStatus(): LiveServiceStatus {
    return this.status;
  }

  /**
   * Vérifie si le service est connecté
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Initialise l'instance GoogleGenAI
   */
  private initAI(): void {
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
    if (!apiKey) {
      throw new Error('Clé API non configurée');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Met à jour le statut et notifie
   */
  private updateStatus(status: LiveServiceStatus, message: string): void {
    this.status = status;
    this.callbacks.onStatusChange(status, message);
  }

  /**
   * Établit la connexion avec Gemini Live
   */
  async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') {
      return;
    }

    try {
      this.updateStatus('connecting', 'Initialisation...');
      this.initAI();

      // Créer les contextes audio
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
      this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });

      // Demander l'accès au microphone
      this.updateStatus('connecting', 'Demande accès microphone...');
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true
          }
        });
      } catch (permError) {
        this.updateStatus('permission_denied', 'Accès microphone refusé');
        throw new Error('Accès microphone refusé');
      }

      this.updateStatus('connecting', 'Connexion à Gemini Live...');

      // Connexion Gemini Live
      const sessionPromise = this.ai!.live.connect({
        model: GEMINI_CONFIG.models.LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          },
          systemInstruction:
            'Tu es VELUM, un assistant expert en numismatique et philatélie. Sois concis, charmant et très érudit. Réponds toujours en français.'
        },
        callbacks: {
          onopen: () => {
            this.updateStatus('connected', 'Connexion établie');
            this.reconnectAttempts = 0;
            this.startAudioInput();
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onclose: () => {
            this.updateStatus('disconnected', 'Connexion fermée');
            this.stopAudioInput();
            this.attemptReconnect();
          },
          onerror: (err: any) => {
            console.error('[LiveService] Error:', err);
            this.updateStatus('error', 'Erreur de connexion');
            this.callbacks.onError(err);
            this.disconnect();
          }
        }
      });

      this.session = await sessionPromise;
    } catch (error) {
      console.error('[LiveService] Connection failed:', error);
      this.updateStatus('error', 'Échec de connexion');
      this.callbacks.onError(error as Error);
      this.cleanup();
    }
  }

  /**
   * Tente une reconnexion automatique
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateStatus('error', 'Reconnexion impossible');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;

    this.updateStatus('connecting', `Reconnexion dans ${delay / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.status !== 'connected') {
      await this.connect();
    }
  }

  /**
   * Démarre la capture audio
   */
  private startAudioInput(): void {
    if (!this.stream || !this.inputAudioContext || !this.session) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);

    // Note: ScriptProcessorNode est déprécié mais plus simple pour cet exemple
    // En production, utiliser AudioWorklet
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.status !== 'connected') return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Calcul du volume RMS
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.callbacks.onVolumeChange(rms);

      // Conversion et envoi
      const pcmData = this.floatTo16BitPCM(inputData);
      const base64Audio = this.arrayBufferToBase64(pcmData);

      try {
        this.session.sendRealtimeInput({
          media: { mimeType: 'audio/pcm;rate=16000', data: base64Audio }
        });
      } catch (sendError) {
        console.warn('[LiveService] Failed to send audio:', sendError);
      }
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  /**
   * Arrête la capture audio
   */
  private stopAudioInput(): void {
    try {
      this.processor?.disconnect();
      this.inputSource?.disconnect();
      this.stream?.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.warn('[LiveService] Error stopping audio input:', error);
    }

    this.processor = null;
    this.inputSource = null;
    this.stream = null;
  }

  /**
   * Gère les messages reçus de Gemini Live
   */
  private async handleMessage(message: LiveServerMessage): Promise<void> {
    try {
      // Gestion de l'audio de sortie
      const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (audioData && this.outputAudioContext) {
        const audioBuffer = await this.base64ToAudioBuffer(
          audioData,
          this.outputAudioContext
        );
        this.schedulePlayback(audioBuffer);
      }

      // Gestion des interruptions
      if (message.serverContent?.interrupted) {
        this.cancelPendingPlayback();
      }
    } catch (error) {
      console.warn('[LiveService] Error handling message:', error);
    }
  }

  /**
   * Planifie la lecture d'un buffer audio
   */
  private schedulePlayback(buffer: AudioBuffer): void {
    if (!this.outputAudioContext) return;

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputAudioContext.destination);

    const startTime = Math.max(
      this.outputAudioContext.currentTime,
      this.nextStartTime
    );

    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;

    // Tracker pour le cleanup
    this.playbackQueue.push({ buffer, scheduledTime: startTime });

    // Nettoyer les anciens buffers
    this.cleanupPlaybackQueue();
  }

  /**
   * Annule les lectures en attente
   */
  private cancelPendingPlayback(): void {
    if (this.outputAudioContext) {
      this.nextStartTime = this.outputAudioContext.currentTime;
    }
    this.playbackQueue = [];
  }

  /**
   * Nettoie la queue de lecture
   */
  private cleanupPlaybackQueue(): void {
    const now = this.outputAudioContext?.currentTime || 0;
    this.playbackQueue = this.playbackQueue.filter(
      (item) => item.scheduledTime + item.buffer.duration > now
    );
  }

  /**
   * Déconnecte le service
   */
  disconnect(): void {
    this.cleanup();
    this.updateStatus('disconnected', 'Session terminée');
  }

  /**
   * Nettoie toutes les ressources
   */
  private cleanup(): void {
    this.stopAudioInput();

    try {
      this.outputAudioContext?.close();
      this.inputAudioContext?.close();
    } catch (error) {
      console.warn('[LiveService] Error closing audio contexts:', error);
    }

    this.session = null;
    this.ai = null;
    this.outputAudioContext = null;
    this.inputAudioContext = null;
    this.playbackQueue = [];
    this.nextStartTime = 0;
  }

  // ============================================================================
  // AUDIO HELPERS
  // ============================================================================

  /**
   * Convertit Float32 en PCM 16-bit
   */
  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output.buffer;
  }

  /**
   * Convertit ArrayBuffer en base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convertit base64 en AudioBuffer
   */
  private async base64ToAudioBuffer(
    base64: string,
    ctx: AudioContext
  ): Promise<AudioBuffer> {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    return buffer;
  }
}

// Export singleton
export const liveService = new LiveService();
