/**
 * Onglet Marché : centre de notifications (table `notifications`), alertes
 * actives, section Marketplace « Bientôt disponible » (flag OFF).
 */
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VBadge, VCard, VListRow, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../../../components/Screen';
import { getVelumClient } from '../../../lib/client';
import { getFeatures } from '../../../lib/features';
import { formatDate, formatEUR } from '../../../lib/i18n';

interface NotificationRow {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
}

export default function Market() {
  const { t } = useTranslation();
  const client = getVelumClient();
  const features = getFeatures();

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<NotificationRow[]> => {
      // Table non couverte par les repos typés — échappatoire supabase assumée.
      const { data, error } = await client.supabase
        .from('notifications')
        .select('id, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return [];
      return (data ?? []) as NotificationRow[];
    },
  });

  const alertsQuery = useQuery({
    queryKey: ['alerts'],
    queryFn: () => client.alerts.list(),
  });

  const notifications = notificationsQuery.data ?? [];
  const alerts = (alertsQuery.data ?? []).filter((a) => a.active);

  return (
    <Screen>
      <VText variant="title">{t('market.title')}</VText>

      <View style={styles.section}>
        <VText variant="heading" tone="gold">
          {t('market.notificationsTitle')}
        </VText>
        {notifications.length === 0 ? (
          <VText variant="body" tone="dim">
            {t('market.notificationsEmpty')}
          </VText>
        ) : (
          notifications.map((n) => (
            <VListRow
              key={n.id}
              title={n.title ?? t('common.unknown')}
              subtitle={`${n.body ?? ''} · ${formatDate(n.created_at)}`}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <VText variant="heading" tone="gold">
          {t('market.alertsTitle')}
        </VText>
        {alerts.length === 0 ? (
          <VText variant="body" tone="dim">
            {t('market.alertsEmpty')}
          </VText>
        ) : (
          alerts.map((alert) => {
            const threshold = alert.config['thresholdEUR'];
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

      {!features.enableMarketplace ? (
        <View style={styles.section}>
          <VText variant="heading" tone="gold">
            {t('market.marketplaceTitle')}
          </VText>
          <VCard>
            <View style={styles.marketplace}>
              <VBadge label={t('common.soon')} tone="warning" />
              <VText variant="body" tone="dim">
                {t('market.marketplaceSoon')}
              </VText>
            </View>
          </VCard>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: velumSpacing.xl, gap: velumSpacing.sm },
  marketplace: { gap: velumSpacing.sm, alignItems: 'flex-start' },
});
