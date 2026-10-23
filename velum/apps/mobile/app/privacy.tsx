/**
 * Politique de confidentialité — accessible IN-APP (exigence stores) et
 * servie par la PWA à /privacy (URL publique à déclarer dans les fiches).
 * Version de référence : docs/PRIVACY.md (les deux doivent rester alignées).
 * Retour : l'en-tête « ‹ Retour » ; sans historique (URL publique ouverte
 * directement), repli sur l'aiguillage d'entrée « / » (connexion ou accueil).
 */
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VButton, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../components/Screen';

const PRIVACY_EMAIL = 'privacy@velum.app';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Responsable de traitement',
    body:
      "VELUM (éditeur : KAIROS — coordonnées complètes dans les mentions légales) est responsable du traitement des données collectées par l'application. Contact : privacy@velum.app.",
  },
  {
    title: '2. Données collectées',
    body:
      'Compte (e-mail, nom affiché, langue) ; photos et descriptions des objets que vous soumettez volontairement ; votre collection (fiches, valorisations, alertes, emplacements) ; données d’abonnement (via RevenueCat) ; données techniques minimales de fonctionnement. Aucune donnée publicitaire, aucun pistage inter-applications.',
  },
  {
    title: '3. Finalités et bases légales',
    body:
      "Identification et estimation de vos objets par un service d'IA tiers : CONSENTEMENT explicite (RGPD 6.1.a), recueilli avant le premier envoi et révocable à tout moment dans Profil. Gestion du compte, de la collection et de l'abonnement : exécution du contrat (6.1.b). Sécurité et prévention des abus : intérêt légitime (6.1.f).",
  },
  {
    title: '4. Sous-traitants',
    body:
      'Supabase (hébergement des données, Union européenne) ; Anthropic (analyse visuelle par IA — les photos sont transmises uniquement avec votre consentement, sans usage d’entraînement sans accord) ; RevenueCat (abonnements) ; Expo (notifications push). Des accords de traitement (DPA) encadrent chaque sous-traitant.',
  },
  {
    title: '5. Durées de conservation',
    body:
      'Les données de votre compte et de votre collection sont conservées tant que le compte est actif. Les photos soumises pour analyse ne sont pas conservées par le service d’IA au-delà du traitement. À la suppression du compte, toutes les données sont purgées sans délai (voir §6).',
  },
  {
    title: '6. Vos droits',
    body:
      "Accès, rectification, effacement, portabilité (export CSV/PDF in-app), limitation, opposition et retrait du consentement à tout moment. La SUPPRESSION DE COMPTE est disponible directement dans l'application (Profil → Supprimer mon compte) : elle purge immédiatement le compte, la collection, les photos et les compteurs. Réclamation possible auprès de la CNIL.",
  },
  {
    title: '7. Sécurité',
    body:
      'Chiffrement en transit (TLS) et au repos, cloisonnement strict des données par utilisateur (Row Level Security), clés d’API confinées au serveur, journalisation des accès. Aucune donnée sensible n’est stockée sur l’appareil en clair.',
  },
  {
    title: '8. Mineurs',
    body:
      "VELUM n'est pas destiné aux moins de 16 ans et ne collecte pas sciemment de données les concernant.",
  },
  {
    title: '9. Contact',
    body:
      'privacy@velum.app — délégué à la protection des données (DPO) : à compléter avant publication. Version du 10 juillet 2026.',
  },
];

export default function Privacy() {
  const { t } = useTranslation();
  return (
    <Screen title={t('profile.privacy')} backFallback="/">
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <VText variant="heading" tone="gold" accessibilityRole="header">
            {section.title}
          </VText>
          <VText variant="body">{section.body}</VText>
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
