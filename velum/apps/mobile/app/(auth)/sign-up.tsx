/**
 * Création de compte : e-mail/mot de passe (validation locale), Apple (iOS),
 * Google, mention du compte démo.
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

export default function SignUp() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const { available: googleAvailable, promptGoogle } = useGoogleSignIn();

  const signUp = async () => {
    const trimmed = email.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    setEmailError(validEmail ? undefined : t('auth.invalidEmail'));
    if (password.length < 8) {
      setPasswordError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setPasswordError(t('auth.passwordMismatch'));
      return;
    }
    setPasswordError(undefined);
    if (!validEmail) return;

    setBusy(true);
    try {
      const session = await getVelumClient().auth.signUpWithEmail(trimmed, password);
      if (session === null) {
        // Confirmation e-mail requise avant la première session.
        showToast(t('auth.confirmEmail'), 'success');
        router.replace('/(auth)/sign-in');
      } else {
        router.replace('/(tabs)/capture');
      }
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

  return (
    <Screen brand={false}>
      <VText variant="title" tone="gold" center style={styles.title}>
        {t('brand.name')}
      </VText>
      <VText variant="heading" center style={styles.subtitle}>
        {t('auth.signUpTitle')}
      </VText>

      <View style={styles.form}>
        <VTextInput
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="vous@exemple.fr"
          error={emailError}
        />
        <VTextInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <VTextInput
          label={t('auth.passwordConfirm')}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          error={passwordError}
        />
        <VButton label={t('auth.signUp')} onPress={() => void signUp()} loading={busy} />

        {isAppleSignInSupported() ? (
          <VButton label={t('auth.signInWithApple')} variant="secondary" onPress={() => void apple()} />
        ) : null}
        <VButton label={t('auth.signInWithGoogle')} variant="secondary" onPress={() => void google()} />

        <VButton
          label={t('auth.haveAccount')}
          variant="ghost"
          onPress={() => router.push('/(auth)/sign-in')}
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
