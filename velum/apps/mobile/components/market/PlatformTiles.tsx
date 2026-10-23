/**
 * Tuiles « une plateforme par catégorie » (Vins, Pièces, Tableaux, Timbres,
 * Montres + Toutes) et accès direct à « Mon activité ». Chaque tuile ouvre le
 * catalogue filtré (routes.community(domain)).
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { VelumDomain } from '@velum/core';
import { VButton, VCard, VText, useSeniorMode, velumColors, velumSpacing } from '@velum/ui';

import { ModuleGlyph } from '../ModuleGlyph';
import { getActiveDomains } from '../../lib/features';
import { communityActivityHref } from '../../lib/marketQuery';
import { routes } from '../../lib/routes';

export function PlatformTiles() {
  const { t } = useTranslation();
  const router = useRouter();
  const { scale } = useSeniorMode();
  const options: (VelumDomain | null)[] = [...getActiveDomains(), null];

  return (
    <View style={styles.container}>
      <View style={styles.tiles}>
        {options.map((domain) => {
          const name = domain ? t(`domains.${domain}.name`) : t('market.allPlatforms');
          const hint = domain ? t('market.platformHint', { category: name }) : t('market.allPlatformsHint');
          return (
            <VCard
              key={domain ?? 'all'}
              onPress={() => router.push(routes.community(domain))}
              accessibilityLabel={domain ? t('market.platformOf', { category: name }) : name}
              accessibilityHint={hint}
              style={styles.tile}
            >
              {domain ? (
                <ModuleGlyph domain={domain} size={scale(36)} />
              ) : (
                <Ionicons name="apps-outline" size={scale(32)} color={velumColors.gold.soft} />
              )}
              <VText variant="body" tone="gold" center>
                {name}
              </VText>
            </VCard>
          );
        })}
      </View>
      <VButton
        label={t('market.myActivity')}
        variant="secondary"
        onPress={() => router.push(communityActivityHref())}
        accessibilityHint={t('market.myActivityHint')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm },
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: velumSpacing.xs,
    paddingVertical: velumSpacing.md,
  },
});
