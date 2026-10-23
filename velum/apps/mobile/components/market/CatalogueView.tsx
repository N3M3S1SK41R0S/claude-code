/**
 * Catalogue « Échanges & ventes » : une plateforme par catégorie (puces),
 * mode Vente / Échange / Tout, recherche texte (anti-rebond, transmise au
 * serveur), filtres repliables (prix, certifiés, tri), compteur de résultats
 * et cartes d'annonce anonymisées. Chargement / erreur / vide distincts.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CatalogueSort, VelumDomain } from '@velum/core';
import { VButton, VCard, VText, VTextInput, velumColors, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import {
  DEFAULT_CATALOGUE_FILTERS,
  activeFilterCount,
  buildCatalogueQuery,
  communityKeys,
  priceRangeIssue,
  sellPickerHref,
  type CatalogueFilters,
  type CatalogueMode,
} from '../../lib/marketQuery';
import { routes } from '../../lib/routes';
import { DomainFilterChips } from '../search/DomainFilterChips';
import { SearchField } from '../search/SearchField';
import { ListingCard } from './ListingCard';
import { AsyncBlock, CheckRow, Segmented } from './controls';

const SEARCH_DEBOUNCE_MS = 350;

export interface CatalogueViewProps {
  initialDomain: VelumDomain | null;
  initialMode: CatalogueMode;
  initialText: string;
  /** Remonte domaine / mode / texte (synchronisation de l'URL). */
  onParamsChange?: (params: { domain: VelumDomain | null; mode: CatalogueMode; text: string }) => void;
}

