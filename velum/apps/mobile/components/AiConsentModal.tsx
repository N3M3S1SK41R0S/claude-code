/**
 * Consentement au traitement IA (RGPD 6.1.a + règle App Review 2026, 5.1.2) :
 * affiché AVANT le premier envoi d'une photo ou d'un texte au service d'IA.
 * Refusable — l'app reste utilisable (import de fichier, saisie manuelle) ;
 * révocable à tout moment depuis l'onglet Profil.
 */
import { Modal, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { VButton, VCard, VText, velumSpacing } from '@velum/ui';

export const PRIVACY_POLICY_URL = 'https://velum.app/privacy';

export interface AiConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function AiConsentModal({ visible, onAccept, onDecline }: AiConsentModalProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <VCard style={styles.card}>
          <VText variant="heading" tone="gold">
            {t('aiConsent.title')}
          </VText>
          <VText variant="body">{t('aiConsent.body')}</VText>
          <VButton
            label={t('aiConsent.privacyLink')}
            variant="ghost"
            onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
          />
          <VButton label={t('aiConsent.accept')} onPress={onAccept} />
          <VButton label={t('aiConsent.decline')} variant="secondary" onPress={onDecline} />
        </VCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: velumSpacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: { gap: velumSpacing.md },
});
