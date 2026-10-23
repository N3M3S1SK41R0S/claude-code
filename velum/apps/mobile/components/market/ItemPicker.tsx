/**
 * Choix d'un objet de MA collection (proposition d'échange, mise en vente) :
 * recherche locale insensible aux accents, objets de la catégorie visée en
 * tête, liste courte dépliable (peu de défilement), groupe radio accessible.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { VelumDomain, VelumItem } from '@velum/core';
import { VButton, VText, useSeniorMode, velumColors, velumRadius, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { sortItemsForExchange } from '../../lib/marketForms';
import { searchItems } from '../../lib/search';
import { SearchField } from '../search/SearchField';
import { AsyncBlock } from './controls';

const VISIBLE = 6;

/**
 * Mes objets (toutes catégories), famille de cache `items` (invalidée par la
 * capture et la fiche). Relu à chaque ouverture : on ne propose jamais à la
 * vente ou à l'échange un objet supprimé depuis la dernière lecture.
 */
export function useMyItems() {
  const client = getVelumClient();
  return useQuery({
    queryKey: ['items', 'list', 'all'],
    queryFn: () => client.items.list(),
    refetchOnMount: 'always',
  });
}

export interface ItemPickerProps {
  selectedId: string | null;
  onSelect: (item: VelumItem) => void;
  /** Catégorie mise en tête (celle de l'annonce visée). */
  preferredDomain: VelumDomain | null;
  /** Restreint à une catégorie. */
  onlyDomain?: VelumDomain | null;
  label: string;
}

export function ItemPicker({ selectedId, onSelect, preferredDomain, onlyDomain, label }: ItemPickerProps) {
  const { t } = useTranslation();
  const items = useMyItems();
  return (
    <AsyncBlock source={items} isEmpty={(list) => list.length === 0} emptyText={t('community.picker.empty')}>
      {(list) => (
        <PickerList
          items={onlyDomain ? list.filter((i) => i.domain === onlyDomain) : list}
          selectedId={selectedId}
          onSelect={onSelect}
          preferredDomain={preferredDomain}
          label={label}
        />
      )}
    </AsyncBlock>
  );
}

function PickerList({
  items,
  selectedId,
  onSelect,
  preferredDomain,
  label,
}: {
  items: VelumItem[];
  selectedId: string | null;
  onSelect: (item: VelumItem) => void;
  preferredDomain: VelumDomain | null;
  label: string;
}) {
  const { t } = useTranslation();
  const { senior, scale } = useSeniorMode();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(() => {
    const sorted = sortItemsForExchange(items, preferredDomain);
    return query.trim().length > 0 ? searchItems(sorted, query) : sorted;
  }, [items, preferredDomain, query]);
  const visible = expanded ? ordered : ordered.slice(0, VISIBLE);

  if (items.length === 0) {
    return (
      <VText variant="body" tone="dim">
        {t('community.picker.emptyCategory')}
      </VText>
    );
  }

  return (
    <View style={styles.container}>
      {items.length > VISIBLE ? (
        <SearchField value={query} onChangeText={setQuery} label={t('community.picker.search')} />
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.list}>
        {visible.map((item) => {
          const selected = item.id === selectedId;
          const title = item.title ?? t('common.unknown');
          const category = t(`domains.${item.domain}.name`);
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item)}
              accessibilityRole="radio"
              accessibilityLabel={`${title}, ${category}`}
              accessibilityState={{ selected, checked: selected }}
              aria-checked={selected}
              style={[styles.row, { minHeight: senior ? 56 : 44 }, selected ? styles.rowSelected : null]}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={scale(22)}
                color={selected ? velumColors.gold.DEFAULT : velumColors.parchment.dim}
              />
              <View style={styles.flex}>
                <VText variant="body" numberOfLines={2}>
                  {title}
                </VText>
                <VText variant="caption" tone="dim">
                  {category}
                </VText>
              </View>
            </Pressable>
          );
        })}
      </View>
      {ordered.length === 0 ? (
        <VText variant="body" tone="dim">
          {t('community.noResultFor', { query: query.trim() })}
        </VText>
      ) : null}
      {ordered.length > VISIBLE ? (
        <VButton
          label={expanded ? t('community.picker.less') : t('community.picker.more', { count: ordered.length - VISIBLE })}
          variant="ghost"
          onPress={() => setExpanded((v) => !v)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.sm },
  list: { gap: velumSpacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.md,
    paddingHorizontal: velumSpacing.md,
    paddingVertical: velumSpacing.xs,
    borderRadius: velumRadius.field,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    backgroundColor: velumColors.ink.soft,
  },
  rowSelected: { borderColor: velumColors.gold.DEFAULT, backgroundColor: velumColors.ink.raised },
  flex: { flex: 1 },
});
