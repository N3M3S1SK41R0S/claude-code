/**
 * Onglets principaux : Capturer / Collection / Marché / Profil.
 * Fond ink, actif or, hauteur majorée en mode senior.
 */
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSeniorMode, velumColors } from '@velum/ui';

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
        tabBarLabelStyle: { fontSize: scale(11) },
      }}
    >
      <Tabs.Screen
        name="capture/index"
        options={{
          title: t('tabs.capture'),
          tabBarAccessibilityLabel: t('tabs.capture'),
          tabBarIcon: ({ color, size }) => <Ionicons name="camera" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="collection/index"
        options={{
          title: t('tabs.collection'),
          tabBarAccessibilityLabel: t('tabs.collection'),
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="market/index"
        options={{
          title: t('tabs.market'),
          tabBarAccessibilityLabel: t('tabs.market'),
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
