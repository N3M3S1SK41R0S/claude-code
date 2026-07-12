/**
 * Fiche Vin — les 7 modules ZAPPA∴VINI∴SAPIENS : identification, dégustation,
 * notations, marché, comparaisons (avec accords mets-vins), incertitudes.
 */
import { useTranslation } from 'react-i18next';
import { VText } from '@velum/ui';
import type { WineAnalysisPayload, WineDecantingAdvice } from '@velum/core';
import { Bullets, KV, SheetSection } from './SheetSection';

/** Fourchette de température « 12–14 °C » (unité identique fr/en). */
function formatTempRange(range: [number, number]): string {
  return `${range[0]}–${range[1]} °C`;
}

export function WineSheet({ payload }: { payload: Partial<WineAnalysisPayload> | null }) {
  const { t } = useTranslation();
  if (!payload) return null;
  const { identification, tasting, ratings, market, comparisons, uncertainties } = payload;

  const decantingLabel = (decanting: WineDecantingAdvice): string => {
    const base = decanting.recommended
      ? decanting.durationMinutes !== undefined
        ? t('item.wine.decantingWithDuration', { minutes: decanting.durationMinutes })
        : t('item.wine.decantingRecommended')
      : t('item.wine.decantingNotNeeded');
    return decanting.note ? `${base} — ${decanting.note}` : base;
  };

  const hasServiceBlock =
    tasting !== undefined &&
    (tasting.cellarTemperatureC !== undefined ||
      tasting.serviceTemperatureC !== undefined ||
      tasting.decanting !== undefined);

  return (
    <>
      {identification ? (
        <SheetSection title={t('item.sections.identification')}>
          {identification.producer ? <KV label={t('candidates.fields.wineProducer')} value={identification.producer} /> : null}
          {identification.winemaker ? <KV label={t('item.wine.winemaker')} value={identification.winemaker} /> : null}
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
          {tasting.noseFirst && tasting.noseFirst.length > 0 ? (
            <KV label={t('item.wine.noseFirst')} value={tasting.noseFirst.join(', ')} />
          ) : null}
          {tasting.noseSecond && tasting.noseSecond.length > 0 ? (
            <KV label={t('item.wine.noseSecond')} value={tasting.noseSecond.join(', ')} />
          ) : null}
          <KV label="Bouche" value={[tasting.palate.structure, tasting.palate.tannins, tasting.palate.acidity].filter(Boolean).join(' · ')} />
          {tasting.palateAttack ? (
            <KV label={t('item.wine.palateAttack')} value={tasting.palateAttack} />
          ) : null}
          {tasting.palateEvolution ? (
            <KV label={t('item.wine.palateEvolution')} value={tasting.palateEvolution} />
          ) : null}
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

      {/* Bloc « Service » : T° de conservation vs dégustation, carafage. */}
      {tasting && hasServiceBlock ? (
        <SheetSection title={t('item.sections.service')}>
          {tasting.cellarTemperatureC ? (
            <KV label={t('item.wine.cellarTemp')} value={formatTempRange(tasting.cellarTemperatureC)} />
          ) : null}
          {tasting.serviceTemperatureC ? (
            <KV label={t('item.wine.serviceTemp')} value={formatTempRange(tasting.serviceTemperatureC)} />
          ) : null}
          {tasting.decanting ? (
            <KV label={t('item.wine.decanting')} value={decantingLabel(tasting.decanting)} />
          ) : null}
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
