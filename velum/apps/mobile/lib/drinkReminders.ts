/**
 * Rappels « à boire » — partie PURE (testée sous Vitest, horloge injectée) :
 * choix de l'instant (« ce soir 19 h », « demain 19 h », « vendredi 18 h » ou
 * heure libre), choix du vin le plus urgent à l'apogée, contenu de la
 * notification (vin, emplacement, plat suggéré) et préférences persistées.
 * La planification native (expo-notifications) vit dans drinkRemindersNative.ts.
 */
import type { CellarPeakEntry } from '@velum/core';
import { mostUrgentPeakWine } from '@velum/domain-wine';

import { positionLabel, type Translate } from './cellarPeak';

/** Route ouverte quand on touche la notification. */
export const DRINK_REMINDER_ROUTE = '/cellar-peak';

export type ReminderPreset = 'tonight' | 'tomorrow' | 'friday' | 'custom';

export const REMINDER_PRESETS: readonly ReminderPreset[] = ['tonight', 'tomorrow', 'friday', 'custom'];

export interface ReminderTime {
  hour: number;
  minute: number;
}

/** Heures par défaut des raccourcis. */
export const PRESET_TIMES: Record<Exclude<ReminderPreset, 'custom'>, ReminderTime> = {
  tonight: { hour: 19, minute: 0 },
  tomorrow: { hour: 19, minute: 0 },
  friday: { hour: 18, minute: 0 },
};

const FRIDAY = 5;
/** Marge minimale avant le déclenchement (évite une notification « déjà passée »). */
const MIN_LEAD_MS = 60_000;

function isValidTime(time: ReminderTime): boolean {
  return (
    Number.isInteger(time.hour) &&
    Number.isInteger(time.minute) &&
    time.hour >= 0 &&
    time.hour <= 23 &&
    time.minute >= 0 &&
    time.minute <= 59
  );
}

function at(base: Date, dayOffset: number, time: ReminderTime): Date {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, time.hour, time.minute, 0, 0);
  return date;
}

/**
 * Prochaine occurrence de l'instant choisi, en heure LOCALE, toujours dans le
 * futur (≥ 1 min) : « ce soir » passé 19 h devient demain 19 h ; « vendredi »
 * un vendredi après 18 h devient le vendredi suivant ; heure libre déjà
 * passée → demain. null si l'heure libre est invalide.
 */
export function nextReminderDate(preset: ReminderPreset, now: Date, custom?: ReminderTime): Date | null {
  const time = preset === 'custom' ? custom : PRESET_TIMES[preset];
  if (!time || !isValidTime(time)) return null;
  const threshold = now.getTime() + MIN_LEAD_MS;
  if (preset === 'tomorrow') return at(now, 1, time);
  if (preset === 'friday') {
    const delta = (FRIDAY - now.getDay() + 7) % 7;
    const candidate = at(now, delta, time);
    return candidate.getTime() >= threshold ? candidate : at(now, delta + 7, time);
  }
  const today = at(now, 0, time);
  return today.getTime() >= threshold ? today : at(now, 1, time);
}

/** Heure saisie librement : « 19:30 », « 19h30 », « 19 h », « 7 » → { hour, minute }. */
export function parseTimeInput(text: string): ReminderTime | null {
  const match = /^\s*(\d{1,2})\s*(?:[:hH.]\s*(\d{2})?)?\s*$/.exec(text);
  if (!match || match[1] === undefined) return null;
  const time = { hour: Number.parseInt(match[1], 10), minute: match[2] === undefined ? 0 : Number.parseInt(match[2], 10) };
  return isValidTime(time) ? time : null;
}

/** « 19:05 » (24 h, deux chiffres). */
export function formatReminderTime(time: ReminderTime): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

