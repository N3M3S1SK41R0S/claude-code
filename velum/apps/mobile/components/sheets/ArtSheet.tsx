/**
 * Fiche Tableau — moteur art_v1 : attribution TOUJOURS qualifiée (jamais
 * d'authentification ferme), état, provenance, comparables, recommandation
 * d'expertise humaine mise en avant.
 */
import { useTranslation } from 'react-i18next';
import { VBadge, VText } from '@velum/ui';
import type { ArtAnalysisPayload } from '@velum/core';
import { Bullets, KV, SheetSection } from './SheetSection';

export function ArtSheet({ payload }: { payload: Partial<ArtAnalysisPayload> | null }) {
  const { t } = useTranslation();
  if (!payload) return null;
  const { identification, condition, provenance, comparables, uncertainties } = payload;

  return (
    <>
      {identification ? (
        <SheetSection title={t('item.sections.attribution')}>
          {identification.attributionQualifier ? (
            <VBadge label={t(`item.art.qualifiers.${identification.attributionQualifier}`)} tone="gold" />
          ) : null}
          {identification.artist ? <KV label={t('candidates.fields.artArtist')} value={identification.artist} /> : null}
          {identification.title ? <KV label={t('candidates.fields.artTitle')} value={identification.title} /> : null}
          {identification.technique ? <KV label={t('candidates.fields.artTechnique')} value={identification.technique} /> : null}
          {identification.dimensionsCm ? (
            <KV label="Dimensions" value={`${identification.dimensionsCm.height} × ${identification.dimensionsCm.width} cm`} />
          ) : null}
          {identification.estimatedPeriod ? <KV label="Période" value={identification.estimatedPeriod} /> : null}
          {identification.school ? <KV label="École" value={identification.school} /> : null}
        </SheetSection>
      ) : null}

      {payload.expertiseRecommended ? (
        <SheetSection title={t('item.sections.uncertainties')}>
          <VText variant="body" tone="danger">
            {t('item.art.expertiseRecommended')}
          </VText>
        </SheetSection>
      ) : null}

      {condition ? (
        <SheetSection title={t('item.sections.condition')}>
          <VText variant="body">{condition.summary}</VText>
          {condition.issues.length > 0 ? <Bullets items={condition.issues} /> : null}
        </SheetSection>
      ) : null}

      {provenance ? (
        <SheetSection title={t('item.sections.provenance')}>
          {provenance.evidence.length > 0 ? <Bullets items={provenance.evidence} /> : null}
          {provenance.note ? <VText variant="caption" tone="dim">{provenance.note}</VText> : null}
        </SheetSection>
      ) : null}

      {comparables && comparables.length > 0 ? (
        <SheetSection title={t('item.sections.comparables')}>
          <Bullets items={comparables.map((c) => (c.note ? `${c.description} — ${c.note}` : c.description))} />
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
