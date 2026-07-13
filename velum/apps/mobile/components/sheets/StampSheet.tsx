/**
 * Fiche Timbre — moteur phila_v1 : identification catalogue (Yvert & Tellier,
 * Michel, Stanley Gibbons, Scott), état philatélique avec réserve, rareté,
 * variétés, incertitudes.
 */
import { useTranslation } from 'react-i18next';
import { VBadge, VText } from '@velum/ui';
import type { StampAnalysisPayload } from '@velum/core';
import { Bullets, KV, SheetSection } from './SheetSection';

export function StampSheet({ payload }: { payload: Partial<StampAnalysisPayload> | null }) {
  const { t } = useTranslation();
  if (!payload) return null;
  const { identification, condition, rarity, varieties, neighborIssues, uncertainties } = payload;

  return (
    <>
      {identification ? (
        <SheetSection title={t('item.sections.identification')}>
          {identification.catalogNumber ? <KV label={t('item.sections.catalog')} value={identification.catalogNumber} /> : null}
          {identification.country ? <KV label={t('candidates.fields.stampCountry')} value={identification.country} /> : null}
          {identification.title ? <KV label={t('candidates.fields.label')} value={identification.title} /> : null}
          {identification.year !== undefined ? <KV label={t('candidates.fields.stampYear')} value={String(identification.year)} /> : null}
          {identification.faceValue ? <KV label="Valeur faciale" value={identification.faceValue} /> : null}
          {identification.perforation ? <KV label="Dentelure" value={identification.perforation} /> : null}
          {identification.watermark ? <KV label="Filigrane" value={identification.watermark} /> : null}
          {identification.printingMethod ? <KV label="Impression" value={identification.printingMethod} /> : null}
        </SheetSection>
      ) : null}

      {condition ? (
        <SheetSection title={t('item.sections.condition')}>
          <VText variant="heading">{t(`item.stamp.status.${condition.status}`)}</VText>
          {condition.gum ? <KV label="Gomme" value={condition.gum} /> : null}
          {condition.centering ? <KV label="Centrage" value={condition.centering} /> : null}
          {condition.faults.length > 0 ? <Bullets items={condition.faults} /> : null}
          <VText variant="caption" tone="gold" accessibilityLabel={condition.caveat}>
            {condition.caveat}
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

      {neighborIssues && neighborIssues.length > 0 ? (
        <SheetSection title={t('item.sections.comparisons')}>
          <Bullets items={neighborIssues.map((n) => `${n.catalogNumber} — ${n.note}`)} />
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
