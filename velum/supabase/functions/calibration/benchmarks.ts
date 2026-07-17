/**
 * Références de backtest par domaine (pari #1, cold-start) — des objets
 * LIQUIDES et non ambigus, choisis pour produire des observations de ventes
 * réelles chez les sources déjà branchées (Heritage, eBay sold, Delcampe,
 * iDealwine, Catawiki, CGB, Drouot…).
 *
 * Critères d'inclusion : marché actif (ventes fréquentes), libellé canonique
 * stable, dispersion raisonnable. La liste est volontairement courte : la
 * calibration a besoin de VENTES RÉELLES comparables, pas d'exhaustivité.
 */
import type { PriceQuery, VelumDomain } from '@velum/core';

export const BENCHMARK_QUERIES: Record<VelumDomain, PriceQuery[]> = {
  wine: [
    {
      domain: 'wine',
      label: 'Château Margaux 2015',
      attributes: { producer: 'Château Margaux', vintage: 2015, appellation: 'Margaux', color: 'rouge' },
      limit: 24,
    },
    {
      domain: 'wine',
      label: 'Sassicaia 2016',
      attributes: { producer: 'Tenuta San Guido', cuvee: 'Sassicaia', vintage: 2016, country: 'Italie' },
      limit: 24,
    },
    {
      domain: 'wine',
      label: 'Dom Pérignon 2012',
      attributes: { producer: 'Moët & Chandon', cuvee: 'Dom Pérignon', vintage: 2012, appellation: 'Champagne' },
      limit: 24,
    },
    {
      domain: 'wine',
      label: 'Clos Rougeard Le Bourg 2014',
      attributes: { producer: 'Clos Rougeard', cuvee: 'Le Bourg', vintage: 2014, appellation: 'Saumur-Champigny' },
      limit: 24,
    },
  ],
  coin: [
    {
      domain: 'coin',
      label: '20 Francs or Napoléon III tête laurée 1866',
      attributes: { country: 'France', type: '20 Francs or Napoléon III', year: 1866, metal: 'or' },
      limit: 24,
    },
    {
      domain: 'coin',
      label: '5 Francs Semeuse argent 1960',
      attributes: { country: 'France', type: '5 Francs Semeuse', year: 1960, metal: 'argent' },
      limit: 24,
    },
    {
      domain: 'coin',
      label: 'Morgan Dollar 1921',
      attributes: { country: 'États-Unis', type: 'Morgan Dollar', year: 1921, metal: 'argent' },
      limit: 24,
    },
    {
      domain: 'coin',
      label: '50 Pesos or Mexique 1947',
      attributes: { country: 'Mexique', type: '50 Pesos Centenario', year: 1947, metal: 'or' },
      limit: 24,
    },
  ],
  art: [
    {
      domain: 'art',
      label: 'Pablo Picasso lithographie signée',
      attributes: { artist: 'Pablo Picasso', technique: 'lithographie', signatureDetected: true },
      limit: 24,
    },
    {
      domain: 'art',
      label: 'Bernard Buffet lithographie signée',
      attributes: { artist: 'Bernard Buffet', technique: 'lithographie', signatureDetected: true },
      limit: 24,
    },
    {
      domain: 'art',
      label: 'Salvador Dalí gravure signée',
      attributes: { artist: 'Salvador Dalí', technique: 'gravure', signatureDetected: true },
      limit: 24,
    },
  ],
  stamp: [
    {
      domain: 'stamp',
      label: 'France 1929 Pont du Gard YT 262',
      attributes: { country: 'France', catalogNumber: 'YT 262', year: 1929 },
      condition: 'neuf avec charnière',
      limit: 24,
    },
    {
      domain: 'stamp',
      label: 'France Cérès 1849 20c noir YT 3',
      attributes: { country: 'France', catalogNumber: 'YT 3', year: 1849 },
      condition: 'oblitéré',
      limit: 24,
    },
    {
      domain: 'stamp',
      label: 'Grande-Bretagne Penny Black 1840',
      attributes: { country: 'Grande-Bretagne', catalogNumber: 'SG 1', year: 1840 },
      condition: 'oblitéré',
      limit: 24,
    },
  ],
  watch: [
    {
      domain: 'watch',
      label: 'Rolex Submariner 124060',
      attributes: { brand: 'Rolex', model: 'Submariner', reference: '124060' },
      limit: 24,
    },
    {
      domain: 'watch',
      label: 'Omega Speedmaster Professional 3570.50',
      attributes: { brand: 'Omega', model: 'Speedmaster Professional', reference: '3570.50' },
      limit: 24,
    },
    {
      domain: 'watch',
      label: 'Cartier Tank Must WSTA0041',
      attributes: { brand: 'Cartier', model: 'Tank Must', reference: 'WSTA0041' },
      limit: 24,
    },
  ],
};
