/**
 * Fiche Vin — les 7 modules ZAPPA∴VINI∴SAPIENS : identification, dégustation,
 * notations, marché, comparaisons (avec accords mets-vins), incertitudes.
 */
import { useTranslation } from 'react-i18next';
import { VText } from '@velum/ui';
import type { WineAnalysisPayload } from '@velum/core';
import { Bullets, KV, SheetSection } from './SheetSection';

export function WineSheet({ payload }: { payload: Partial<WineAnalysisPayload> | null }) {
  const { t } = useTranslation();
  if (!payload) return null;
  const { identification, tasting, ratings, market, comparisons, uncertainties } = payload;

  return (
    <>
      {identification ? (
        <SheetSection title={t('item.sections.identification')}>
          {identification.producer ? <KV label={t('candidates.fields.wineProducer')} value={identification.producer} /> : null}
          {identification.appellation ? <KV label={t('candidates.fields.wineAppellation')} value={identification.appellation} /> : null}
          {identification.vintage !== undefined ? <KV label={t('candidates.fields.wineVintage')} value={String(identification.vintage)} /> : null}
          {identification.region ? <KV label={t('candidates.fields.stampCountry')} value={[identification.region, identification.country].filter(Boolean).join(', ')} /> : null}
          {identification.color ? <VText variant="body">{identification.color}</VText> : null}
        </SheetSection>
      ) : null}

      {tasting ? (
        <SheetSection title={t('item.sections.tasting')}>
          <KV label="Robe" value={tasting.robe} />
          {tasting.nose.length > 0 ? <Bullets items={tasting.nose} /> : null}
          <KV label="Bouche" value={[tasting.palate.structure, tasting.palate.tannins, tasting.palate.acidity].filter(Boolean).join(' · ')} />
          <KV
            label={t('item.wine.agingPotential', {
              min: tasting.agingPotentialYears[0],
              max: tasting.agingPotentialYears[1],
            })}
            value={t('item.wine.drinkWindow', {
              from: tasting.drinkWindow.from,
              to: tasting.drinkWindow.to,
            })}
          />
        </SheetSection>
      ) : null}

      {ratings ? (
        <SheetSection title={t('item.sections.ratings')}>
          {ratings.rvf ? <KV label="RVF" value={ratings.rvf} /> : null}
          {ratings.bettaneDesseauve ? <KV label="Bettane+Desseauve" value={ratings.bettaneDesseauve} /> : null}
          {ratings.parker ? <KV label="Parker" value={ratings.parker} /> : null}
          {ratings.suckling ? <KV label="Suckling" value={ratings.suckling} /> : null}
          {ratings.jancisRobinson ? <KV label="Jancis Robinson" value={ratings.jancisRobinson} /> : null}
          {ratings.awards && ratings.awards.length > 0 ? <Bullets items={ratings.awards} /> : null}
          <VText variant="body">{t('item.wine.positioning', { value: ratings.positioning })}</VText>
        </SheetSection>
      ) : null}

      {market ? (
        <SheetSection title={t('item.sections.market')}>
          {market.averagePriceEUR !== undefined ? (
            <KV label={t('item.central')} value={`${market.averagePriceEUR} €`} />
          ) : null}
          <KV label={t('item.sections.market')} value={market.assetClass} />
          {market.marketTension ? <KV label="Tension" value={market.marketTension} /> : null}
        </SheetSection>
      ) : null}

      {comparisons ? (
        <SheetSection title={t('item.sections.comparisons')}>
          {comparisons.regionalEquivalents && comparisons.regionalEquivalents.length > 0 ? (
            <Bullets items={comparisons.regionalEquivalents} />
          ) : null}
          {comparisons.neighborVintages && comparisons.neighborVintages.length > 0 ? (
            <Bullets items={comparisons.neighborVintages.map((v) => `${v.vintage} — ${v.note}`)} />
          ) : null}
        </SheetSection>
      ) : null}

      {comparisons && comparisons.foodPairings.length > 0 ? (
        <SheetSection title={t('item.sections.foodPairings')}>
          <Bullets items={comparisons.foodPairings} />
        </SheetSection>
      ) : null}

      {uncertainties && uncertainties.length > 0 ? (
        <SheetSection title={t('item.sections.uncertainties')}>
          <Bullets items={uncertainties} />
        </SheetSection>
      ) : null}
    </>
  );
}
