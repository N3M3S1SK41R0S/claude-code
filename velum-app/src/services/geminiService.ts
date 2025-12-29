/**
 * VELUM - Service Gemini AI
 * Version corrigée avec gestion d'erreurs robuste, types stricts et sécurité
 */

import { GoogleGenAI, Type, Modality } from '@google/genai';
import type {
  CollectorItem,
  AuctionStrategy,
  FinancialThesis,
  AIAnalysis,
  GroundingSource,
  CollectionType
} from '../types';
import {
  GEMINI_CONFIG,
  getModelForTask,
  getThinkingBudgetForTask,
  getTimeout
} from './geminiConfig';

// ============================================================================
// TYPES
// ============================================================================

interface GeminiServiceError extends Error {
  code?: string;
  status?: number;
  retryable?: boolean;
}

interface GenerateContentOptions {
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
  signal?: AbortSignal;
}

interface GroundedSearchResult {
  text: string;
  sources: GroundingSource[];
}

// ============================================================================
// SINGLETON & INITIALIZATION
// ============================================================================

let aiInstance: GoogleGenAI | null = null;

/**
 * Récupère ou crée une instance de GoogleGenAI
 * En production, utiliser le proxy backend au lieu d'exposer la clé
 */
function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
    if (!apiKey) {
      throw createError('API_KEY_MISSING', 'Clé API non configurée');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Crée une erreur typée pour le service
 */
function createError(
  code: string,
  message: string,
  status?: number,
  retryable = false
): GeminiServiceError {
  const error = new Error(message) as GeminiServiceError;
  error.code = code;
  error.status = status;
  error.retryable = retryable;
  error.name = 'GeminiServiceError';
  return error;
}

/**
 * Parse une réponse JSON de manière sécurisée
 */
function safeJSONParse<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.warn('[GeminiService] Failed to parse JSON response');
    return fallback;
  }
}

/**
 * Exécute une opération avec retry et backoff exponentiel
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = GEMINI_CONFIG.retry.maxAttempts
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const geminiError = error as GeminiServiceError;

      // Ne pas retry les erreurs non-retryables
      if (geminiError.retryable === false) {
        throw error;
      }

      // Ne pas retry si c'est la dernière tentative
      if (attempt === maxAttempts) {
        throw error;
      }

      // Vérifier si l'erreur est retryable (rate limit, timeout, serveur)
      const isRetryable =
        geminiError.status === 429 ||
        geminiError.status === 503 ||
        geminiError.status === 500 ||
        geminiError.message?.includes('timeout') ||
        geminiError.message?.includes('network');

      if (!isRetryable) {
        throw error;
      }

      // Calcul du délai avec backoff exponentiel
      const delay = Math.min(
        GEMINI_CONFIG.retry.initialDelay *
          Math.pow(GEMINI_CONFIG.retry.backoffMultiplier, attempt - 1),
        GEMINI_CONFIG.retry.maxDelay
      );

      console.warn(
        `[GeminiService] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || createError('UNKNOWN_ERROR', 'Erreur inconnue');
}

// ============================================================================
// URL MANAGEMENT (for Object URLs)
// ============================================================================

const objectUrlRegistry = new Set<string>();

/**
 * Crée un Object URL et l'enregistre pour cleanup ultérieur
 */
function createTrackedObjectURL(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  objectUrlRegistry.add(url);
  return url;
}

/**
 * Révoque un Object URL
 */
export function revokeObjectURL(url: string): void {
  if (objectUrlRegistry.has(url)) {
    URL.revokeObjectURL(url);
    objectUrlRegistry.delete(url);
  }
}

/**
 * Révoque tous les Object URLs enregistrés (cleanup global)
 */
export function revokeAllObjectURLs(): void {
  objectUrlRegistry.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  objectUrlRegistry.clear();
}

// ============================================================================
// IMAGE UTILITIES
// ============================================================================

/**
 * Extrait les données base64 d'une chaîne data URL
 */
function extractBase64(dataUrl: string): string {
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
}

/**
 * Détecte le type MIME d'une image base64
 */
function detectMimeType(base64: string): string {
  if (base64.includes('image/png')) return 'image/png';
  if (base64.includes('image/webp')) return 'image/webp';
  if (base64.includes('image/gif')) return 'image/gif';
  return 'image/jpeg';
}

// ============================================================================
// CORE GENERATION FUNCTIONS
// ============================================================================

/**
 * 🧠 CYCLE 1: THE BRAIN (Financial Thesis)
 * Utilise le Thinking Mode pour une analyse d'investissement approfondie
 */
