/**
 * Onglets principaux : Capturer / Collection / Marché / Profil.
 * Fond ink, actif or (icône pleine), inactif parchemin (icône contour) :
 * l'onglet courant se repère sans dépendre de la seule couleur. Hauteur et
 * libellés majorés en mode senior ; chaque onglet annonce son contenu
 * (« Marché — échanges, ventes, alertes »…) aux lecteurs d'écran.
 */
import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSeniorMode, velumColors } from '@velum/ui';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Icône d'onglet : pleine si active, contour sinon. */
function tabIcon(active: IoniconName, inactive: IoniconName) {
  return function TabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { senior, scale } = useSeniorMode();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: velumColors.gold.soft,
        tabBarInactiveTintColor: velumColors.parchment.faint,
        tabBarStyle: {
          backgroundColor: velumColors.ink.soft,
          borderTopColor: velumColors.ink.border,
          height: senior ? 84 : 64,
          paddingBottom: senior ? 16 : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: scale(12), fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="capture/index"
        options={{
          title: t('tabs.capture'),
          tabBarAccessibilityLabel: t('tabs.captureA11y'),
          tabBarIcon: tabIcon('camera', 'camera-outline'),
        }}
      />
      <Tabs.Screen
        name="collection/index"
        options={{
          title: t('tabs.collection'),
          tabBarAccessibilityLabel: t('tabs.collectionA11y'),
          tabBarIcon: tabIcon('albums', 'albums-outline'),
        }}
      />
      <Tabs.Screen
        name="market/index"
        options={{
          title: t('tabs.market'),
          tabBarAccessibilityLabel: t('tabs.marketA11y'),
          tabBarIcon: tabIcon('storefront', 'storefront-outline'),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profileA11y'),
          tabBarIcon: tabIcon('person-circle', 'person-circle-outline'),
        }}
      />
    </Tabs>
  );
}
