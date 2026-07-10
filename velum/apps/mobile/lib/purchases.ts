/**
 * Abonnements RevenueCat — chargement paresseux de react-native-purchases.
 * En Expo Go / web (module natif absent), mode dégradé : les paliers sont
 * listés à titre indicatif, sans achat possible.
 */
import { Platform } from 'react-native';

/** Palier affiché sur le paywall — natif (RevenueCat) ou statique (dégradé). */
export interface PaywallTier {
  id: 'free' | 'premium' | 'gold' | 'platine';
  /** Prix localisé RevenueCat si disponible, sinon libellé statique i18n. */
  priceLabel: string | null;
  /** Package RevenueCat opaque — présent uniquement en mode natif. */
  nativePackage: unknown | null;
}

export interface OfferingsResult {
  /** false → mode dégradé (Expo Go / web) : affichage indicatif seulement. */
  purchasesAvailable: boolean;
  tiers: PaywallTier[];
}

/** Sous-ensemble typé de l'API react-native-purchases consommée ici. */
interface PurchasesModule {
  configure(config: { apiKey: string }): void;
  getOfferings(): Promise<{
    current: {
      availablePackages: {
        identifier: string;
        product: { priceString: string; identifier: string };
      }[];
    } | null;
  }>;
  purchasePackage(pkg: unknown): Promise<unknown>;
  restorePurchases(): Promise<{ entitlements: { active: Record<string, unknown> } }>;
}

let purchasesPromise: Promise<PurchasesModule | null> | null = null;

async function loadPurchases(): Promise<PurchasesModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    const mod = (await import('react-native-purchases')) as unknown as {
      default: PurchasesModule;
    };
    const purchases = mod.default;
    const apiKey =
      Platform.OS === 'ios'
        ? process.env['EXPO_PUBLIC_REVENUECAT_IOS_KEY']
        : process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'];
    if (!apiKey) return null;
    purchases.configure({ apiKey });
    return purchases;
  } catch {
    // Expo Go : module natif absent → mode dégradé.
    return null;
  }
}

function getPurchases(): Promise<PurchasesModule | null> {
  if (purchasesPromise === null) purchasesPromise = loadPurchases();
  return purchasesPromise;
}

/** Paliers statiques du mode dégradé — les prix i18n viennent du paywall. */
const STATIC_TIERS: PaywallTier[] = [
  { id: 'free', priceLabel: null, nativePackage: null },
  { id: 'premium', priceLabel: null, nativePackage: null },
  { id: 'gold', priceLabel: null, nativePackage: null },
  { id: 'platine', priceLabel: null, nativePackage: null },
];

/** Fait correspondre un identifiant de package RevenueCat à un palier VELUM. */
function tierIdFor(identifier: string): 'premium' | 'gold' | 'platine' | null {
  const lower = identifier.toLowerCase();
  if (lower.includes('platine') || lower.includes('platinum')) return 'platine';
  if (lower.includes('gold')) return 'gold';
  if (lower.includes('premium')) return 'premium';
  return null;
}

export async function getOfferings(): Promise<OfferingsResult> {
  const purchases = await getPurchases();
  if (purchases === null) {
    return { purchasesAvailable: false, tiers: STATIC_TIERS };
  }
  try {
    const offerings = await purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const tiers: PaywallTier[] = [{ id: 'free', priceLabel: null, nativePackage: null }];
    for (const id of ['premium', 'gold', 'platine'] as const) {
      const pkg = packages.find((p) => tierIdFor(p.identifier) === id);
      tiers.push({
        id,
        priceLabel: pkg ? pkg.product.priceString : null,
        nativePackage: pkg ?? null,
      });
    }
    return { purchasesAvailable: true, tiers };
  } catch {
    return { purchasesAvailable: false, tiers: STATIC_TIERS };
  }
}

/** Achète un package RevenueCat. Lève en mode dégradé. */
export async function purchase(pkg: unknown): Promise<void> {
  const purchases = await getPurchases();
  if (purchases === null || pkg === null) {
    throw new Error('Achats indisponibles dans cet environnement');
  }
  await purchases.purchasePackage(pkg);
}

/** « Restaurer les achats » — OBLIGATOIRE App Store. Renvoie true si un droit actif. */
export async function restore(): Promise<boolean> {
  const purchases = await getPurchases();
  if (purchases === null) {
    throw new Error('Achats indisponibles dans cet environnement');
  }
  const info = await purchases.restorePurchases();
  return Object.keys(info.entitlements.active).length > 0;
}
