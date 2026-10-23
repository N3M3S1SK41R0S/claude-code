/**
 * Rappels « à boire » — partie NATIVE (expo-notifications), isolée de la
 * logique pure (drinkReminders.ts) pour rester hors de Vitest. Notifications
 * LOCALES uniquement : aucun serveur, aucun jeton push, aucune donnée sortante.
 *
 * Le module expo-notifications n'est chargé qu'à la demande et seulement sur
 * iOS / Android : sur le web, l'interface explique que la fonction n'existe
 * pas (au lieu d'échouer en silence).
 */
import { Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';

import type { ReminderContent } from './drinkReminders';

type NotificationsApi = typeof NotificationsModule;

/** Canal Android dédié (réglable par l'utilisateur dans le système). */
export const DRINK_REMINDER_CHANNEL = 'drink-reminders';

let api: NotificationsApi | null = null;

/** Chargement paresseux : jamais évalué sur le web. */
export function notificationsApi(): NotificationsApi {
  if (api === null) {
    api = require('expo-notifications') as NotificationsApi;
  }
  return api;
}

/** true si l'appareil sait programmer des notifications locales. */
export function remindersSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export type PermissionOutcome = 'granted' | 'denied' | 'unsupported';

/**
 * Crée le canal Android puis demande l'autorisation si nécessaire. Ne relance
 * jamais une demande que le système refuse de réafficher.
 */
export async function ensureReminderPermission(channelName: string): Promise<PermissionOutcome> {
  if (!remindersSupported()) return 'unsupported';
  const Notifications = notificationsApi();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DRINK_REMINDER_CHANNEL, {
      name: channelName,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
}

function toContentInput(content: ReminderContent): NotificationsModule.NotificationContentInput {
  return {
    title: content.title,
    body: content.body,
    data: { ...content.data },
    sound: true,
  };
}

/** Programme UNE notification à l'instant donné ; renvoie son identifiant. */
export async function scheduleOneShotReminder(content: ReminderContent, date: Date): Promise<string> {
  const Notifications = notificationsApi();
  return Notifications.scheduleNotificationAsync({
    content: toContentInput(content),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: DRINK_REMINDER_CHANNEL,
    },
  });
}

/** Programme le rappel hebdomadaire (weekday : 1 = dimanche … 7 = samedi). */
export async function scheduleWeeklyReminder(
  content: ReminderContent,
  slot: { weekday: number; hour: number; minute: number },
): Promise<string> {
  const Notifications = notificationsApi();
  return Notifications.scheduleNotificationAsync({
    content: toContentInput(content),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: slot.weekday,
      hour: slot.hour,
      minute: slot.minute,
      channelId: DRINK_REMINDER_CHANNEL,
    },
  });
}

/** Annule une notification programmée (identifiant absent → rien à faire). */
export async function cancelReminder(id: string | null | undefined): Promise<void> {
  if (!id || !remindersSupported()) return;
  await notificationsApi().cancelScheduledNotificationAsync(id);
}