/** « vendredi 23 octobre à 19:00 » / « Friday 23 October at 19:00 » (heure locale). */
export function formatReminderWhen(date: Date, locale: string): string {
  const en = locale.toLowerCase().startsWith('en');
  const day = new Intl.DateTimeFormat(en ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  const time = formatReminderTime({ hour: date.getHours(), minute: date.getMinutes() });
  return en ? `${day} at ${time}` : `${day} à ${time}`;
}

/** Jour de la semaine au format expo-notifications (1 = dimanche … 7 = samedi). */
export function toExpoWeekday(jsDay: number): number {
  return (((jsDay % 7) + 7) % 7) + 1;
}

/** Le vin à mettre en avant : le plus urgent à boire (jamais « l'an prochain »). */
export function pickReminderWine(entries: readonly CellarPeakEntry[]): CellarPeakEntry | null {
  return mostUrgentPeakWine(entries);
}

export interface ReminderContent {
  title: string;
  body: string;
  data: { url: string; itemId?: string };
}

/**
 * Contenu du rappel ponctuel : « Ce soir : Bandol Tempier 2015 (Rangée 2 ·
 * Col. 4) — accord : gigot d’agneau ». « Ce soir » à partir de 16 h,
 * « Aujourd’hui » avant. null s'il n'y a aucun vin à boire.
 */
export function buildReminderContent(
  wine: CellarPeakEntry | null,
  when: Date,
  t: Translate,
): ReminderContent | null {
  if (!wine) return null;
  const lead = when.getHours() >= 16 ? t('reminders.leadEvening') : t('reminders.leadDay');
  const position = positionLabel(wine.storageLocation, t, { short: true });
  const dish = wine.suggestedDishes[0];
  let body = t('reminders.bodyLabel', { lead, label: wine.label });
  if (position) body += t('reminders.bodyPosition', { position });
  if (dish) body += t('reminders.bodyDish', { dish });
  return {
    title: t(`reminders.title.${wine.status === 'soon' ? 'peak' : wine.status}`),
    body,
    data: { url: DRINK_REMINDER_ROUTE, itemId: wine.itemId },
  };
}

/**
 * Contenu du rappel hebdomadaire (figé à la programmation, rafraîchi à chaque
 * ouverture de l'écran) : nombre de vins à boire et le plus urgent.
 */
export function buildWeeklyContent(entries: readonly CellarPeakEntry[], t: Translate): ReminderContent {
  const drinkable = entries.filter((entry) => entry.status !== 'soon');
  const top = pickReminderWine(entries);
  if (!top) {
    return {
      title: t('reminders.weeklyTitle'),
      body: t('reminders.weeklyEmpty'),
      data: { url: DRINK_REMINDER_ROUTE },
    };
  }
  const position = positionLabel(top.storageLocation, t, { short: true });
  let body = t('reminders.weeklyBody', { count: drinkable.length, label: top.label });
  if (position) body += t('reminders.bodyPosition', { position });
  return { title: t('reminders.weeklyTitle'), body, data: { url: DRINK_REMINDER_ROUTE, itemId: top.itemId } };
}

/** Empreinte d'un contenu : évite de reprogrammer à l'identique. */
export function contentKey(content: Pick<ReminderContent, 'title' | 'body'>): string {
  return `${content.title}\n${content.body}`;
}

/* ------------------------------------------------------------------ */
/* Préférences persistées (settingsStore) — normalisation défensive    */
/* ------------------------------------------------------------------ */

export interface DrinkReminderPrefs {
  /** Dernier instant choisi (pré-sélection). */
  preset: ReminderPreset;
  /** Heure libre (preset 'custom'). */
  customHour: number;
  customMinute: number;
  /** Rappel ponctuel programmé : identifiant natif, instant ISO, vin mis en avant. */
  oneShotId: string | null;
  oneShotAt: string | null;
  oneShotLabel: string | null;
  /** Rappel hebdomadaire facultatif. */
  weekly: boolean;
  weeklyId: string | null;
  /** 1 = dimanche … 7 = samedi (format expo-notifications). */
  weeklyWeekday: number;
  weeklyHour: number;
  weeklyMinute: number;
  /** Empreinte du contenu hebdomadaire programmé. */
  weeklyContentKey: string | null;
}

export const DEFAULT_DRINK_REMINDER_PREFS: DrinkReminderPrefs = {
  preset: 'tonight',
  customHour: 19,
  customMinute: 30,
  oneShotId: null,
  oneShotAt: null,
  oneShotLabel: null,
  weekly: false,
  weeklyId: null,
  weeklyWeekday: 6,
  weeklyHour: 18,
  weeklyMinute: 0,
  weeklyContentKey: null,
};

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Préférences relues du stockage (versions antérieures, valeurs corrompues) → valeurs sûres. */
export function normalizeDrinkReminderPrefs(raw: unknown): DrinkReminderPrefs {
  const d = DEFAULT_DRINK_REMINDER_PREFS;
  if (!raw || typeof raw !== 'object') return { ...d };
  const r = raw as Record<string, unknown>;
  const preset = REMINDER_PRESETS.includes(r['preset'] as ReminderPreset) ? (r['preset'] as ReminderPreset) : d.preset;
  const oneShotAt = stringOrNull(r['oneShotAt']);
  return {
    preset,
    customHour: intIn(r['customHour'], 0, 23, d.customHour),
    customMinute: intIn(r['customMinute'], 0, 59, d.customMinute),
    oneShotId: stringOrNull(r['oneShotId']),
    oneShotAt: oneShotAt !== null && Number.isFinite(Date.parse(oneShotAt)) ? oneShotAt : null,
    oneShotLabel: stringOrNull(r['oneShotLabel']),
    weekly: r['weekly'] === true,
    weeklyId: stringOrNull(r['weeklyId']),
    weeklyWeekday: intIn(r['weeklyWeekday'], 1, 7, d.weeklyWeekday),
    weeklyHour: intIn(r['weeklyHour'], 0, 23, d.weeklyHour),
    weeklyMinute: intIn(r['weeklyMinute'], 0, 59, d.weeklyMinute),
    weeklyContentKey: stringOrNull(r['weeklyContentKey']),
  };
}

/** Rappel ponctuel : aucun, programmé (à venir) ou déjà passé. */
export function oneShotStatus(prefs: DrinkReminderPrefs, now: Date): 'none' | 'scheduled' | 'delivered' {
  if (prefs.oneShotAt === null) return 'none';
  const when = Date.parse(prefs.oneShotAt);
  if (!Number.isFinite(when)) return 'none';
  return when > now.getTime() ? 'scheduled' : 'delivered';
}
