/**
 * Routage domaine → plugin et construction des sources de prix par domaine.
 * Les fonctions importent LES MÊMES plugins que l'app (@velum/domain-*),
 * seule l'injection (vision, transport, clés API) diffère côté serveur.
 */
import type { DomainPlugin, PriceSource, VelumDomain } from '@velum/core';
import {
  CavissimaSource,
  IdealwineSource,
  VivinoSource,
  WineSearcherSource,
  winePlugin,
  type Transport,
} from '@velum/domain-wine';
import {
  CatawikiSource as CoinCatawikiSource,
  CgbSource,
  EbaySoldSource as CoinEbaySoldSource,
  HeritageSource,
  NgcSource,
  NumistaSource,
  PcgsSource,
  coinPlugin,
} from '@velum/domain-coin';
import {
  ArtpriceSource,
  ArtsySource,
  DrouotSource,
  HeritageArtSource,
  MagnusSource,
  artPlugin,
} from '@velum/domain-art';
import {
  CatawikiSource as StampCatawikiSource,
  ColnectSource,
  DelcampeSource,
  EbaySoldSource as StampEbaySoldSource,
  YvertCoteSource,
  stampPlugin,
} from '@velum/domain-stamp';
import {
  CatawikiSource as WatchCatawikiSource,
  Chrono24Source,
  EbaySoldSource as WatchEbaySoldSource,
  HeritageSource as WatchHeritageSource,
  WatchChartsSource,
  watchPlugin,
} from '@velum/domain-watch';

/**
 * Plugin de domaine dont le payload d'analyse est traité de façon opaque
 * (chaque plugin expose son propre payload typé ; côté Edge Function on le
 * sérialise tel quel vers analyses.payload JSONB).
 */
export type AnyDomainPlugin = DomainPlugin<unknown>;

/** Les 5 modules VELUM — philatélie et montres sont des modules à part entière. */
export const plugins: Record<VelumDomain, AnyDomainPlugin> = {
  wine: winePlugin,
  coin: coinPlugin,
  art: artPlugin,
  stamp: stampPlugin,
  watch: watchPlugin,
};

export function isVelumDomain(value: unknown): value is VelumDomain {
  return (
    value === 'wine' ||
    value === 'coin' ||
    value === 'art' ||
    value === 'stamp' ||
    value === 'watch'
  );
}

/** Lit une clé API optionnelle depuis l'environnement. */
function key(name: string): string | undefined {
  const value = Deno.env.get(name);
  return value && value.length > 0 ? value : undefined;
}

/**
 * Construit les sources de prix du domaine dont la clé existe.
 * Règle : une source dont l'API exige une clé n'est incluse que si la clé
 * est configurée ; une source publique est toujours incluse (avec sa clé
 * optionnelle si elle est configurée, pour des quotas plus élevés).
 */
export function buildSources(domain: VelumDomain, transport: Transport): PriceSource[] {
  switch (domain) {
    case 'wine': {
      const sources: PriceSource[] = [
        // Cotes marchandes consultables publiquement : toujours incluses.
        new IdealwineSource({ transport, apiKey: key('IDEALWINE_API_KEY') }),
        new VivinoSource({ transport, apiKey: key('VIVINO_API_KEY') }),
        new CavissimaSource({ transport, apiKey: key('CAVISSIMA_API_KEY') }),
      ];
      // Wine-Searcher pro : cote officielle, clé requise.
      const wineSearcher = key('WINE_SEARCHER_API_KEY');
      if (wineSearcher) sources.push(new WineSearcherSource({ transport, apiKey: wineSearcher }));
      return sources;
    }
    case 'coin': {
      const sources: PriceSource[] = [
        // Boutique CGB : prix publics, clé optionnelle.
        new CgbSource({ transport, apiKey: key('CGB_API_KEY') }),
      ];
      const numista = key('NUMISTA_API_KEY');
      if (numista) sources.push(new NumistaSource({ transport, apiKey: numista }));
      const pcgs = key('PCGS_API_KEY');
      if (pcgs) sources.push(new PcgsSource({ transport, apiKey: pcgs }));
      const ngc = key('NGC_API_KEY');
      if (ngc) sources.push(new NgcSource({ transport, apiKey: ngc }));
      const ebay = key('EBAY_API_KEY');
      if (ebay) sources.push(new CoinEbaySoldSource({ transport, apiKey: ebay }));
      const catawiki = key('CATAWIKI_API_KEY');
      if (catawiki) sources.push(new CoinCatawikiSource({ transport, apiKey: catawiki }));
      const heritage = key('HERITAGE_API_KEY');
      if (heritage) sources.push(new HeritageSource({ transport, apiKey: heritage }));
      return sources;
    }
    case 'art': {
      const sources: PriceSource[] = [
        // Résultats de ventes Drouot publiés publiquement : toujours inclus.
        new DrouotSource({ transport, apiKey: key('DROUOT_API_KEY') }),
      ];
      const artprice = key('ARTPRICE_API_KEY');
      if (artprice) sources.push(new ArtpriceSource({ transport, apiKey: artprice }));
      const artsy = key('ARTSY_API_KEY');
      if (artsy) sources.push(new ArtsySource({ transport, apiKey: artsy }));
      const heritage = key('HERITAGE_API_KEY');
      if (heritage) sources.push(new HeritageArtSource({ transport, apiKey: heritage }));
      const magnus = key('MAGNUS_API_KEY');
      if (magnus) sources.push(new MagnusSource({ transport, apiKey: magnus }));
      return sources;
    }
    case 'stamp': {
      const sources: PriceSource[] = [];
      const colnect = key('COLNECT_API_KEY');
      if (colnect) sources.push(new ColnectSource({ transport, apiKey: colnect }));
      const yvert = key('YVERT_API_KEY');
      if (yvert) sources.push(new YvertCoteSource({ transport, apiKey: yvert }));
      const delcampe = key('DELCAMPE_API_KEY');
      if (delcampe) sources.push(new DelcampeSource({ transport, apiKey: delcampe }));
      const ebay = key('EBAY_API_KEY');
      if (ebay) sources.push(new StampEbaySoldSource({ transport, apiKey: ebay }));
      const catawiki = key('CATAWIKI_API_KEY');
      if (catawiki) sources.push(new StampCatawikiSource({ transport, apiKey: catawiki }));
      return sources;
    }
    case 'watch': {
      const sources: PriceSource[] = [];
      const watchCharts = key('WATCHCHARTS_API_KEY');
      if (watchCharts) sources.push(new WatchChartsSource({ transport, apiKey: watchCharts }));
      const heritage = key('HERITAGE_API_KEY');
      if (heritage) sources.push(new WatchHeritageSource({ transport, apiKey: heritage }));
      const ebay = key('EBAY_API_KEY');
      if (ebay) sources.push(new WatchEbaySoldSource({ transport, apiKey: ebay }));
      const catawiki = key('CATAWIKI_API_KEY');
      if (catawiki) sources.push(new WatchCatawikiSource({ transport, apiKey: catawiki }));
      const chrono24 = key('CHRONO24_API_KEY');
      if (chrono24) sources.push(new Chrono24Source({ transport, apiKey: chrono24 }));
      return sources;
    }
  }
}
