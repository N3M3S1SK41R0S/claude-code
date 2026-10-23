/**
 * Acquisition de l'objet (date, prix, état, emplacement, notes) — éditable,
 * avec repli sur la file hors-ligne (last-write-wins au rejeu). Le prix
 * accepte la saisie à la française (« 1 200,50 ») ; un prix illisible est
 * signalé au lieu d'être silencieusement effacé.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VTextInput } from '@velum/ui';
import type { VelumItem } from '@velum/core';

import { KV, SheetSection } from '../sheets/SheetSection';
import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { formatEUR } from '../../lib/i18n';
import { parseNumericInput } from '../../lib/identityFields';
import { showToast } from '../../stores/toastStore';
import { itemQueryKey } from './useItemSheetActions';

type AcquisitionPatch = Pick<
  VelumItem,
  'acquiredAt' | 'acquiredPrice' | 'condition' | 'notes' | 'storageLocation'
>;

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function AcquisitionSection({ item }: { item: VelumItem }) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [acquiredAt, setAcquiredAt] = useState('');
  const [acquiredPrice, setAcquiredPrice] = useState('');
  const [priceError, setPriceError] = useState<string | undefined>(undefined);
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

  const saveMutation = useMutation({
    mutationFn: async (patch: AcquisitionPatch) => {
      const updatedAt = new Date().toISOString();
      try {
        return await client.items.update(item.id, { ...patch, updatedAt });
      } catch {
        // Hors-ligne : mutation en file (last-write-wins au rejeu).
        await client.queue.enqueue({
          id: `mut-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          table: 'items',
          type: 'update',
          payload: { id: item.id, ...patch, updatedAt },
          queuedAt: updatedAt,
        });
        queryClient.setQueryData(itemQueryKey(item.id), { ...item, ...patch, updatedAt });
        showToast(t('item.editQueued'), 'info');
        return null;
      }
    },
    onSuccess: (updated) => {
      setEditOpen(false);
      if (updated !== null) {
        showToast(t('item.editSaved'), 'success');
        void queryClient.invalidateQueries({ queryKey: ['items'] });
      }
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const openEdit = () => {
    setAcquiredAt(item.acquiredAt ?? '');
    setAcquiredPrice(item.acquiredPrice === null ? '' : String(item.acquiredPrice));
    setPriceError(undefined);
    setCondition(item.condition ?? '');
    setNotes(item.notes ?? '');
    setLocation(item.storageLocation ?? '');
    setEditOpen(true);
  };

  const saveEdit = () => {
    const rawPrice = acquiredPrice.trim();
    const price = rawPrice.length === 0 ? null : parseNumericInput(rawPrice);
    if (rawPrice.length > 0 && (price === null || price < 0)) {
      setPriceError(t('identity.errors.notANumber'));
      return;
    }
    setPriceError(undefined);
    saveMutation.mutate({
      acquiredAt: orNull(acquiredAt),
      acquiredPrice: price,
      condition: orNull(condition),
      notes: orNull(notes),
      storageLocation: orNull(location),
    });
  };

  return (
    <SheetSection title={t('item.acquisitionTitle')} collapsible defaultOpen>
      {editOpen ? (
        <>
          <VTextInput label={t('item.acquiredAt')} value={acquiredAt} onChangeText={setAcquiredAt} placeholder="2020-06-01" />
          <VTextInput
            label={t('item.acquiredPrice')}
            value={acquiredPrice}
            onChangeText={(text) => {
              setAcquiredPrice(text);
              if (priceError) setPriceError(undefined);
            }}
            keyboardType="decimal-pad"
            error={priceError}
          />
          <VTextInput label={t('item.condition')} value={condition} onChangeText={setCondition} />
          <VTextInput label={t('item.storageLocation')} value={location} onChangeText={setLocation} />
          <VTextInput label={t('item.notes')} value={notes} onChangeText={setNotes} />
          <VButton label={t('common.save')} onPress={saveEdit} loading={saveMutation.isPending} />
          <VButton label={t('common.cancel')} variant="ghost" onPress={() => setEditOpen(false)} />
        </>
      ) : (
        <>
          <KV label={t('item.acquiredAt')} value={item.acquiredAt ?? '—'} />
          <KV
            label={t('item.acquiredPrice')}
            tabular
            value={item.acquiredPrice === null ? '—' : formatEUR(item.acquiredPrice)}
          />
          <KV label={t('item.condition')} value={item.condition ?? '—'} />
          <KV label={t('item.storageLocation')} value={item.storageLocation ?? '—'} />
          <KV label={t('item.notes')} value={item.notes ?? '—'} />
          <VButton
            label={t('common.edit')}
            variant="secondary"
            onPress={openEdit}
            accessibilityHint={t('item.acquisitionEditHint')}
          />
        </>
      )}
    </SheetSection>
  );
}
