/**
 * Acquisition de l'objet (date, prix, état, emplacement, notes) — éditable,
 * avec repli sur la file hors-ligne (fusion par champ au rejeu). La saisie
 * est VALIDÉE avant tout envoi : la date accepte AAAA-MM-JJ et la saisie à la
 * française (JJ/MM/AAAA, convertie en ISO), le prix « 1 200,50 » dans les
 * bornes de la colonne. Une saisie illisible est signalée sous le champ au
 * lieu d'être envoyée : un refus du serveur n'est jamais mis en file.
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
import { parseAcquiredDate, parseAcquiredPrice } from '../../lib/identityFields';
import { itemQueryKey, persistItemPatch, type ItemPatch } from '../../lib/itemSheetFlows';
import { showToast } from '../../stores/toastStore';

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
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [acquiredPrice, setAcquiredPrice] = useState('');
  const [priceError, setPriceError] = useState<string | undefined>(undefined);
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

  const saveMutation = useMutation({
    mutationFn: (patch: ItemPatch) =>
      persistItemPatch(
        {
          client,
          now: () => new Date(),
          mutationId: () => `mut-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        item,
        patch,
      ),
    onSuccess: (saved) => {
      setEditOpen(false);
      queryClient.setQueryData(itemQueryKey(item.id), saved.item);
      if (saved.queued) {
        // Hors-ligne : mutation en file, fusionnée champ par champ au rejeu.
        showToast(t('item.editQueued'), 'info');
      } else {
        showToast(t('item.editSaved'), 'success');
        void queryClient.invalidateQueries({ queryKey: ['items'] });
      }
    },
    // Refus du serveur : expliqué, le formulaire reste ouvert, rien en file.
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const openEdit = () => {
    setAcquiredAt(item.acquiredAt ?? '');
    setDateError(undefined);
    setAcquiredPrice(item.acquiredPrice === null ? '' : String(item.acquiredPrice));
    setPriceError(undefined);
    setCondition(item.condition ?? '');
    setNotes(item.notes ?? '');
    setLocation(item.storageLocation ?? '');
    setEditOpen(true);
  };

  const saveEdit = () => {
    const date = parseAcquiredDate(acquiredAt);
    const price = parseAcquiredPrice(acquiredPrice);
    setDateError(date.ok ? undefined : t('item.acquiredAtInvalid'));
    setPriceError(price.ok ? undefined : t(price.errorKey));
    if (!date.ok || !price.ok) return;
    saveMutation.mutate({
      acquiredAt: date.value,
      acquiredPrice: price.value,
      condition: orNull(condition),
      notes: orNull(notes),
      storageLocation: orNull(location),
    });
  };

  return (
    <SheetSection title={t('item.acquisitionTitle')} collapsible defaultOpen>
      {editOpen ? (
        <>
          <VTextInput
            label={t('item.acquiredAt')}
            value={acquiredAt}
            onChangeText={(text) => {
              setAcquiredAt(text);
              if (dateError) setDateError(undefined);
            }}
            placeholder="2020-06-01"
            error={dateError}
          />
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