export function CatalogueView({ initialDomain, initialMode, initialText, onParamsChange }: CatalogueViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();

  const [filters, setFilters] = useState<CatalogueFilters>({
    ...DEFAULT_CATALOGUE_FILTERS,
    domain: initialDomain,
    mode: initialMode,
    text: initialText,
  });
  const [debouncedText, setDebouncedText] = useState(initialText);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(filters.text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.text]);

  useEffect(() => {
    onParamsChange?.({ domain: filters.domain, mode: filters.mode, text: debouncedText });
    // onParamsChange volontairement exclu des dépendances : seule la valeur
    // des filtres déclenche la synchronisation (pas l'identité du rappel).
  }, [filters.domain, filters.mode, debouncedText]);

  const query = useMemo(
    () => buildCatalogueQuery({ ...filters, text: debouncedText }),
    [filters, debouncedText],
  );
  const catalogue = useQuery({
    queryKey: communityKeys.catalogue(query),
    queryFn: () => client.marketplace.catalogue(query),
    placeholderData: (previous) => previous,
  });

  const set = <K extends keyof CatalogueFilters>(key: K, value: CatalogueFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const issue = priceRangeIssue(filters);
  const advancedCount = activeFilterCount(filters);
  const platformTitle =
    filters.domain !== null
      ? t('community.platformOf', { category: t(`domains.${filters.domain}.name`) })
      : t('community.allPlatforms');

  return (
    <View style={styles.container}>
      <DomainFilterChips value={filters.domain} onChange={(d) => set('domain', d)} />
      <VText variant="heading" tone="gold" accessibilityRole="header">
        {platformTitle}
      </VText>
      <Segmented<CatalogueMode>
        value={filters.mode}
        onChange={(m) => set('mode', m)}
        accessibilityLabel={t('community.modeLabel')}
        options={[
          { value: 'all', label: t('community.mode.all') },
          { value: 'sale', label: t('community.mode.sale') },
          { value: 'exchange', label: t('community.mode.exchange') },
        ]}
      />
      <SearchField
        value={filters.text}
        onChangeText={(text) => set('text', text)}
        label={t('community.searchLabel')}
        placeholder={t('community.searchPlaceholder')}
        onSubmit={() => setDebouncedText(filters.text)}
      />

      <View style={styles.toolbar}>
        <View style={styles.flex}>
          <VButton
            label={
              advancedCount > 0
                ? t('community.filters.toggleCount', { count: advancedCount })
                : t('community.filters.toggle')
            }
            variant="ghost"
            onPress={() => setFiltersOpen((v) => !v)}
            accessibilityHint={filtersOpen ? t('community.filters.hideHint') : t('community.filters.showHint')}
          />
        </View>
        <View style={styles.flex}>
          <VButton
            label={t('community.sellOrExchange')}
            variant="secondary"
            onPress={() => router.push(sellPickerHref(filters.domain))}
          />
        </View>
      </View>

      {filtersOpen ? (
        <VCard style={styles.filters}>
          <View style={styles.prices}>
            <View style={styles.flex}>
              <VTextInput
                label={t('community.filters.minPrice')}
                value={filters.minPrice}
                onChangeText={(v) => set('minPrice', v)}
                keyboardType="decimal-pad"
                placeholder="0"
                error={issue === 'invalid_min' ? t('community.invalidAmount') : undefined}
              />
            </View>
            <View style={styles.flex}>
              <VTextInput
                label={t('community.filters.maxPrice')}
                value={filters.maxPrice}
                onChangeText={(v) => set('maxPrice', v)}
                keyboardType="decimal-pad"
                placeholder="1 000"
                error={issue === 'invalid_max' ? t('community.invalidAmount') : undefined}
              />
            </View>
          </View>
          {issue === 'min_above_max' ? (
            <VText variant="caption" tone="dim">
              {t('community.filters.swapped')}
            </VText>
          ) : null}
          <CheckRow
            label={t('community.filters.certifiedOnly')}
            hint={t('community.filters.certifiedHint')}
            checked={filters.certifiedOnly}
            onChange={(v) => set('certifiedOnly', v)}
          />
          <VText variant="caption" tone="dim">
            {t('community.filters.sort')}
          </VText>
          <Segmented<CatalogueSort>
            value={filters.sort}
            onChange={(s) => set('sort', s)}
            accessibilityLabel={t('community.filters.sort')}
            options={[
              { value: 'recent', label: t('community.filters.sortRecent') },
              { value: 'price_asc', label: t('community.filters.sortPriceAsc') },
              { value: 'price_desc', label: t('community.filters.sortPriceDesc') },
            ]}
          />
          {advancedCount > 0 ? (
            <VButton
              label={t('community.filters.reset')}
              variant="ghost"
              onPress={() =>
                setFilters((f) => ({
                  ...f,
                  minPrice: '',
                  maxPrice: '',
                  certifiedOnly: false,
                  sort: 'recent',
                }))
              }
            />
          ) : null}
        </VCard>
      ) : null}

      <AsyncBlock source={catalogue}>
        {(listings) => (
          <View style={styles.results}>
            {/* Anciens résultats gardés pendant la mise à jour : jamais présentés comme à jour. */}
            {catalogue.isPlaceholderData ? (
              <View style={styles.updating} accessibilityLiveRegion="polite">
                <ActivityIndicator color={velumColors.gold.DEFAULT} />
                <VText variant="caption" tone="dim">
                  {t('community.updating')}
                </VText>
              </View>
            ) : (
              <VText variant="caption" tone="dim" accessibilityLiveRegion="polite">
                {t('community.resultsCount', { count: listings.length })}
              </VText>
            )}
            {listings.length === 0 ? (
              catalogue.isPlaceholderData ? null : (
                <VText variant="body" tone="dim">
                  {debouncedText.trim().length > 0
                    ? t('community.noResultFor', { query: debouncedText.trim() })
                    : t('community.catalogueEmpty')}
                </VText>
              )
            ) : (
              <View style={[styles.results, catalogue.isPlaceholderData ? styles.stale : null]}>
                {listings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    showDomain={filters.domain === null}
                    onPress={() => router.push(routes.listing(l.id))}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </AsyncBlock>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.md },
  toolbar: { flexDirection: 'row', gap: velumSpacing.sm },
  flex: { flex: 1 },
  filters: { gap: velumSpacing.sm },
  prices: { flexDirection: 'row', gap: velumSpacing.sm },
  results: { gap: velumSpacing.sm },
  stale: { opacity: 0.55 },
  updating: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
});
