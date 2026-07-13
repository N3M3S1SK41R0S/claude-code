/**
 * Fiche Pièce — moteur numis_v1 : identification, grade estimé AVEC réserve
 * (caveat toujours affiché), rareté, variétés, incertitudes.
 */
import { useTranslation } from 'react-i18next';
import { VBadge, VText } from '@velum/ui';
import type { CoinAnalysisPayload } from '@velum/core';
import { Bullets, KV, SheetSection } from './SheetSection';

export function CoinSheet({ payload }: { payload: Partial<CoinAnalysisPayload> | null }) {
  const { t } = useTranslation();
  if (!payload) return null;
  const { identification, grade, rarity, varieties, neighborYears, uncertainties } = payload;

  return (
    <>
      {identification ? (
        <SheetSection title={t('item.sections.identification')}>
          {identification.type ? <KV label={t('candidates.fields.coinType')} value={identification.type} /> : null}
          {identification.country ? <KV label={t('candidates.fields.coinCountry')} value={identification.country} /> : null}
          {identification.year !== undefined ? <KV label={t('candidates.fields.coinYear')} value={String(identification.year)} /> : null}
          {identification.mintMark ? <KV label="Atelier" value={identification.mintMark} /> : null}
          {identification.metal ? <KV label="Métal" value={identification.metal} /> : null}
          {identification.weightGrams !== undefined ? <KV label="Poids" value={`${identification.weightGrams} g`} /> : null}
          {identification.diameterMm !== undefined ? <KV label="Diamètre" value={`${identification.diameterMm} mm`} /> : null}
          {identification.mintage !== undefined ? <KV label="Tirage" value={String(identification.mintage)} /> : null}
        </SheetSection>
      ) : null}

      {grade ? (
        <SheetSection title={t('item.sections.grade')}>
          <VText variant="heading">
            {t('item.coin.gradeValue', {
              value: grade.value,
              scale: grade.scale,
              confidence: Math.round(grade.confidence * 100),
            })}
          </VText>
          <VText variant="caption" tone="gold" accessibilityLabel={grade.caveat}>
            {grade.caveat}
          </VText>
        </SheetSection>
      ) : null}

      {rarity ? (
        <SheetSection title={t('item.sections.rarity')}>
          <VBadge label={t(`item.rarityLevels.${rarity.level}`)} tone={rarity.level === 'rare' || rarity.level === 'tres_rare' ? 'gold' : 'neutral'} />
          {rarity.note ? <VText variant="body">{rarity.note}</VText> : null}
        </SheetSection>
      ) : null}

      {varieties && varieties.length > 0 ? (
        <SheetSection title={t('item.sections.varieties')}>
          <Bullets items={varieties} />
        </SheetSection>
      ) : null}

      {neighborYears && neighborYears.length > 0 ? (
        <SheetSection title={t('item.sections.comparisons')}>
          <Bullets items={neighborYears.map((n) => `${n.year} — ${n.note}`)} />
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
