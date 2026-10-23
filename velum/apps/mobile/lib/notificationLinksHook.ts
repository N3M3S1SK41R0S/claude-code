/**
 * Ouverture des notifications : toucher un rappel « à boire » (local) ou une
 * alerte `drink_window` (push serveur) ouvre l'écran interne indiqué dans
 * `data.url` — uniquement s'il figure dans la liste blanche (notificationLinks.ts).
 * Branché une fois dans le layout racine. Sans effet sur le web.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';

import { notificationsApi, remindersSupported } from './drinkRemindersNative';
import { routeFromNotificationData } from './notificationLinks';

export function useNotificationLinks(): void {
  useEffect(() => {
    if (Platform.OS === 'web' || !remindersSupported()) return;
    let active = true;
    const Notifications = notificationsApi();

    // Affiche aussi les rappels reçus app ouverte (bannière + centre de notifications).
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const open = (data: unknown) => {
      const route = routeFromNotificationData(data);
      if (!route) return;
      try {
        router.push(route as Href);
      } catch {
        // Navigation pas encore prête : l'utilisateur reste sur l'écran courant.
      }
    };

    // Démarrage à froid depuis une notification : la traiter une seule fois.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!active || !response) return;
        open(response.notification.request.content.data);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification.request.content.data);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
}