export async function generateFinancialThesis(
  item: CollectorItem,
  signal?: AbortSignal
): Promise<FinancialThesis> {
  const defaultThesis: FinancialThesis = {
    investmentRating: 'HOLD',
    volatility: 'MEDIUM',
    liquidityScore: 50,
    roiProjection5Years: 'Non disponible',
    taxImplicationHint: 'Consulter un expert fiscal',
    reasoning: 'Analyse non disponible'
  };

  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      Agis comme un gestionnaire de patrimoine spécialisé en actifs tangibles (Art, Numismatique, Philatélie).
      Objet : ${item.title} (${item.year}, ${item.country}). État : ${item.condition}.
      Valeur actuelle estimée : ${item.value}€.

      Tâche : Rédige une thèse d'investissement 'Bear & Bull'.
      1. Analyse la liquidité du marché pour cet objet spécifique.
      2. Calcule le ROI projeté à 5 ans en tenant compte de l'inflation et des tendances historiques.
      3. Identifie les risques fiscaux et de conservation.
      4. Donne un verdict : ACHETER (BUY), CONSERVER (HOLD) ou VENDRE (SELL).

      Utilise ton temps de réflexion pour croiser les données macro-économiques et les tendances du marché de l'art.
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.PRO,
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            investmentRating: {
              type: Type.STRING,
              enum: ['BUY', 'HOLD', 'SELL']
            },
            volatility: {
              type: Type.STRING,
              enum: ['LOW', 'MEDIUM', 'EXTREME']
            },
            liquidityScore: {
              type: Type.NUMBER,
              description: 'Score 0-100'
            },
            roiProjection5Years: { type: Type.STRING },
            taxImplicationHint: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: [
            'investmentRating',
            'volatility',
            'liquidityScore',
            'roiProjection5Years',
            'taxImplicationHint',
            'reasoning'
          ]
        },
        thinkingConfig: {
          thinkingBudget: getThinkingBudgetForTask('financial-thesis')
        }
      }
    });

    return safeJSONParse(response.text, defaultThesis);
  });
}

/**
 * 🕵️ CYCLE 2: THE EYES (Forensic Deep Scan)
 * Analyse multimodale avec Grounding Search pour vérifier l'authenticité
 */
