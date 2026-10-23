/**
 * Alerte de prix : « me prévenir quand la valeur passe AU-DESSUS / EN DESSOUS
 * de X € ». Config lue par price-cron : { direction: 'above'|'below', threshold }.
 * Affiche aussi les alertes de seuil déjà actives de l'objet (suppression
 * possible) — chargement / erreur (Réessayer) / vide distingués.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  VButton,
  VCard,
  VSpinner,
  VText,
  VTextInput,
  touchTargetSize,
  useSeniorMode,
  velumColors,
  velumHairline,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import {
  ALERT_DIRECTIONS,
  formatThreshold,
  parseAlertThreshold,
  priceAlertConfig,
  priceAlertOf,
  type AlertDirection,
  type PriceAlertConfig,
} from '../../lib/itemSheet';
import { showToast } from '../../stores/toastStore';

/** Choix exclusif accessible (rôle radio, état coché annoncé). */
function DirectionChoice({
  value,
  onChange,
}: {
  value: AlertDirection;
  onChange: (direction: AlertDirection) => void;
}) {
  const { t } = useTranslation();
  const { senior } = useSeniorMode();
  return (
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t('item.alert.directionLabel')}>
      {ALERT_DIRECTIONS.map((direction) => {
        const checked = direction === value;
        return (
          <Pressable
            key={direction}
            onPress={() => onChange(direction)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            aria-checked={checked}
            accessibilityLabel={t(`item.alert.${direction}`)}
            style={({ pressed }) => [
              styles.choice,
              { minHeight: touchTargetSize(senior) },
              checked && styles.choiceChecked,
              pressed && styles.pressed,
            ]}
          >
            <VText variant="body" style={checked ? styles.choiceTextChecked : null}>
              {t(`item.alert.${direction}`)}
            </VText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PriceAlertForm({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<AlertDirection>('above');
  const [threshold, setThreshold] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const { senior } = useSeniorMode();

  const alertsQuery = useQuery({
    queryKey: ['alerts', itemId],
    queryFn: () => client.alerts.list(itemId),
  });

  const save = useMutation({
    mutationFn: (config: PriceAlertConfig) =>
      client.alerts.upsert({ itemId, type: 'price_threshold', config: { ...config }, active: true }),
    onSuccess: (_record, config) => {
      const value = formatThreshold(config.threshold, i18n.language);
      showToast(
        config.direction === 'above' ? t('item.alertSet', { value }) : t('item.alert.setBelow', { value }),
        'success',
      );
      setThreshold('');
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      onDone();
    },
    onError: (err) => showToast(errorMessage(err, t), 'danger'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => client.alerts.remove(id),
    onSuccess: () => {
      showToast(t('item.alert.removed'), 'success');
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (err) => showToast(errorMessage(err, t), 'danger'),
  });

  const submit = () => {
    const value = parseAlertThreshold(threshold);
    if (value === null) {
      setError(t('item.alert.invalidThreshold'));
      return;
    }
    setError(undefined);
    save.mutate(priceAlertConfig(direction, value));
  };

  const active = (alertsQuery.data ?? [])
    .map((alert) => ({ id: alert.id, config: priceAlertOf(alert) }))
    .filter((entry): entry is { id: string; config: PriceAlertConfig } => entry.config !== null);

  return (
    <VCard tone="gilded">
      <View style={styles.body}>
        <VText variant="heading" tone="gold" accessibilityRole="header">
          {t('item.alert.title')}
        </VText>

        {alertsQuery.isLoading ? <VSpinner /> : null}
        {alertsQuery.isError ? (
          <View style={styles.row}>
            <VText variant="caption" tone="danger" style={styles.flex}>
              {t('item.alert.listError')}
            </VText>
            <VButton label={t('common.retry')} variant="ghost" onPress={() => void alertsQuery.refetch()} />
          </View>
        ) : null}
        {active.map((entry) => {
          const label = t(entry.config.direction === 'above' ? 'item.alert.activeAbove' : 'item.alert.activeBelow', {
            value: formatThreshold(entry.config.threshold, i18n.language),
          });
          return (
            <View key={entry.id} style={styles.row}>
              <VText variant="body" style={styles.flex}>
                {label}
              </VText>
              <Pressable
                onPress={() => remove.mutate(entry.id)}
                disabled={remove.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('item.alert.remove')}
                accessibilityHint={label}
                hitSlop={velumSpacing.xs}
                style={({ pressed }) => [
                  styles.remove,
                  { minHeight: touchTargetSize(senior) },
                  pressed && styles.pressed,
                ]}
              >
                <VText variant="caption" tone="danger">
                  {t('item.alert.remove')}
                </VText>
              </Pressable>
            </View>
          );
        })}

        <VText variant="caption" tone="dim">
          {t('item.alert.directionLabel')}
        </VText>
        <DirectionChoice value={direction} onChange={setDirection} />
        <VTextInput
          label={t('item.alertPrompt')}
          value={threshold}
          onChangeText={(text) => {
            setThreshold(text);
            if (error) setError(undefined);
          }}
          keyboardType="decimal-pad"
          placeholder="1 200"
          error={error}
        />
        <VButton label={t('item.alert.save')} onPress={submit} loading={save.isPending} />
        <VButton label={t('common.cancel')} variant="ghost" onPress={onDone} />
      </View>
    </VCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: velumSpacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  flex: { flex: 1 },
  choices: { flexDirection: 'row', gap: velumSpacing.sm },
  choice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: velumRadius.field,
    borderWidth: 1,
    borderColor: velumHairline.gilded,
    paddingHorizontal: velumSpacing.sm,
  },
  choiceChecked: { backgroundColor: velumColors.gold.DEFAULT, borderColor: velumColors.gold.DEFAULT },
  choiceTextChecked: { color: velumColors.ink.DEFAULT, fontWeight: '600' },
  remove: { justifyContent: 'center', paddingHorizontal: velumSpacing.xs },
  pressed: { opacity: 0.7 },
});
