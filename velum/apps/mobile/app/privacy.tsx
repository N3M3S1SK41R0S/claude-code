/**
 * Politique de confidentialité — accessible IN-APP (exigence stores) et
 * servie par la PWA à /privacy (URL publique à déclarer dans les fiches).
 * Version de référence : docs/PRIVACY.md (les deux doivent rester alignées) ;
 * textes i18n FR / EN (namespace `privacy`).
 * Retour : l'en-tête « ‹ Retour » ; sans historique (URL publique ouverte
 * directement), repli sur l'aiguillage d'entrée « / » (connexion ou accueil).
 */
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VButton, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../components/Screen';

const PRIVACY_EMAIL = 'privacy@velum.app';

/**
 * Sections de la politique (textes i18n `privacy.<clé>.title|body`, FR / EN) :
 * compte, collection, liste d'envies, échanges & ventes (pseudonyme, annonces,
 * transactions, messages expurgés, registre), rappels « à boire » locaux.
 */
const SECTION_KEYS = [
  'controller',
  'data',
  'purposes',
  'processors',
  'retention',
  'rights',
  'security',
  'minors',
  'contact',
] as const;

export default function Privacy() {
  const { t } = useTranslation();
  return (
    <Screen title={t('profile.privacy')} backFallback="/">
      {SECTION_KEYS.map((key) => (
        <View key={key} style={styles.section}>
          <VText variant="heading" tone="gold" accessibilityRole="header">
            {t(`privacy.${key}.title`)}
          </VText>
          <VText variant="body">{t(`privacy.${key}.body`)}</VText>
        </View>
      ))}
      {/* Action utile en fin de page (exercer ses droits) — c'est aussi
          l'élément focalisable qui rend la zone défilante accessible au
          clavier (axe : scrollable-region-focusable). */}
      <View style={styles.section}>
        <VButton
          label={t('profile.privacyContact', { email: PRIVACY_EMAIL })}
          variant="secondary"
          onPress={() => void Linking.openURL(`mailto:${PRIVACY_EMAIL}`).catch(() => undefined)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: velumSpacing.lg, gap: velumSpacing.xs },
});
