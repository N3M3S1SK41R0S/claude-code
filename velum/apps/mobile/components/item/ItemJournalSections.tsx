/**
 * Sections « Journal » de la fiche objet :
 *  - TastingNotesSection : notes de dégustation personnelles (historique) +
 *    marquage « bouteille bue » (attributes.consumedAt, vins) ;
 *  - ProvenanceSection : chaîne de possession (propriétaire, source, date).
 * Chaque section gère sa propre requête/mutation et l'invalidation du cache.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET, VBadge, VButton, VText, VTextInput, velumSpacing } from '@velum/ui';
import type { VelumItem } from '@velum/core';
import { sealFromEntries, verifyPassport } from '@velum/carnet';

import { KV, SheetSection } from '../sheets/SheetSection';
import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/i18n';
import { showToast } from '../../stores/toastStore';

/** Bouton « Supprimer » discret (cible ≥ 44 pt) pour une entrée de journal. */
function DeleteButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={velumSpacing.xs}
      style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
    >
      <VText variant="caption" tone="danger">
        {label}
      </VText>
    </Pressable>
  );
}

// ── Notes de dégustation ──────────────────────────────────────────────────────

export function TastingNotesSection({ item }: { item: VelumItem }) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState('');
  const [text, setText] = useState('');

  const notesQuery = useQuery({
    queryKey: ['tastingNotes', item.id],
    queryFn: () => client.tastingNotes.list(item.id),
  });

  const addMutation = useMutation({
    mutationFn: () => {
      const parsed = Number.parseInt(rating.trim(), 10);
      const ratingValue = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
      return client.tastingNotes.add({
        itemId: item.id,
        rating: ratingValue,
        note: text.trim() || null,
      });
    },
    onSuccess: () => {
      setText('');
      setRating('');
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['tastingNotes', item.id] });
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => client.tastingNotes.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tastingNotes', item.id] }),
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const consumedAt =
    typeof item.attributes['consumedAt'] === 'string'
      ? (item.attributes['consumedAt'] as string)
      : null;

  const markConsumed = useMutation({
    mutationFn: () =>
      client.items.update(item.id, {
        attributes: { ...item.attributes, consumedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      showToast(t('journal.consumedDone'), 'success');
      void queryClient.invalidateQueries({ queryKey: ['item', item.id] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const notes = notesQuery.data ?? [];

  return (
    <SheetSection title={t('journal.tastingTitle')}>
      {item.domain === 'wine' ? (
        consumedAt ? (
          <VBadge tone="neutral" label={t('journal.consumedOn', { date: formatDate(consumedAt) })} />
        ) : (
          <VButton
            label={t('journal.markConsumed')}
            variant="secondary"
            onPress={() => markConsumed.mutate()}
            loading={markConsumed.isPending}
          />
        )
      ) : null}

      {notes.length === 0 ? (
        <VText variant="body" tone="dim">
          {t('journal.tastingEmpty')}
        </VText>
      ) : (
        notes.map((note) => (
          <View key={note.id} style={styles.entry}>
            <View style={styles.entryHeader}>
              <VText variant="caption" tone="dim">
                {formatDate(note.tastedAt)}
                {note.rating !== null ? ` · ${note.rating}/100` : ''}
              </VText>
              <DeleteButton label={t('common.delete')} onPress={() => removeMutation.mutate(note.id)} />
            </View>
            {note.note ? <VText variant="body">{note.note}</VText> : null}
          </View>
        ))
      )}

      {open ? (
        <>
          <VTextInput
            label={t('journal.ratingLabel')}
            value={rating}
            onChangeText={setRating}
            keyboardType="numeric"
            placeholder="90"
          />
          <VTextInput
            label={t('journal.noteLabel')}
            value={text}
            onChangeText={setText}
            placeholder={t('journal.notePlaceholder')}
          />
          <VButton label={t('common.save')} onPress={() => addMutation.mutate()} loading={addMutation.isPending} />
          <VButton label={t('common.cancel')} variant="ghost" onPress={() => setOpen(false)} />
        </>
      ) : (
        <VButton label={t('journal.addNote')} variant="secondary" onPress={() => setOpen(true)} />
      )}
    </SheetSection>
  );
}

// ── Provenance / chaîne de possession ─────────────────────────────────────────

export function ProvenanceSection({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ownerLabel, setOwnerLabel] = useState('');
  const [acquiredFrom, setAcquiredFrom] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [note, setNote] = useState('');

  const query = useQuery({
    queryKey: ['provenance', itemId],
    queryFn: () => client.provenance.list(itemId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      client.provenance.add({
        itemId,
        ownerLabel: ownerLabel.trim() || null,
        acquiredFrom: acquiredFrom.trim() || null,
        eventDate: eventDate.trim() || null,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      setOwnerLabel('');
      setAcquiredFrom('');
      setEventDate('');
      setNote('');
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['provenance', itemId] });
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => client.provenance.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provenance', itemId] }),
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const entries = query.data ?? [];

  // Pari #8 — sceau d'intégrité DÉRIVÉ des entrées de provenance : un hash
  // chaîné (SHA-256) rejouable ; toute altération casserait la vérification.
  const seal =
    entries.length > 0
      ? sealFromEntries(
          itemId,
          [...entries].sort((a, b) =>
            (a.eventDate ?? a.createdAt ?? '').localeCompare(b.eventDate ?? b.createdAt ?? ''),
          ),
        )
      : null;
  const sealVerified = seal ? verifyPassport(seal).valid : false;

  return (
    <SheetSection title={t('journal.provenanceTitle')}>
      {entries.length === 0 ? (
        <VText variant="body" tone="dim">
          {t('journal.provenanceEmpty')}
        </VText>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.entry}>
            <View style={styles.entryHeader}>
              <VText variant="body" tone="gold">
                {entry.ownerLabel ?? entry.acquiredFrom ?? t('common.unknown')}
              </VText>
              <DeleteButton label={t('common.delete')} onPress={() => removeMutation.mutate(entry.id)} />
            </View>
            {entry.acquiredFrom && entry.ownerLabel ? (
              <KV label={t('journal.acquiredFrom')} value={entry.acquiredFrom} />
            ) : null}
            {entry.eventDate ? <KV label={t('journal.eventDate')} value={formatDate(entry.eventDate)} /> : null}
            {entry.note ? <VText variant="caption" tone="dim">{entry.note}</VText> : null}
          </View>
        ))
      )}

      {seal ? (
        <VText variant="caption" tone={sealVerified ? 'gold' : 'danger'}>
          {sealVerified
            ? `🔒 ${t('journal.provenanceSealed', { hash: seal.head.slice(0, 10) })}`
            : t('journal.provenanceSealBroken')}
        </VText>
      ) : null}

      {open ? (
        <>
          <VTextInput label={t('journal.ownerLabel')} value={ownerLabel} onChangeText={setOwnerLabel} />
          <VTextInput label={t('journal.acquiredFrom')} value={acquiredFrom} onChangeText={setAcquiredFrom} placeholder={t('journal.acquiredFromPlaceholder')} />
          <VTextInput label={t('journal.eventDate')} value={eventDate} onChangeText={setEventDate} placeholder="2020-06-15" />
          <VTextInput label={t('journal.noteLabel')} value={note} onChangeText={setNote} />
          <VButton label={t('common.save')} onPress={() => addMutation.mutate()} loading={addMutation.isPending} />
          <VButton label={t('common.cancel')} variant="ghost" onPress={() => setOpen(false)} />
        </>
      ) : (
        <VButton label={t('journal.addProvenance')} variant="secondary" onPress={() => setOpen(true)} />
      )}
    </SheetSection>
  );
}

const styles = StyleSheet.create({
  entry: { gap: velumSpacing.xs / 2, paddingVertical: velumSpacing.xs / 2 },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
  delete: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: velumSpacing.xs,
  },
  pressed: { opacity: 0.6 },
});
