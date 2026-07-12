/**
 * Sections de fiche partagées aux 4 modules :
 *  - HeritageSection : histoire, rareté et nombre d'exemplaires (tirage /
 *    production / édition), renseignés par le moteur d'analyse.
 *  - RecentSalesSection : dernières ventes comparables, tirées des observations
 *    RÉELLES retenues par la valorisation (§7) — chaque ligne est attribuée à sa
 *    source (iDealwine, Numista, Delcampe, Heritage, eBay vendu…) et datée.
 */
import { useTranslation } from 'react-i18next';
import { VText, velumSpacing } from '@velum/ui';
import { StyleSheet } from 'react-native';
import { VListRow } from '@velum/ui';
import type { HeritageProfile, PriceObservation } from '@velum/core';

import { SheetSection, KV } from '../sheets/SheetSection';
import { formatMoney } from '../../lib/i18n';
import { editionLabel, hasHeritage, rarityLabel, relativeAge } from '../../lib/heritage';

export function HeritageSection({ heritage }: { heritage?: HeritageProfile | null }) {
  const { t } = useTranslation();
  if (!hasHeritage(heritage)) return null;
  const h = heritage as HeritageProfile;
  return (
    <SheetSection title={t('heritage.title')}>
      {h.history ? (
        <VText variant="body" tone="dim">
          {h.history}
        </VText>
      ) : null}
      {h.rarity ? <KV label={t('heritage.rarity')} value={rarityLabel(h.rarity, t)} /> : null}
      {h.editionSize ? (
        <KV label={t('heritage.edition')} tabular value={editionLabel(h.editionSize, t)} />
      ) : null}
    </SheetSection>
  );
}

export function RecentSalesSection({ observations }: { observations: PriceObservation[] }) {
  const { t } = useTranslation();
  if (!observations || observations.length === 0) return null;
  // Plus récentes d'abord (ageDays croissant).
  const sales = [...observations].sort((a, b) => a.ageDays - b.ageDays);
  return (
    <SheetSection title={t('item.recentSalesTitle')}>
      <VText variant="caption" tone="dim" style={styles.intro}>
        {t('item.recentSalesIntro')}
      </VText>
      {sales.map((obs, i) => (
        <VListRow
          key={`${obs.source.name}-${i}`}
          title={obs.matchedLabel ?? obs.source.name}
          subtitle={`${obs.source.name} · ${t(`sourceKinds.${obs.source.kind}`)} · ${relativeAge(obs.ageDays, t)}`}
          right={
            <VText variant="body" tabularNums>
              {formatMoney(obs.price, obs.currency)}
            </VText>
          }
        />
      ))}
    </SheetSection>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: velumSpacing.xs },
});
