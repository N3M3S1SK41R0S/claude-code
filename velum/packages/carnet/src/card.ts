/**
 * Cartes de collection partageables & musée de poche — Pari #10.
 *
 * La couche sociale/showcase manquante, cohérente avec le principe #1 :
 * une carte partageable ne montre JAMAIS un prix sec, mais une FOURCHETTE
 * assortie d'un badge de confiance, plus un deep-link de provenance — funnel
 * d'acquisition viral et honnête. Le « musée de poche » expose les objets
 * réellement possédés et valorisés.
 *
 * Pur et testable.
 */
import type { VelumDomain } from '@velum/core';

export type ConfidenceBadge = 'high' | 'medium' | 'low';

export interface ShareCardInput {
  itemId: string;
  title: string;
  domain: VelumDomain;
  /** IC 80 % §7 (EUR) — c'est la fourchette affichée, jamais le central seul. */
  ci80: [number, number];
  reliability: number;
  /** Empreinte du passeport de provenance → deep-link. */
  provenanceHead?: string;
  thumbnailPath?: string;
}

export interface ShareCard {
  itemId: string;
  title: string;
  domain: VelumDomain;
  /** Fourchette de valeur affichée (jamais un prix sec — principe #1). */
  valueRange: [number, number];
  badge: ConfidenceBadge;
  reliability: number;
  caption: string;
  /** Deep-link de provenance (si passeport présent). */
  provenanceLink?: string;
  thumbnailPath?: string;
}

/** Seuils de badge de confiance (score de fiabilité §7, 0..100). */
export const BADGE_THRESHOLDS = { high: 70, medium: 45 } as const;

const DOMAIN_LABEL: Record<VelumDomain, string> = {
  wine: 'Vin',
  coin: 'Pièce',
  art: 'Tableau',
  stamp: 'Timbre',
};

export function confidenceBadge(reliability: number): ConfidenceBadge {
  if (reliability >= BADGE_THRESHOLDS.high) return 'high';
  if (reliability >= BADGE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

const BADGE_WORD: Record<ConfidenceBadge, string> = {
  high: 'estimation solide',
  medium: 'estimation indicative',
  low: 'estimation prudente',
};

/** Construit une carte partageable — fourchette + badge, jamais un prix sec. */
export function buildShareCard(input: ShareCardInput): ShareCard {
  const badge = confidenceBadge(input.reliability);
  const [lo, hi] = input.ci80;
  const caption = `${DOMAIN_LABEL[input.domain]} · ${lo.toLocaleString('fr-FR')}–${hi.toLocaleString('fr-FR')} € (${BADGE_WORD[badge]})`;
  return {
    itemId: input.itemId,
    title: input.title,
    domain: input.domain,
    valueRange: [lo, hi],
    badge,
    reliability: input.reliability,
    caption,
    ...(input.provenanceHead ? { provenanceLink: `velum://provenance/${input.provenanceHead}` } : {}),
    ...(input.thumbnailPath ? { thumbnailPath: input.thumbnailPath } : {}),
  };
}

export interface MuseumExhibit {
  itemId: string;
  title: string;
  domain: VelumDomain;
  valueRange: [number, number];
  badge: ConfidenceBadge;
  media: string[];
}

export interface MuseumGalleryInput extends ShareCardInput {
  media?: string[];
}

/**
 * Compose une galerie « musée de poche » des objets possédés et valorisés,
 * triée par valeur centrale décroissante (les pièces maîtresses d'abord).
 */
export function buildMuseumGallery(items: MuseumGalleryInput[]): MuseumExhibit[] {
  return items
    .map((it) => ({
      itemId: it.itemId,
      title: it.title,
      domain: it.domain,
      valueRange: it.ci80,
      badge: confidenceBadge(it.reliability),
      media: it.media ?? (it.thumbnailPath ? [it.thumbnailPath] : []),
      _mid: (it.ci80[0] + it.ci80[1]) / 2,
    }))
    .sort((a, b) => b._mid - a._mid)
    .map(({ _mid, ...exhibit }) => exhibit);
}