export async function performDeepAnalysis(
  item: Partial<CollectorItem>,
  base64Image: string,
  signal?: AbortSignal
): Promise<AIAnalysis> {
  const defaultAnalysis: AIAnalysis = {
    authenticityScore: 0,
    rarityIndex: 'Non évalué',
    marketTrend: 'STABLE',
    estimatedValueMin: 0,
    estimatedValueMax: 0,
    historicalContext: 'Analyse non disponible',
    provenance: 'Inconnue',
    preservationAdvice: 'Consulter un expert',
    authenticityMarkers: [],
    historicalInconsistencies: [],
    visualFlaws: []
  };

  return withRetry(async () => {
    const ai = getAI();
    const imageData = extractBase64(base64Image);
    const mimeType = detectMimeType(base64Image);

    const prompt = `
      Rôle : Expert Forensique en ${item.type || 'Artefacts'}.
      Mission : Authentification et gradation technique.

      1. Analyse l'image pixel par pixel pour détecter : micro-rayures, traces de nettoyage, retouches chimiques.
      2. Utilise Google Search pour trouver des ventes récentes d'objets identiques.
      3. Génère une liste de coordonnées (x,y en pourcentage 0-100) pour les défauts détectés.

      Format JSON Strict.
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.PRO,
      contents: {
        parts: [
          { inlineData: { data: imageData, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            authenticityScore: { type: Type.NUMBER },
            rarityIndex: { type: Type.STRING },
            marketTrend: {
              type: Type.STRING,
              enum: ['UP', 'DOWN', 'STABLE']
            },
            estimatedValueMin: { type: Type.NUMBER },
            estimatedValueMax: { type: Type.NUMBER },
            historicalContext: { type: Type.STRING },
            provenance: { type: Type.STRING },
            preservationAdvice: { type: Type.STRING },
            visualFlaws: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  label: { type: Type.STRING }
                }
              }
            },
            authenticityMarkers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  description: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                }
              }
            },
            historicalInconsistencies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  issue: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  reasoning: { type: Type.STRING }
                }
              }
            },
            report: { type: Type.STRING }
          }
        },
        thinkingConfig: {
          thinkingBudget: getThinkingBudgetForTask('expert-analysis')
        }
      }
    });

    return safeJSONParse(response.text, defaultAnalysis);
  });
}

/**
 * 🎨 Image Generation avec Imagen 3
 */
export async function generateProImage(
  prompt: string,
  size: '1K' | '2K' | '4K' = '1K',
  signal?: AbortSignal
): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.IMAGEN,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: size
        }
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw createError('NO_IMAGE', 'Aucune image générée');
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw createError('NO_IMAGE_DATA', 'Données image non trouvées');
  });
}

/**
 * 🎥 CYCLE 3: THE TIME MACHINE (Veo Documentary)
 * Génère un documentaire vidéo historique basé sur l'objet
 */
export async function generateDocumentaryVideo(
  item: CollectorItem,
  signal?: AbortSignal
): Promise<string> {
  // 1. Générer l'image de contexte
  const contextImage = await generateProImage(
    `Atmosphere of ${item.country} in ${item.year}, cinematic lighting, 8k, hyper-detailed, historical accuracy, museum quality. Background for a documentary about ${item.title}.`,
    '1K',
    signal
  );

  return generateVeoVideo(contextImage,
    `Cinematic documentary shot. The camera pans slowly over a historical setting in ${item.country}, year ${item.year}. The mood is mysterious and valuable. Golden lighting.`,
    signal
  );
}

/**
 * 🎬 Génération vidéo Veo
 */
export async function generateVeoVideo(
  imageSource: string | undefined,
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  // Vérifier la disponibilité de l'API AI Studio (optionnel)
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) await (window as any).aistudio.openSelectKey();
  }

  const ai = getAI();

  const request: any = {
    model: GEMINI_CONFIG.models.VEO,
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  };

  if (imageSource) {
    request.image = {
      imageBytes: extractBase64(imageSource),
      mimeType: 'image/png'
    };
  }

  let operation = await ai.models.generateVideos(request);

  // Polling avec timeout
  const startTime = Date.now();
  const timeout = getTimeout('video');

  while (!operation.done) {
    if (Date.now() - startTime > timeout) {
      throw createError('VIDEO_TIMEOUT', 'Génération vidéo timeout');
    }

    if (signal?.aborted) {
      throw createError('ABORTED', 'Opération annulée');
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw createError('NO_VIDEO', 'Vidéo non générée');
  }

  // Télécharger et créer Object URL
  const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
  const response = await fetch(`${downloadLink}&key=${apiKey}`);

  if (!response.ok) {
    throw createError('VIDEO_DOWNLOAD_FAILED', 'Échec du téléchargement vidéo');
  }

  const blob = await response.blob();
  return createTrackedObjectURL(blob);
}

/**
 * 🖼️ Restauration d'image par IA
 */
export async function restoreItemImage(
  base64Image: string,
  signal?: AbortSignal
): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();
    const imageData = extractBase64(base64Image);
    const mimeType = detectMimeType(base64Image);

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.EDIT,
      contents: {
        parts: [
          { inlineData: { data: imageData, mimeType } },
          {
            text: 'Restore this antique item to its original mint condition. Remove scratches, dust, and oxidation. Keep original details.'
          }
        ]
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return '';
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    return '';
  });
}

/**
 * ✏️ Édition d'image avec prompt
 */
export async function editWithAI(
  base64Image: string,
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();
    const imageData = extractBase64(base64Image);
    const mimeType = detectMimeType(base64Image);

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.EDIT,
      contents: {
        parts: [
          { inlineData: { data: imageData, mimeType } },
          { text: prompt }
        ]
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return '';
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    return '';
  });
}

/**
 * 🌍 CYCLE 4: THE GUIDE (Maps Grounding)
 * Trouve les experts locaux pertinents
 */
export async function findLocalExperts(
  query: string,
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<GroundedSearchResult> {
  return withRetry(async () => {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.FLASH_LITE,
      contents: query,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng }
          }
        }
      }
    });

    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .map((chunk: any) => ({
        web: chunk.web,
        maps: chunk.maps
      }));

    return {
      text: response.text || '',
      sources
    };
  });
}

/**
 * 📊 Stratégie d'enchère avec Search Grounding
 */
export async function generateAuctionStrategy(
  item: CollectorItem,
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<AuctionStrategy> {
  const defaultStrategy: AuctionStrategy = {
    targetPrice: item.value,
    bestPlatform: 'Non déterminé',
    bestTimeToSend: 'Non déterminé',
    marketingHook: '',
    globalDemand: 'MEDIUM',
    competitorListings: [],
    locations: []
  };

  return withRetry(async () => {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.FLASH,
      contents: `Stratégie d'enchère pour ${item.title} (${item.year}, ${item.country}). Recherche spécifiquement les prix récents d'enchères pour des objets similaires.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            targetPrice: { type: Type.NUMBER },
            bestPlatform: { type: Type.STRING },
            bestTimeToSend: { type: Type.STRING },
            marketingHook: { type: Type.STRING },
            globalDemand: {
              type: Type.STRING,
              enum: ['LOW', 'MEDIUM', 'HIGH', 'FRENZY']
            },
            competitorListings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  price: { type: Type.STRING },
                  link: { type: Type.STRING }
                }
              }
            },
            locations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER },
                  type: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    return safeJSONParse(response.text, defaultStrategy);
  });
}

