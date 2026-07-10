/**
 * Connexion : e-mail/mot de passe, Apple (iOS), Google, réinitialisation
 * du mot de passe, mention du compte démo.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { VButton, VText, VTextInput, velumSpacing } from '@velum/ui';

import { Screen } from '../../components/Screen';
import { isAppleSignInSupported, signInWithApple, useGoogleSignIn } from '../../lib/auth';
import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { showToast } from '../../stores/toastStore';

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { available: googleAvailable, promptGoogle } = useGoogleSignIn();

  const signIn = async () => {
    setBusy(true);
    try {
      await getVelumClient().auth.signInWithEmail(email.trim(), password);
      router.replace('/(tabs)/capture');
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const apple = async () => {
    try {
      await signInWithApple();
      router.replace('/(tabs)/capture');
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  const google = async () => {
    if (!googleAvailable) {
      showToast(t('auth.googleUnavailable'), 'info');
      return;
    }
    try {
      await promptGoogle();
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  const resetPassword = async () => {
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      showToast(t('auth.resetNeedsEmail'), 'info');
      return;
    }
    try {
      await getVelumClient().supabase.auth.resetPasswordForEmail(trimmed);
      showToast(t('auth.resetSent'), 'success');
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  return (
    <Screen>
      <VText variant="title" tone="gold" center style={styles.title}>
        {t('brand.name')}
      </VText>
      <VText variant="heading" center style={styles.subtitle}>
        {t('auth.signInTitle')}
      </VText>

      <View style={styles.form}>
        <VTextInput
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="vous@exemple.fr"
        />
        <VTextInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <VButton label={t('auth.signIn')} onPress={() => void signIn()} loading={busy} />
        <VButton label={t('auth.forgotPassword')} variant="ghost" onPress={() => void resetPassword()} />

        {isAppleSignInSupported() ? (
          <VButton label={t('auth.signInWithApple')} variant="secondary" onPress={() => void apple()} />
        ) : null}
        <VButton label={t('auth.signInWithGoogle')} variant="secondary" onPress={() => void google()} />

        <VButton
          label={t('auth.noAccount')}
          variant="ghost"
          onPress={() => router.push('/(auth)/sign-up')}
        />
        <VText variant="caption" tone="dim" center>
          {t('auth.demoHint')}
        </VText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: velumSpacing.xxl },
  subtitle: { marginBottom: velumSpacing.lg },
  form: { gap: velumSpacing.md },
});
