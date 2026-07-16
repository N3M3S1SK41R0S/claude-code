/**
 * Onglet Marché : centre de notifications (table `notifications`), alertes
 * actives, section Marketplace « Bientôt disponible » (flag OFF).
 *
 * Chaque source possède son propre état loading/error/empty : une panne ne doit
 * jamais être présentée comme l'absence réelle de notifications ou d'alertes.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  VBadge,
  VButton,
  VCard,
  VListRow,
  VSpinner,
  VText,
  velumSpacing,
} from '@velum/ui';

import { Screen } from '../../../components/Screen';
import { getVelumClient } from '../../../lib/client';
import { errorMessage } from '../../../lib/errors';
import { getFeatures } from '../../../lib/features';
import { formatDate, formatEUR } from '../../../lib/i18n';
import { parseMarketNotifications } from '../../../lib/marketNotifications';
import { usePlan } from '../../../lib/plan';

export default function Market() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const features = getFeatures();
  const planState = usePlan();

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      // Table non couverte par les repos typés — réponse validée avant affichage.
      const { data, error } = await client.supabase
        .from('notifications')
        .select('id, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      return parseMarketNotifications(data, error);
    },
  });

  const alertsQuery = useQuery({
    queryKey: ['alerts'],
    queryFn: () => client.alerts.list(),
  });

  const notifications = notificationsQuery.data ?? [];
  const alerts = (alertsQuery.data ?? []).filter((alert) => alert.active);

  return (
    <Screen>
      <VText variant="title">{t('market.title')}</VText>

      <View style={styles.section}>
        <VText variant="heading" tone="gold">
          {t('market.notificationsTitle')}
        </VText>
        {notificationsQuery.isLoading ? (
          <VSpinner />
        ) : notificationsQuery.isError ? (
          <VCard style={styles.errorCard}>
            <VText variant="body" tone="dim">
              {errorMessage(notificationsQuery.error, t)}
            </VText>
            <VButton
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void notificationsQuery.refetch()}
            />
          </VCard>
        ) : notifications.length === 0 ? (
          <VText variant="body" tone="dim">
            {t('market.notificationsEmpty')}
          </VText>
        ) : (
          notifications.map((notification) => (
            <VListRow
              key={notification.id}
              title={notification.title ?? t('common.unknown')}
              subtitle={`${notification.body ?? ''} · ${formatDate(notification.createdAt)}`}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <VText variant="heading" tone="gold">
          {t('market.alertsTitle')}
        </VText>
        {alertsQuery.isLoading ? (
          <VSpinner />
        ) : alertsQuery.isError ? (
          <VCard style={styles.errorCard}>
            <VText variant="body" tone="dim">
              {errorMessage(alertsQuery.error, t)}
            </VText>
            <VButton
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void alertsQuery.refetch()}
            />
          </VCard>
        ) : alerts.length === 0 ? (
          <VText variant="body" tone="dim">
            {t('market.alertsEmpty')}
          </VText>
        ) : (
          alerts.map((alert) => {
            const threshold = alert.config['threshold'];
            return (
              <VListRow
                key={alert.id}
                title={t('item.setAlert')}
                subtitle={
                  typeof threshold === 'number'
                    ? t('market.alertRow', { value: formatEUR(threshold) })
                    : alert.type
                }
                right={<VBadge label={alert.type} tone="gold" />}
              />
            );
          })
        )}
      </View>

      {features.enableMarketplace ? (
        <View style={styles.section}>
          <VText variant="heading" tone="gold">
            {t('market.communityTitle')}
          </VText>
          <VCard tone="gilded">
            <View style={styles.marketplace}>
              <VText variant="body" tone="dim">
                {t('market.communityBody')}
              </VText>
              {planState.status === 'loading' ? (
                <VButton
                  label={t('common.loading')}
                  disabled={true}
                  loading={true}
                  onPress={() => undefined}
                />
              ) : planState.status === 'error' ? (
                <>
                  <VText variant="caption" tone="dim">
                    {errorMessage(planState.error, t)}
                  </VText>
                  <VButton
                    label={t('common.retry')}
                    variant="secondary"
                    onPress={planState.retry}
                  />
                </>
              ) : planState.entitlements.community ? (
                <VButton
                  label={t('community.open')}
                  onPress={() => router.push('/community')}
                  accessibilityHint={t('community.intro')}
                />
              ) : (
                <VButton
                  label={t('market.communityCta')}
                  variant="secondary"
                  onPress={() => router.push('/paywall')}
                />
              )}
            </View>
          </VCard>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: velumSpacing.xl, gap: velumSpacing.sm },
  errorCard: { gap: velumSpacing.sm, alignItems: 'flex-start' },
  marketplace: { gap: velumSpacing.sm, alignItems: 'flex-start' },
});
