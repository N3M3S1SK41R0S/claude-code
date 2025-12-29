/**
 * VELUM - Utilitaire de Compression d'Images
 * Optimisation des images avant envoi à l'API Gemini
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CompressionOptions {
  /** Qualité de compression (0-1) */
  quality?: number;
  /** Largeur maximale en pixels */
  maxWidth?: number;
  /** Hauteur maximale en pixels */
  maxHeight?: number;
  /** Format de sortie */
  format?: 'jpeg' | 'png' | 'webp';
  /** Préserver le ratio d'aspect */
  preserveAspectRatio?: boolean;
}

export interface CompressionResult {
  /** Data URL de l'image compressée */
  dataUrl: string;
  /** Blob de l'image compressée */
  blob: Blob;
  /** Taille originale en bytes */
  originalSize: number;
  /** Taille compressée en bytes */
  compressedSize: number;
  /** Ratio de compression (0-1) */
  compressionRatio: number;
  /** Dimensions originales */
  originalDimensions: { width: number; height: number };
  /** Dimensions finales */
  finalDimensions: { width: number; height: number };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  quality: 0.85,
  maxWidth: 1920,
  maxHeight: 1920,
  format: 'jpeg',
  preserveAspectRatio: true
};

// Limites pour l'API Gemini
const GEMINI_MAX_SIZE = 4 * 1024 * 1024; // 4MB
const GEMINI_RECOMMENDED_SIZE = 1024 * 1024; // 1MB

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convertit un fichier en Data URL
 */
function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsDataURL(file);
  });
}

/**
 * Charge une image depuis une source
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Erreur de chargement de l\'image'));
    img.src = src;
  });
}

/**
 * Calcule les nouvelles dimensions en préservant le ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  preserveRatio: boolean
): { width: number; height: number } {
  if (!preserveRatio) {
    return {
      width: Math.min(originalWidth, maxWidth),
      height: Math.min(originalHeight, maxHeight)
    };
  }

  let width = originalWidth;
  let height = originalHeight;

  // Réduire si plus large que maxWidth
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  // Réduire si plus haut que maxHeight
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return { width, height };
}

/**
 * Obtient le type MIME pour le format
 */
function getMimeType(format: 'jpeg' | 'png' | 'webp'): string {
  const mimeTypes = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  };
  return mimeTypes[format];
}

/**
 * Estime la taille d'un data URL en bytes
 */
function estimateDataUrlSize(dataUrl: string): number {
  // Retire le préfixe data:image/...;base64,
  const base64 = dataUrl.split(',')[1] || '';
  // Base64 encode 3 bytes en 4 caractères
  return Math.ceil((base64.length * 3) / 4);
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Compresse une image avec les options spécifiées
 */
export async function compressImage(
  source: File | Blob | string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Charger l'image source
  let dataUrl: string;
  let originalSize: number;

  if (typeof source === 'string') {
    dataUrl = source;
    originalSize = estimateDataUrlSize(source);
  } else {
    dataUrl = await fileToDataUrl(source);
    originalSize = source.size;
  }

  const img = await loadImage(dataUrl);
  const originalDimensions = { width: img.width, height: img.height };

  // Calculer les nouvelles dimensions
  const finalDimensions = calculateDimensions(
    img.width,
    img.height,
    opts.maxWidth,
    opts.maxHeight,
    opts.preserveAspectRatio
  );

  // Créer le canvas et dessiner
  const canvas = document.createElement('canvas');
  canvas.width = finalDimensions.width;
  canvas.height = finalDimensions.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible de créer le contexte canvas');
  }

  // Appliquer un lissage de haute qualité
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Dessiner l'image redimensionnée
  ctx.drawImage(img, 0, 0, finalDimensions.width, finalDimensions.height);

  // Convertir en blob
  const mimeType = getMimeType(opts.format);
  const compressedDataUrl = canvas.toDataURL(mimeType, opts.quality);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Erreur de conversion en blob'));
          return;
        }

        const compressedSize = blob.size;

        resolve({
          dataUrl: compressedDataUrl,
          blob,
          originalSize,
          compressedSize,
          compressionRatio: compressedSize / originalSize,
          originalDimensions,
          finalDimensions
        });
      },
      mimeType,
      opts.quality
    );
  });
}

/**
 * Compresse une image pour l'API Gemini avec optimisation automatique
 */
export async function compressForGemini(
  source: File | Blob | string,
  targetSize: number = GEMINI_RECOMMENDED_SIZE
): Promise<CompressionResult> {
  // Première compression avec qualité haute
  let result = await compressImage(source, {
    quality: 0.9,
    maxWidth: 2048,
    maxHeight: 2048,
    format: 'jpeg'
  });

  // Si encore trop grand, réduire progressivement la qualité
  let quality = 0.85;
  while (result.compressedSize > targetSize && quality > 0.3) {
    result = await compressImage(source, {
      quality,
      maxWidth: quality < 0.6 ? 1280 : 1920,
      maxHeight: quality < 0.6 ? 1280 : 1920,
      format: 'jpeg'
    });
    quality -= 0.1;
  }

  // Si toujours trop grand, réduire les dimensions
  if (result.compressedSize > GEMINI_MAX_SIZE) {
    result = await compressImage(source, {
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
      format: 'jpeg'
    });
  }

  return result;
}

/**
 * Extrait le base64 d'un data URL
 */
export function extractBase64(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  return match ? match[1] : '';
}

/**
 * Obtient le type MIME d'un data URL
 */
export function getMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : 'image/jpeg';
}

/**
 * Vérifie si une image est valide pour Gemini
 */
export function isValidForGemini(sizeBytes: number): {
  valid: boolean;
  recommended: boolean;
  message: string;
} {
  if (sizeBytes > GEMINI_MAX_SIZE) {
    return {
      valid: false,
      recommended: false,
      message: `Image trop volumineuse (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Maximum: 4MB`
    };
  }

  if (sizeBytes > GEMINI_RECOMMENDED_SIZE) {
    return {
      valid: true,
      recommended: false,
      message: `Image volumineuse (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Recommandé: < 1MB`
    };
  }

  return {
    valid: true,
    recommended: true,
    message: 'Taille optimale'
  };
}

/**
 * Convertit un Blob en base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Erreur de conversion'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { CompressionOptions, CompressionResult };
