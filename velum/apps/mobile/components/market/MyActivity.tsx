/**
 * « Mon activité » : mes annonces, mes achats & ventes (séquestre), mes
 * échanges, mes certifications et mes commissions (registre transparent).
 * Chaque section a son propre état chargement / erreur (Réessayer) / vide ;
 * ce qui attend MON action passe en tête, l'historique (éléments clos) est replié.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ExchangeProposal } from '@velum/core';
import { VButton, VText, velumSpacing } from '@velum/ui';

import { sellPickerHref } from '../../lib/marketQuery';
import {
  certificationNeedsMe,
  exchangeNeedsMe,
  hasOpenCertificationOn,
  isClosed,
  myListingEngaged,
  orderNeedsMe,
  partitionActivity,
  shipmentListingIds,
} from '../../lib/marketState';
import { routes } from '../../lib/routes';
import { CertificationCard, ExchangeSummaryCard, MyListingCard } from './ActivityCards';
import { CommissionCard } from './CommissionCard';
import { AsyncBlock } from './controls';
import { useMyCertifications, useMyExchanges, useMyListings, useMyOrders } from './hooks';
import { OrderCard } from './OrderCard';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <VText variant="heading" tone="gold" accessibilityRole="header">
        {title}
      </VText>
      {hint ? (
        <VText variant="caption" tone="dim">
          {hint}
        </VText>
      ) : null}
      {children}
    </View>
  );
}

/** Liste « en cours » + historique replié. */
function Partitioned<T>({
  current,
  history,
  render,
  emptyText,
}: {
  current: T[];
  history: T[];
  render: (entry: T) => ReactNode;
  emptyText: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      {current.length === 0 ? (
        <VText variant="body" tone="dim">
          {emptyText}
        </VText>
      ) : (
        current.map(render)
      )}
      {history.length > 0 ? (
        <VButton
          label={open ? t('community.activity.hideHistory') : t('community.activity.showHistory', { count: history.length })}
          variant="ghost"
          onPress={() => setOpen((v) => !v)}
        />
      ) : null}
      {open ? history.map(render) : null}
    </>
  );
}

export function MyActivity() {
  const { t } = useTranslation();
  const router = useRouter();
  const listings = useMyListings();
  const orders = useMyOrders();
  const exchanges = useMyExchanges();
  const certifications = useMyCertifications();
  // Expertises ouvertes : elles bloquent l'expédition (rien « à traiter » alors).
  const certs = certifications.data ?? [];
  const now = new Date().toISOString();
  // Expertise de l'annonce elle-même (R7) : annonce visée, et mes annonces de l'objet que j'offre.
  const exchangeBlocked = (e: ExchangeProposal) =>
    hasOpenCertificationOn(certs, { exchangeId: e.id, listingIds: shipmentListingIds(e, listings.data ?? []) });

  return (
    <View style={styles.container}>
      <Section title={t('community.activity.exchanges')} hint={t('community.activity.exchangesHint')}>
        <AsyncBlock source={exchanges}>
          {(data) => {
            const { current, history } = partitionActivity(data, isClosed.exchange, (e) =>
              exchangeNeedsMe(e, { hasOpenCertification: exchangeBlocked(e), now }),
            );
            return (
              <Partitioned
                current={current}
                history={history}
                emptyText={t('community.activity.exchangesEmpty')}
                render={(e) => (
                  <ExchangeSummaryCard
                    key={e.id}
                    exchange={e}
                    hasOpenCertification={exchangeBlocked(e)}
                    onOpen={() => router.push(routes.exchange(e.id))}
                  />
                )}
              />
            );
          }}
        </AsyncBlock>
      </Section>

      <Section title={t('community.myOrders')} hint={t('community.activity.ordersHint')}>
        <AsyncBlock source={orders}>
          {(data) => {
            const { current, history } = partitionActivity(data, isClosed.order, (o) =>
              orderNeedsMe(o, {
                hasOpenCertification: hasOpenCertificationOn(certs, {
                  orderId: o.id,
                  listingIds: shipmentListingIds({ listingId: o.listingId }),
                }),
              }),
            );
            return (
              <Partitioned
                current={current}
                history={history}
                emptyText={t('community.ordersEmpty')}
                render={(o) => <OrderCard key={o.id} order={o} />}
              />
            );
          }}
        </AsyncBlock>
      </Section>

      <Section title={t('community.activity.listings')}>
        <VButton
          label={t('community.sellOrExchange')}
          variant="secondary"
          onPress={() => router.push(sellPickerHref())}
        />
        <AsyncBlock source={listings}>
          {(data) => {
            const { current, history } = partitionActivity(data, isClosed.listing);
            return (
              <Partitioned
                current={current}
                history={history}
                emptyText={t('community.activity.listingsEmpty')}
                render={(l) => (
                  <MyListingCard
                    key={l.id}
                    listing={l}
                    engaged={myListingEngaged(l.id, orders.data ?? [], exchanges.data ?? [])}
                    onOpen={() => router.push(routes.listing(l.id))}
                  />
                )}
              />
            );
          }}
        </AsyncBlock>
      </Section>

      <Section title={t('community.activity.certifications')} hint={t('community.activity.certificationsHint')}>
        <AsyncBlock source={certifications}>
          {(data) => {
            const { current, history } = partitionActivity(data, isClosed.certification, certificationNeedsMe);
            return (
              <Partitioned
                current={current}
                history={history}
                emptyText={t('community.activity.certificationsEmpty')}
                render={(c) => <CertificationCard key={c.id} certification={c} />}
              />
            );
          }}
        </AsyncBlock>
      </Section>

      <Section title={t('community.commissions.title')} hint={t('community.commissions.hint')}>
        <CommissionCard />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.xl },
  section: { gap: velumSpacing.sm },
});
