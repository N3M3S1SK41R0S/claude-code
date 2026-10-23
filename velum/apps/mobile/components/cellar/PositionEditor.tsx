/**
 * Saisie de la position d'une bouteille SANS quitter l'écran : rangée /
 * colonne / place (format canonique du carnet « Rangée 2 · Colonne 4 ·
 * Place 1 ») ou texte libre. Enregistre `items.storage_location` puis
 * rafraîchit les listes (même mécanique que « Déplacer » du carnet).
 */
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VCard, VText, VTextInput, velumSpacing } from '@velum/ui';

import {
  positionFormError,
  positionFormFrom,
  positionFormToLocation,
  type PositionForm,
} from '../../lib/cellarPeak';
import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { showToast } from '../../stores/toastStore';
import { ChoiceChips } from './ChoiceChips';

export interface PositionEditorTarget {
  itemId: string;
  label: string;
  location: string | null | undefined;
}

export interface PositionEditorProps {
  /** Bouteille à placer ; null = éditeur fermé. */
  target: PositionEditorTarget | null;
  onClose: () => void;
}

export function PositionEditor({ target, onClose }: PositionEditorProps) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PositionForm>(() => positionFormFrom(null));

  // Pré-remplissage à chaque ouverture.
  useEffect(() => {
    if (target) setForm(positionFormFrom(target.location));
  }, [target]);

  const save = useMutation({
    mutationFn: ({ id, storageLocation }: { id: string; storageLocation: string | null }) =>
      client.items.update(id, { storageLocation, updatedAt: new Date().toISOString() }),
    onSuccess: () => {
      showToast(t('cellarPeak.positionEditor.saved'), 'success');
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      onClose();
    },
    // Panne réseau : message clair, la saisie reste ouverte (rien de perdu).
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const invalid = positionFormError(form);
  const update = (patch: Partial<PositionForm>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <VCard style={styles.card}>
          <VText variant="heading" tone="gold" accessibilityRole="header">
            {t('cellarPeak.positionEditor.title')}
          </VText>
          <VText variant="body">{target?.label ?? ''}</VText>

          <ChoiceChips
            label={t('cellarPeak.positionEditor.modeSelector')}
            value={form.mode}
            onChange={(mode) => update({ mode })}
            options={[
              { value: 'slot', label: t('cellarPeak.positionEditor.modeSlot') },
              { value: 'text', label: t('cellarPeak.positionEditor.modeText') },
            ]}
          />

          {form.mode === 'slot' ? (
            <View style={styles.slotRow}>
              <View style={styles.slotField}>
                <VTextInput
                  label={t('cellarPeak.positionEditor.row')}
                  value={form.row}
                  onChangeText={(row) => update({ row })}
                  keyboardType="number-pad"
                  placeholder="2"
                />
              </View>
              <View style={styles.slotField}>
                <VTextInput
                  label={t('cellarPeak.positionEditor.column')}
                  value={form.column}
                  onChangeText={(column) => update({ column })}
                  keyboardType="number-pad"
                  placeholder="4"
                />
              </View>
              <View style={styles.slotField}>
                <VTextInput
                  label={t('cellarPeak.positionEditor.place')}
                  value={form.place}
                  onChangeText={(place) => update({ place })}
                  keyboardType="number-pad"
                  placeholder="1"
                />
              </View>
            </View>
          ) : (
            <VTextInput
              label={t('cellarPeak.positionEditor.text')}
              value={form.text}
              onChangeText={(text) => update({ text })}
              placeholder={t('cellarPeak.positionEditor.textPlaceholder')}
            />
          )}

          {invalid ? (
            <VText variant="caption" tone="danger" accessibilityRole="alert">
              {t('cellarPeak.positionEditor.invalid')}
            </VText>
          ) : (
            <VText variant="caption" tone="dim">
              {t('cellarPeak.positionEditor.clearHint')}
            </VText>
          )}

          <VButton
            label={t('common.save')}
            onPress={() => {
              if (!target || invalid || save.isPending) return;
              save.mutate({ id: target.itemId, storageLocation: positionFormToLocation(form) });
            }}
            disabled={invalid}
            loading={save.isPending}
            accessibilityHint={t('cellarPeak.positionEditor.title')}
          />
          <VButton label={t('common.cancel')} variant="ghost" onPress={onClose} />
        </VCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: velumSpacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: { gap: velumSpacing.sm },
  slotRow: { flexDirection: 'row', gap: velumSpacing.sm },
  slotField: { flex: 1 },
});
