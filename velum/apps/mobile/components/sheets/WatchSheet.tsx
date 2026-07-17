/**
 * Fiche Montre — moteur watch_v1 : spécifications complètes, mécanisme
 * (mouvement, calibre, complications), histoire du modèle (pourquoi il a été
 * créé, par qui, jalons), état de l'exemplaire avec réserve horlogère,
 * références voisines, incertitudes. Les DERNIÈRES TRANSACTIONS sont rendues
 * par RecentSalesSection (observations réelles de la valorisation §7).
 */
import { useTranslation } from 'react-i18next';
import { VText } from '@velum/ui';
import type { WatchAnalysisPayload } from '@velum/core';
import { Bullets, KV, SheetSection } from './SheetSection';

export function WatchSheet({ payload }: { payload: Partial<WatchAnalysisPayload> | null }) {
  const { t } = useTranslation();
  if (!payload) return null;
  const { identification, movement, story, condition, neighborReferences, uncertainties } = payload;
  const complications = Array.isArray(movement?.complications) ? movement.complications : [];
  const milestones = Array.isArray(story?.milestones) ? story.milestones : [];
  const nonOriginalParts = Array.isArray(condition?.nonOriginalParts)
    ? condition.nonOriginalParts
    : [];
  const issues = Array.isArray(condition?.issues) ? condition.issues : [];
  const neighbors = Array.isArray(neighborReferences) ? neighborReferences : [];
  const uncertaintyList = Array.isArray(uncertainties) ? uncertainties : [];

  return (
    <>
      {identification ? (
        <SheetSection title={t('item.sections.identification')}>
          {identification.brand ? <KV label={t('candidates.fields.watchBrand')} value={identification.brand} /> : null}
          {identification.model ? <KV label={t('candidates.fields.watchModel')} value={identification.model} /> : null}
          {identification.reference ? <KV label={t('candidates.fields.watchReference')} value={identification.reference} /> : null}
          {identification.year !== undefined ? <KV label={t('candidates.fields.watchYear')} value={String(identification.year)} /> : null}
          {identification.gender ? <KV label={t('item.watch.gender')} value={t(`item.watch.genderValues.${identification.gender}`)} /> : null}
          {identification.caseMaterial ? <KV label={t('item.watch.caseMaterial')} value={identification.caseMaterial} /> : null}
          {identification.caseDiameterMm !== undefined ? (
            <KV label={t('item.watch.caseDiameter')} value={`${identification.caseDiameterMm} mm`} tabular />
          ) : null}
          {identification.dialColor ? <KV label={t('item.watch.dialColor')} value={identification.dialColor} /> : null}
          {identification.bracelet ? <KV label={t('item.watch.bracelet')} value={identification.bracelet} /> : null}
          {identification.crystal ? <KV label={t('item.watch.crystal')} value={identification.crystal} /> : null}
          {identification.waterResistanceM !== undefined ? (
            <KV label={t('item.watch.waterResistance')} value={`${identification.waterResistanceM} m`} tabular />
          ) : null}
          {identification.boxPapers ? (
            <KV label={t('item.watch.boxPapersLabel')} value={t(`item.watch.boxPapers.${identification.boxPapers}`)} />
          ) : null}
          {identification.limitedEdition ? (
            <KV label={t('item.watch.limitedEdition')} value={identification.limitedEdition} />
          ) : null}
        </SheetSection>
      ) : null}

      {movement ? (
        <SheetSection title={t('item.watch.movementTitle')}>
          <VText variant="heading">{t(`item.watch.movementType.${movement.type}`)}</VText>
          {movement.calibre ? <KV label={t('item.watch.calibre')} value={movement.calibre} /> : null}
          {movement.powerReserveHours !== undefined ? (
            <KV label={t('item.watch.powerReserve')} value={`${movement.powerReserveHours} h`} tabular />
          ) : null}
          {movement.frequencyVph !== undefined ? (
            <KV label={t('item.watch.frequency')} value={t('item.watch.frequencyValue', { vph: movement.frequencyVph })} tabular />
          ) : null}
          {movement.jewels !== undefined ? <KV label={t('item.watch.jewels')} value={String(movement.jewels)} tabular /> : null}
          {complications.length > 0 ? (
            <>
              <VText variant="caption" tone="dim">
                {t('item.watch.complications')}
              </VText>
              <Bullets items={complications} />
            </>
          ) : null}
          {movement.certification ? <KV label={t('item.watch.certification')} value={movement.certification} /> : null}
          {movement.note ? (
            <VText variant="body" tone="dim">
              {movement.note}
            </VText>
          ) : null}
        </SheetSection>
      ) : null}

      {/* Histoire du MODÈLE : pourquoi il a été créé, par qui, jalons. */}
      {story && (story.why || story.byWhom || story.modelLaunchYear !== undefined || milestones.length > 0) ? (
        <SheetSection title={t('item.watch.storyTitle')}>
          {story.why ? (
            <>
              <VText variant="caption" tone="gold">
                {t('item.watch.storyWhy')}
              </VText>
              <VText variant="body">{story.why}</VText>
            </>
          ) : null}
          {story.byWhom ? <KV label={t('item.watch.storyByWhom')} value={story.byWhom} /> : null}
          {story.modelLaunchYear !== undefined ? (
            <KV label={t('item.watch.modelLaunchYear')} value={String(story.modelLaunchYear)} tabular />
          ) : null}
          {milestones.length > 0 ? (
            <>
              <VText variant="caption" tone="dim">
                {t('item.watch.milestones')}
              </VText>
              <Bullets items={milestones.map((milestone) => `${milestone.year} — ${milestone.note}`)} />
            </>
          ) : null}
        </SheetSection>
      ) : null}

      {condition ? (
        <SheetSection title={t('item.sections.condition')}>
          <VText variant="body">{condition.summary}</VText>
          {condition.serviceHistory ? <KV label={t('item.watch.serviceHistory')} value={condition.serviceHistory} /> : null}
          {condition.polished && condition.polished !== 'inconnu' ? (
            <KV label={t('item.watch.polishedLabel')} value={t(`item.watch.polished.${condition.polished}`)} />
          ) : null}
          {nonOriginalParts.length > 0 ? (
            <>
              <VText variant="caption" tone="danger">
                {t('item.watch.nonOriginalParts')}
              </VText>
              <Bullets items={nonOriginalParts} />
            </>
          ) : null}
          {issues.length > 0 ? <Bullets items={issues} /> : null}
          <VText variant="caption" tone="gold" accessibilityLabel={condition.caveat}>
            {condition.caveat}
          </VText>
        </SheetSection>
      ) : null}

      {neighbors.length > 0 ? (
        <SheetSection title={t('item.sections.comparisons')}>
          <Bullets items={neighbors.map((neighbor) => `${neighbor.reference} — ${neighbor.note}`)} />
        </SheetSection>
      ) : null}

      {uncertaintyList.length > 0 ? (
        <SheetSection title={t('item.sections.uncertainties')}>
          <Bullets items={uncertaintyList} />
        </SheetSection>
      ) : null}
    </>
  );
}
