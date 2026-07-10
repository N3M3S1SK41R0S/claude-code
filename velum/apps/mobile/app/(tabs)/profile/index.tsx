/**
 * Onglet Profil : mode senior (persisté local + profile.a11yMode), langue
 * FR/EN, abonnement, exports CSV / rapport assurance, liens légaux,
 * suppression de compte (double confirmation), déconnexion, version.
 */
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  useSeniorMode,
  VButton,
  VListRow,
  VText,
  velumColors,
  velumSpacing,
} from '@velum/ui';

import { Screen } from '../../../components/Screen';
import { useSession } from '../../../lib/auth';
import { getVelumClient } from '../../../lib/client';
import { errorMessage } from '../../../lib/errors';
import { buildCollectionCsv, buildInsuranceReportHtml } from '../../../lib/exporters';
import type { SupportedLocale } from '../../../lib/i18n';
import { useSettingsStore } from '../../../stores/settingsStore';
import { showToast } from '../../../stores/toastStore';

const PRIVACY_URL = 'https://velum.app/privacy';
const TERMS_URL = 'https://velum.app/terms';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const { session, signOut } = useSession();
  const { senior, setSenior } = useSeniorMode();
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const aiConsent = useSettingsStore((s) => s.aiConsent);
  const setAiConsent = useSettingsStore((s) => s.setAiConsent);

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => client.profile.get(),
    enabled: session !== null,
  });

  const changeLocale = (next: SupportedLocale) => {
    setLocale(next);
    client.profile.update({ locale: next }).catch(() => undefined);
  };

  const exportCsv = async () => {
    try {
      const items = await client.items.list();
      const csv = buildCollectionCsv(items);
      const path = `${FileSystem.cacheDirectory ?? ''}velum-collection.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv' });
      } else {
        showToast(t('profile.exportCsvDone'), 'success');
      }
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  const exportInsuranceReport = async () => {
    try {
      const items = await client.items.list();
      const entries = await Promise.all(
        items.map(async (item) => ({
          item,
          valuation: await client.valuations.latest(item.id).catch(() => null),
        })),
      );
      const html = buildInsuranceReportHtml(
        entries,
        (key, options) => t(key, options ?? {}) as string,
      );
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch (error) {
      showToast(errorMessage(error, t), 'danger');
    }
  };

  const confirmDeleteAccount = () => {
    // Double confirmation obligatoire avant purge RGPD.
    Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.continue'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            t('profile.deleteAccountConfirmTitle'),
            t('profile.deleteAccountConfirmMessage'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    try {
                      await client.auth.deleteAccount();
                      await signOut();
                      showToast(t('profile.deleteAccountDone'), 'success');
                      router.replace('/(auth)/sign-in');
                    } catch (error) {
                      showToast(errorMessage(error, t), 'danger');
                    }
                  })();
                },
              },
            ],
          );
        },
      },
    ]);
  };

  const doSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const displayName =
    profileQuery.data?.displayName ?? session?.user?.email ?? t('common.unknown');

  return (
    <Screen>
      <VText variant="title">{t('profile.title')}</VText>
      <VText variant="body" tone="dim">
        {displayName}
      </VText>

      <View style={styles.section}>
        {/* Mode senior */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <VText variant="heading">{t('profile.seniorMode')}</VText>
            <VText variant="caption" tone="dim">
              {t('profile.seniorModeHint')}
            </VText>
          </View>
          <Switch
            value={senior}
            onValueChange={setSenior}
            accessibilityLabel={t('profile.seniorMode')}
            trackColor={{ true: velumColors.gold.faint, false: velumColors.ink.border }}
            thumbColor={senior ? velumColors.gold.DEFAULT : velumColors.parchment.dim}
          />
        </View>

        {/* Langue */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <VText variant="heading">{t('profile.language')}</VText>
          </View>
          <View style={styles.langButtons}>
            <VButton
              label="FR"
              variant={locale === 'fr' ? 'primary' : 'ghost'}
              onPress={() => changeLocale('fr')}
            />
            <VButton
              label="EN"
              variant={locale === 'en' ? 'primary' : 'ghost'}
              onPress={() => changeLocale('en')}
            />
          </View>
        </View>

        {/* Consentement IA — révocable à tout moment (RGPD / règle stores 2026) */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <VText variant="heading">{t('aiConsent.profileRow')}</VText>
            <VText variant="caption" tone="dim">
              {aiConsent === true
                ? t('aiConsent.granted')
                : aiConsent === false
                  ? t('aiConsent.denied')
                  : t('aiConsent.notAsked')}
            </VText>
          </View>
          <Switch
            value={aiConsent === true}
            onValueChange={setAiConsent}
            accessibilityLabel={t('aiConsent.profileRow')}
            trackColor={{ true: velumColors.gold.faint, false: velumColors.ink.border }}
            thumbColor={aiConsent === true ? velumColors.gold.DEFAULT : velumColors.parchment.dim}
          />
        </View>

        <VListRow
          title={t('profile.subscription')}
          subtitle={t('profile.subscriptionHint')}
          onPress={() => router.push('/paywall')}
        />
        <VListRow title={t('profile.exportCsv')} onPress={() => void exportCsv()} />
        <VListRow title={t('profile.insuranceReport')} onPress={() => void exportInsuranceReport()} />
        <VListRow
          title={t('profile.privacy')}
          onPress={() => void Linking.openURL(PRIVACY_URL)}
        />
        <VListRow title={t('profile.terms')} onPress={() => void Linking.openURL(TERMS_URL)} />
      </View>

      <View style={styles.section}>
        <VButton label={t('profile.signOut')} variant="secondary" onPress={() => void doSignOut()} />
        <VButton label={t('profile.deleteAccount')} variant="danger" onPress={confirmDeleteAccount} />
      </View>

      <VText variant="caption" tone="dim" center style={styles.version}>
        {t('profile.version', { version })}
      </VText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: velumSpacing.xl, gap: velumSpacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.md,
    minHeight: 44,
  },
  rowText: { flex: 1, gap: 2 },
  langButtons: { flexDirection: 'row', gap: velumSpacing.sm },
  version: { marginTop: velumSpacing.xl },
});
