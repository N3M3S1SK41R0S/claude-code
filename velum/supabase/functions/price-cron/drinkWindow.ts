/**
 * Contenu de l'alerte « à boire » (`drink_window`) — fonction PURE, testée.
 *
 * Le déclenchement reste piloté par `record_alert_evaluation` (une seule
 * notification au passage faux → vrai : aucune relance quotidienne). Ce module
 * ne fait que rédiger un message utile : le vin, sa POSITION dans la cave pour
 * aller le chercher, et deux plats issus de la fiche ZAPPA.
 */
import { formatCellarLocationShort, peakStatus, validDrinkWindow } from '@velum/domain-wine';

/** Route ouverte quand l'utilisateur touche la notification push. */
export const DRINK_WINDOW_ROUTE = '/cellar-peak';

export interface DrinkWindowNotificationInput {
  /** Titre de l'objet (peut être absent en base). */
  label: string | null;
  /** `items.storage_location` (format canonique ou texte libre). */
  storageLocation: string | null | undefined;
  /** Payload d'analyse relu depuis JSONB : non fiable par construction. */
  payload: unknown;
  currentYear: number;
}

export interface DrinkWindowNotificationContent {
  title: string;
  body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Jusqu'à `max` plats non vides et distincts (défensif : JSONB). */
export function pairingsFromPayload(payload: unknown, max = 2): string[] {
  if (!isRecord(payload)) return [];
  const comparisons = payload['comparisons'];
  if (!isRecord(comparisons) || !Array.isArray(comparisons['foodPairings'])) return [];
  const dishes: string[] = [];
  for (const raw of comparisons['foodPairings']) {
    if (typeof raw !== 'string') continue;
    const dish = raw.trim();
    if (dish.length > 0 && !dishes.includes(dish)) dishes.push(dish);
    if (dishes.length >= max) break;
  }
  return dishes;
}

function drinkWindowOf(payload: unknown): { from: number; to: number } | null {
  if (!isRecord(payload)) return null;
  const tasting = payload['tasting'];
  if (!isRecord(tasting)) return null;
  const window = tasting['drinkWindow'];
  return isRecord(window) ? validDrinkWindow(window) : null;
}

/**
 * Titre et corps de la notification « à boire », en français :
 * « Bandol 2015 est dans sa fenêtre de consommation optimale (jusqu'en 2026).
 *   Emplacement : Rangée 2 · Col. 4 · Pl. 1. Accord suggéré : gigot d’agneau
 *   ou daube provençale. »
 */
export function drinkWindowNotification(input: DrinkWindowNotificationInput): DrinkWindowNotificationContent {
  const label = input.label?.trim() || 'Une de vos bouteilles';
  const window = drinkWindowOf(input.payload);
  const status = peakStatus(window, input.currentYear);
  const location = formatCellarLocationShort(input.storageLocation);
  const pairings = pairingsFromPayload(input.payload, 2);

  const title =
    status === 'closing' ? 'À boire — dernière année d’apogée' : 'À boire — apogée atteinte';
  const body =
    `${label} est dans sa fenêtre de consommation optimale` +
    (window ? ` (jusqu'en ${window.to})` : '') +
    '.' +
    (location ? ` Emplacement : ${location}.` : '') +
    (pairings.length > 0 ? ` Accord suggéré : ${pairings.join(' ou ')}.` : '');
  return { title, body };
}