/**
 * 📱 Contenu social généré
 */
export async function generateSocialContent(
  item: CollectorItem,
  platform: string,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  return withRetry(async () => {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.FLASH_LITE,
      contents: `Créer un post viral pour ${item.title} sur ${platform}. Retourne en JSON avec: viralHook, hashtagStack (array), storyScript.`,
      config: { responseMimeType: 'application/json' }
    });

    return safeJSONParse(response.text, {});
  });
}

/**
 * 🔍 Détection d'objet en temps réel (Flash Lite)
 */
export async function detectObjectStream(
  base64Image: string,
  signal?: AbortSignal
): Promise<string> {
  try {
    const ai = getAI();
    const imageData = extractBase64(base64Image);

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.FLASH_LITE,
      contents: {
        parts: [
          { inlineData: { data: imageData, mimeType: 'image/jpeg' } },
          { text: 'Identify this collectible item. Be concise (max 30 chars).' }
        ]
      }
    });

    return response.text?.trim().substring(0, 40) || '';
  } catch {
    return '';
  }
}

/**
 * 📖 Biographie de l'objet
 */
export async function generateItemBiography(
  item: CollectorItem,
  signal?: AbortSignal
): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.PRO,
      contents: `Écris une courte biographie émotionnelle de cet objet: ${item.title} de ${item.year}. Perspective à la première personne de l'objet. Maximum 200 mots.`
    });

    return response.text || '';
  });
}

/**
 * 🔊 Synthèse vocale (TTS)
 */
export async function generateSpeech(
  text: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  return withRetry(async () => {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.TTS,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }
          }
        }
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  });
}

/**
 * 💬 Chat avec streaming
 */
export async function* chatWithGemini(
  message: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const ai = getAI();
  const chat = ai.chats.create({ model: GEMINI_CONFIG.models.PRO });
  const result = await chat.sendMessageStream({ message });

  for await (const chunk of result) {
    if (signal?.aborted) {
      break;
    }
    yield (chunk as any).text || '';
  }
}

/**
 * 🔍 Recherche avec grounding
 */
export async function groundedSearch(
  query: string,
  signal?: AbortSignal
): Promise<GroundedSearchResult> {
  return withRetry(async () => {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.FLASH,
      contents: query,
      config: { tools: [{ googleSearch: {} }] }
    });

    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .map((chunk: any) => ({
        web: chunk.web,
        maps: chunk.maps
      }));

    return {
      text: response.text || '',
      sources
    };
  });
}

/**
 * 🗺️ Recherche Maps avec grounding
 */
export async function groundedMapsSearch(
  query: string,
  lat?: number,
  lng?: number,
  signal?: AbortSignal
): Promise<GroundedSearchResult> {
  return withRetry(async () => {
    const ai = getAI();

    const config: any = {
      tools: [{ googleMaps: {} }]
    };

    if (lat !== undefined && lng !== undefined) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: { latitude: lat, longitude: lng }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.FLASH_LITE,
      contents: query,
      config
    });

    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .map((chunk: any) => ({
        web: chunk.web,
        maps: chunk.maps
      }));

    return {
      text: response.text || '',
      sources
    };
  });
}

/**
 * 🖼️ Génération d'arrière-plan d'époque
 */
export async function generateEraBackground(
  year: string,
  signal?: AbortSignal
): Promise<string> {
  return generateProImage(
    `Historical background texture representing the year ${year}. Abstract, atmospheric, museum quality wallpaper. Dark tones.`,
    '1K',
    signal
  );
}

/**
 * 🎬 Analyse de vidéo de collection
 */
export async function analyzeCollectionVideo(
  base64Data: string,
  mimeType: string,
  signal?: AbortSignal
): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.models.PRO,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          {
            text: 'Analyze this video of a collectible item. Describe its condition, key features, and estimated era.'
          }
        ]
      }
    });

    return response.text || '';
  });
}
