/**
 * Choix d'un objet de MA collection (proposition d'échange, mise en vente) :
 * recherche locale insensible aux accents, objets de la catégorie visée en
 * tête, liste courte dépliable (peu de défilement), groupe radio accessible.
 * Un objet indisponible (annonce déjà ouverte, objet déjà cédé…) reste
 * visible mais DÉSACTIVÉ, avec son motif, après les objets disponibles.
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
  /** Motif d'indisponibilité d'un objet (ligne désactivée), null s'il est disponible. */
  blockReason?: (item: VelumItem) => string | null;
}

export function ItemPicker({ selectedId, onSelect, preferredDomain, onlyDomain, label, blockReason }: ItemPickerProps) {
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
          blockReason={blockReason}
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
  blockReason,
}: {
  items: VelumItem[];
  selectedId: string | null;
  onSelect: (item: VelumItem) => void;
  preferredDomain: VelumDomain | null;
  label: string;
  blockReason?: (item: VelumItem) => string | null;
}) {
  const { t } = useTranslation();
  const { senior, scale } = useSeniorMode();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(() => {
    const sorted = sortItemsForExchange(items, preferredDomain);
    const found = query.trim().length > 0 ? searchItems(sorted, query) : sorted;
    // Disponibles d'abord, indisponibles (désactivés, avec motif) ensuite.
    const reasonOf = (item: VelumItem) => blockReason?.(item) ?? null;
    return [...found.filter((i) => reasonOf(i) === null), ...found.filter((i) => reasonOf(i) !== null)];
  }, [items, preferredDomain, query, blockReason]);
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
          const reason = blockReason?.(item) ?? null;
          const disabled = reason !== null;
          const selected = !disabled && item.id === selectedId;
          const title = item.title ?? t('common.unknown');
          const category = t(`domains.${item.domain}.name`);
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                if (!disabled) onSelect(item);
              }}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={disabled ? `${title}, ${category}, ${reason}` : `${title}, ${category}`}
              accessibilityState={{ selected, checked: selected, disabled }}
              aria-checked={selected}
              aria-disabled={disabled}
              style={[
                styles.row,
                { minHeight: senior ? 56 : 44 },
                selected ? styles.rowSelected : null,
                disabled ? styles.rowDisabled : null,
              ]}
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
                {reason !== null ? (
                  <VText variant="caption" tone="dim">
                    {reason}
                  </VText>
                ) : null}
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
  rowDisabled: { opacity: 0.55 },
  flex: { flex: 1 },
});
