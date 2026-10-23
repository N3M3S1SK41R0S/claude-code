/**
 * Réglage du rappel « à boire » : UNE notification locale au moment choisi
 * (ce soir 19 h, demain 19 h, vendredi 18 h ou heure libre) mettant en avant
 * le vin le plus urgent, son emplacement et un plat suggéré ; annulation ;
 * rappel hebdomadaire facultatif. Toucher la notification ouvre « Mes vins à
 * leur apogée ». Sur le web : explication claire (pas de notification locale).
 *
 * Utilisable seul (ex. écran Profil : il lit alors la cave lui-même) ou avec
 * le rapport déjà calculé par l'écran hôte.
 */
import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CellarPeakReport } from '@velum/core';
import { VButton, VCard, VSpinner, VText, VTextInput, velumColors, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { cellarPeakForItems } from '../../lib/drinkNow';
import {
  buildReminderContent,
  buildWeeklyContent,
  contentKey,
  formatReminderTime,
  formatReminderWhen,
  nextReminderDate,
  oneShotStatus,
  parseTimeInput,
  pickReminderWine,
  REMINDER_PRESETS,
  toExpoWeekday,
  type ReminderPreset,
} from '../../lib/drinkReminders';
import {
  cancelDrinkReminders,
  cancelReminder,
  ensureReminderPermission,
  remindersSupported,
  scheduleOneShotReminder,
  scheduleWeeklyReminder,
  withReminderLock,
} from '../../lib/drinkRemindersNative';
import { errorMessage } from '../../lib/errors';
import { useSettingsStore } from '../../stores/settingsStore';
import { showToast } from '../../stores/toastStore';
import { ChoiceChips } from './ChoiceChips';

export interface DrinkReminderSettingsProps {
  /**
   * Rapport « à l'apogée » déjà calculé par l'écran hôte. Omis : le composant
   * lit la cave lui-même (même cache que l'écran « Mes vins à leur apogée »).
   */
  report?: CellarPeakReport;
}

export function DrinkReminderSettings({ report: hostReport }: DrinkReminderSettingsProps) {
  const { t, i18n } = useTranslation();
  const client = getVelumClient();
  const supported = remindersSupported();
  const prefs = useSettingsStore((s) => s.drinkReminder);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const setPrefs = useSettingsStore((s) => s.setDrinkReminder);
  const [now, setNow] = useState(() => new Date());
  const [customText, setCustomText] = useState(() =>
    formatReminderTime({ hour: prefs.customHour, minute: prefs.customMinute }),
  );
  const [busy, setBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const itemsQuery = useQuery({
    queryKey: ['items', 'wine'],
    queryFn: () => client.items.list('wine'),
    enabled: supported && hostReport === undefined,
    staleTime: 60 * 1000,
  });
  const updatedAt = itemsQuery.dataUpdatedAt;
  const report = useMemo<CellarPeakReport | null>(() => {
    if (hostReport !== undefined) return hostReport;
    return itemsQuery.data ? cellarPeakForItems(itemsQuery.data, now.getFullYear()) : null;
  }, [hostReport, itemsQuery.data, now, updatedAt]);

  const customTime = parseTimeInput(customText);
  const nextDate = nextReminderDate(prefs.preset, now, customTime ?? undefined);
  const wine = report ? pickReminderWine(report.entries) : null;
  const preview = wine && nextDate ? buildReminderContent(wine, nextDate, t) : null;
  const status = oneShotStatus(prefs, now);

  // Le contenu hebdomadaire est figé à la programmation : on le rafraîchit
  // quand la cave change. Verrou PARTAGÉ (le réglage peut être monté deux
  // fois : Profil et « Mes vins à leur apogée ») et état relu DANS le
  // verrou : jamais deux hebdomadaires programmés, jamais de reprogrammation
  // après que l'interrupteur a été coupé.
  useEffect(() => {
    if (!supported || !hydrated || !prefs.weekly || !report) return;
    const content = buildWeeklyContent(report.entries, t);
    const key = contentKey(content);
    if (key === prefs.weeklyContentKey) return;
    void withReminderLock(async () => {
      const current = useSettingsStore.getState().drinkReminder;
      if (!current.weekly || current.weeklyContentKey === key) return;
      await cancelReminder(current.weeklyId);
      await cancelDrinkReminders('weekly', { keepId: current.oneShotId });
      const id = await scheduleWeeklyReminder(content, {
        weekday: current.weeklyWeekday,
        hour: current.weeklyHour,
        minute: current.weeklyMinute,
      });
      if (!useSettingsStore.getState().drinkReminder.weekly) {
        // Coupé entre-temps (hors verrou) : on n'enregistre pas un rappel orphelin.
        await cancelReminder(id);
        return;
      }
      setPrefs({ weeklyId: id, weeklyContentKey: key });
    }).catch(() => {
      // Best effort : l'ancien rappel reste valable, on retentera plus tard.
    });
  }, [supported, hydrated, prefs, report, setPrefs, t]);

  if (!supported) {
    return (
      <VCard style={styles.card}>
        <VText variant="heading" tone="gold" accessibilityRole="header">
          {t('reminders.settingsTitle')}
        </VText>
        <VText variant="body" tone="dim">
          {t('reminders.unsupported')}
        </VText>
      </VCard>
    );
  }

  const requestPermission = async (): Promise<boolean> => {
    const outcome = await ensureReminderPermission(t('reminders.channelName'));
    setPermissionDenied(outcome === 'denied');
    return outcome === 'granted';
  };

  const scheduleOneShot = async () => {
    if (busy || !wine) return;
    setBusy(true);
    try {
      if (!(await requestPermission())) return;
      // Instant recalculé au moment de l'action (l'écran a pu rester ouvert).
      const fresh = new Date();
      const when = nextReminderDate(prefs.preset, fresh, customTime ?? undefined);
      const content = when ? buildReminderContent(wine, when, t) : null;
      if (!when || !content) return;
      await withReminderLock(async () => {
        await cancelReminder(useSettingsStore.getState().drinkReminder.oneShotId);
        const id = await scheduleOneShotReminder(content, when);
        setPrefs({
          oneShotId: id,
          oneShotAt: when.toISOString(),
          oneShotLabel: wine.label,
          ...(customTime ? { customHour: customTime.hour, customMinute: customTime.minute } : {}),
        });
      });
      showToast(t('reminders.scheduled'), 'success');
    } catch {
      showToast(t('reminders.error'), 'danger');
    } finally {
      setBusy(false);
      setNow(new Date());
    }
  };

  const cancelOneShot = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await withReminderLock(async () => {
        await cancelReminder(useSettingsStore.getState().drinkReminder.oneShotId);
        setPrefs({ oneShotId: null, oneShotAt: null, oneShotLabel: null });
      });
      showToast(t('reminders.cancelled'), 'info');
    } catch {
      showToast(t('reminders.error'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const toggleWeekly = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!enabled) {
        await withReminderLock(async () => {
          // Identifiant relu dans le verrou : une reprogrammation a pu le remplacer.
          const current = useSettingsStore.getState().drinkReminder;
          await cancelReminder(current.weeklyId);
          setPrefs({ weekly: false, weeklyId: null, weeklyContentKey: null });
          await cancelDrinkReminders('weekly', { keepId: current.oneShotId });
        });
        showToast(t('reminders.weeklyOff'), 'info');
        return;
      }
      if (!(await requestPermission())) return;
      const slotDate = nextDate ?? nextReminderDate('friday', new Date());
      if (!slotDate) return;
      const slot = { weekday: toExpoWeekday(slotDate.getDay()), hour: slotDate.getHours(), minute: slotDate.getMinutes() };
      const content = buildWeeklyContent(report?.entries ?? [], t);
      await withReminderLock(async () => {
        const current = useSettingsStore.getState().drinkReminder;
        await cancelReminder(current.weeklyId);
        await cancelDrinkReminders('weekly', { keepId: current.oneShotId });
        const id = await scheduleWeeklyReminder(content, slot);
        setPrefs({
          weekly: true,
          weeklyId: id,
          weeklyWeekday: slot.weekday,
          weeklyHour: slot.hour,
          weeklyMinute: slot.minute,
          weeklyContentKey: contentKey(content),
        });
      });
      showToast(t('reminders.weeklyOn'), 'success');
    } catch {
      showToast(t('reminders.error'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const weeklySlot = prefs.weekly
    ? { weekday: prefs.weeklyWeekday, hour: prefs.weeklyHour, minute: prefs.weeklyMinute }
    : nextDate
      ? { weekday: toExpoWeekday(nextDate.getDay()), hour: nextDate.getHours(), minute: nextDate.getMinutes() }
      : null;

  const loadingCellar = hostReport === undefined && itemsQuery.isLoading;
  const cellarError = hostReport === undefined && itemsQuery.isError && !itemsQuery.data;

  return (
    <VCard style={styles.card}>
      <VText variant="heading" tone="gold" accessibilityRole="header">
        {t('reminders.settingsTitle')}
      </VText>
      <VText variant="caption" tone="dim">
        {t('reminders.settingsIntro')}
      </VText>

      {status === 'scheduled' && prefs.oneShotAt ? (
        <View style={styles.scheduled} accessibilityRole="summary">
          <VText variant="body" tone="gold">
            {t('reminders.scheduledFor', { when: formatReminderWhen(new Date(prefs.oneShotAt), locale) })}
          </VText>
          {prefs.oneShotLabel ? (
            <VText variant="caption" tone="dim">
              {t('reminders.scheduledWine', { label: prefs.oneShotLabel })}
            </VText>
          ) : null}
          <VButton label={t('reminders.cancel')} variant="ghost" onPress={() => void cancelOneShot()} disabled={busy} />
        </View>
      ) : status === 'delivered' && prefs.oneShotAt ? (
        <VText variant="caption" tone="dim">
          {t('reminders.delivered', { when: formatReminderWhen(new Date(prefs.oneShotAt), locale) })}
        </VText>
      ) : null}

      <ChoiceChips<ReminderPreset>
        label={t('reminders.presetGroup')}
        value={prefs.preset}
        onChange={(preset) => {
          setPrefs({ preset });
          setNow(new Date());
        }}
        options={REMINDER_PRESETS.map((preset) => ({ value: preset, label: t(`reminders.preset.${preset}`) }))}
      />

      {prefs.preset === 'custom' ? (
        <VTextInput
          label={t('reminders.customTime')}
          value={customText}
          onChangeText={setCustomText}
          placeholder="19:30"
          keyboardType="numbers-and-punctuation"
          error={customTime === null ? t('reminders.customTimeInvalid') : undefined}
        />
      ) : null}

      {loadingCellar ? (
        <View style={styles.inline}>
          <VSpinner />
          <VText variant="caption" tone="dim">
            {t('reminders.loading')}
          </VText>
        </View>
      ) : cellarError ? (
        <View style={styles.inline}>
          <VText variant="caption" tone="danger" style={styles.flex}>
            {`${t('reminders.loadError')} ${errorMessage(itemsQuery.error, t)}`}
          </VText>
          <VButton label={t('common.retry')} variant="ghost" onPress={() => void itemsQuery.refetch()} />
        </View>
      ) : !wine ? (
        <VText variant="body" tone="dim">
          {t('reminders.noWine')}
        </VText>
      ) : preview && nextDate ? (
        <View style={styles.preview}>
          <VText variant="caption" tone="dim">
            {t('reminders.when', { when: formatReminderWhen(nextDate, locale) })}
          </VText>
          <VText variant="body">{t('reminders.preview', { text: `${preview.title} — ${preview.body}` })}</VText>
        </View>
      ) : null}

      <VButton
        label={t('reminders.schedule')}
        onPress={() => void scheduleOneShot()}
        disabled={!wine || !nextDate || busy}
        loading={busy}
        accessibilityHint={t('reminders.scheduleHint')}
      />

      {permissionDenied ? (
        <View style={styles.inline}>
          <VText variant="caption" tone="danger" style={styles.flex} accessibilityRole="alert">
            {t('reminders.permissionDenied')}
          </VText>
          <VButton label={t('reminders.openSettings')} variant="ghost" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}

      <View style={styles.weeklyRow}>
        <View style={styles.flex}>
          <VText variant="body">{t('reminders.weekly')}</VText>
          {weeklySlot ? (
            <VText variant="caption" tone="dim">
              {t('reminders.weeklyHint', {
                day: t(`reminders.weekday.${weeklySlot.weekday}`),
                time: formatReminderTime({ hour: weeklySlot.hour, minute: weeklySlot.minute }),
              })}
            </VText>
          ) : null}
        </View>
        <Switch
          value={prefs.weekly}
          onValueChange={(value) => void toggleWeekly(value)}
          disabled={busy}
          accessibilityLabel={t('reminders.weekly')}
          trackColor={{ true: velumColors.gold.faint, false: velumColors.ink.border }}
          thumbColor={prefs.weekly ? velumColors.gold.DEFAULT : velumColors.parchment.dim}
        />
      </View>
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.sm, marginTop: velumSpacing.md },
  scheduled: { gap: velumSpacing.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  preview: { gap: 2 },
  weeklyRow: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.md, minHeight: 44 },
  flex: { flex: 1 },
});
