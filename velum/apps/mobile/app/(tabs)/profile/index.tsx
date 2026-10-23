/**
 * Onglet Profil, en sections claires :
 *  1. Mon compte & offre — formule actuelle (chargement / panne distingués).
 *  2. Mes espaces — carnet, envies, échanges & ventes, certifications.
 *  3. Préférences — mode senior (persisté local + profile.a11yMode), langue
 *     FR/EN, rappels de cave (réglage fourni par le chantier cave).
 *  4. Confidentialité & données — consentement IA révocable, exports CSV /
 *     rapport assurance, politique de confidentialité, CGU, suppression de
 *     compte (double confirmation).
 * Puis déconnexion et version.
 */
import type { ReactNode } from 'react';
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
  VCard,
  VListRow,
  VText,
  velumColors,
  velumSpacing,
} from '@velum/ui';

import { Screen } from '../../../components/Screen';
import { DrinkReminderSettings } from '../../../components/cellar/DrinkReminderSettings';
import { useSession } from '../../../lib/auth';
import { loadCarnetData } from '../../../lib/carnetData';
import { getVelumClient } from '../../../lib/client';
import { errorMessage } from '../../../lib/errors';
import { buildCollectionCsv, buildInsuranceReportHtml } from '../../../lib/exporters';
import { insuranceReportEntries } from '../../../lib/insuranceReportData';
import type { SupportedLocale } from '../../../lib/i18n';
import { usePlan } from '../../../lib/plan';
import { routes } from '../../../lib/routes';
import { useSettingsStore } from '../../../stores/settingsStore';
import { showToast } from '../../../stores/toastStore';

const TERMS_URL = 'https://velum.app/terms';

/** Section titrée du profil (titre = en-tête pour les lecteurs d'écran). */
function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <VText variant="heading" tone="gold" accessibilityRole="header">
        {title}
      </VText>
      <VCard style={styles.sectionCard}>{children}</VCard>
    </View>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const planState = usePlan();
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
      const data = await loadCarnetData({
        listItems: () => client.items.list(),
        latestValuation: (itemId) => client.valuations.latest(itemId),
      });
      const entries = insuranceReportEntries(data);
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

  // Formule : une panne du profil n'est jamais présentée comme « Gratuit ».
  const planSubtitle =
    planState.status === 'loading'
      ? t('common.loading')
      : planState.status === 'error'
        ? errorMessage(planState.error, t)
        : t('profile.currentPlan', { plan: t(`paywall.${planState.plan}.name`) });

  return (
    <Screen back={false}>
      <VText variant="title" accessibilityRole="header">
        {t('profile.title')}
      </VText>
      <VText variant="body" tone="dim">
        {displayName}
      </VText>

      {/* 1. MON COMPTE & OFFRE */}
      <ProfileSection title={t('profile.sections.account')}>
        <VListRow
          title={t('profile.subscription')}
          subtitle={planSubtitle}
          onPress={() => router.push(routes.paywall())}
        />
        {planState.status === 'error' ? (
          <View style={styles.inset}>
            <VButton label={t('common.retry')} variant="ghost" onPress={planState.retry} />
          </View>
        ) : null}
      </ProfileSection>

      {/* 2. MES ESPACES */}
      <ProfileSection title={t('profile.sections.spaces')}>
        <VListRow
          title={t('profile.spaces.carnet')}
          subtitle={t('profile.spaces.carnetHint')}
          onPress={() => router.push(routes.carnet())}
        />
        <VListRow
          title={t('profile.spaces.wishlist')}
          subtitle={t('profile.spaces.wishlistHint')}
          onPress={() => router.push(routes.wishlist())}
        />
        <VListRow
          title={t('profile.spaces.community')}
          subtitle={t('profile.spaces.communityHint')}
          onPress={() => router.push(routes.community())}
        />
        <VListRow
          title={t('profile.spaces.certifications')}
          subtitle={t('profile.spaces.certificationsHint')}
          onPress={() => router.push(routes.community())}
        />
      </ProfileSection>

      {/* 3. PRÉFÉRENCES */}
      <ProfileSection title={t('profile.sections.preferences')}>
        {/* Mode senior */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <VText variant="body">{t('profile.seniorMode')}</VText>
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
            <VText variant="body">{t('profile.language')}</VText>
          </View>
          <View style={styles.langButtons} accessibilityLabel={t('profile.language')}>
            <VButton
              label="FR"
              variant={locale === 'fr' ? 'primary' : 'ghost'}
              onPress={() => changeLocale('fr')}
              accessibilityHint={t('profile.languageFr')}
            />
            <VButton
              label="EN"
              variant={locale === 'en' ? 'primary' : 'ghost'}
              onPress={() => changeLocale('en')}
              accessibilityHint={t('profile.languageEn')}
            />
          </View>
        </View>

        {/* Rappels de cave : alerte ponctuelle « à boire » avec accord mets-vins. */}
        <DrinkReminderSettings />
      </ProfileSection>

      {/* 4. CONFIDENTIALITÉ & DONNÉES */}
      <ProfileSection title={t('profile.sections.privacy')}>
        {/* Consentement IA — révocable à tout moment (RGPD / règle stores 2026) */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <VText variant="body">{t('aiConsent.profileRow')}</VText>
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
        <VListRow title={t('profile.exportCsv')} onPress={() => void exportCsv()} />
        <VListRow title={t('profile.insuranceReport')} onPress={() => void exportInsuranceReport()} />
        <VListRow
          title={t('profile.privacy')}
          // In-app (exigence stores) : la même page est servie par la PWA à
          // l'URL publique https://velum.app/privacy une fois hébergée.
          onPress={() => router.push(routes.privacy())}
        />
        <VListRow title={t('profile.terms')} onPress={() => void Linking.openURL(TERMS_URL)} />
        <View style={styles.inset}>
          <VButton label={t('profile.deleteAccount')} variant="danger" onPress={confirmDeleteAccount} />
        </View>
      </ProfileSection>

      <View style={styles.footer}>
        <VButton label={t('profile.signOut')} variant="secondary" onPress={() => void doSignOut()} />
      </View>

      <VText variant="caption" tone="dim" center style={styles.version}>
        {t('profile.version', { version })}
      </VText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: velumSpacing.xl, gap: velumSpacing.sm },
  // Lignes pleine largeur (VListRow porte son propre retrait horizontal).
  sectionCard: { paddingHorizontal: 0, paddingVertical: velumSpacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.md,
    minHeight: 44,
    paddingHorizontal: velumSpacing.lg,
    paddingVertical: velumSpacing.sm,
  },
  inset: { paddingHorizontal: velumSpacing.lg, paddingVertical: velumSpacing.sm },
  rowText: { flex: 1, gap: 2 },
  langButtons: { flexDirection: 'row', gap: velumSpacing.sm },
  footer: { marginTop: velumSpacing.xl },
  version: { marginTop: velumSpacing.xl },
});
