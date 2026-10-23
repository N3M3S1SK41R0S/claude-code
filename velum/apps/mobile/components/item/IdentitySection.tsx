/**
 * Section « Identification » de la fiche objet :
 *  - consultation : champs d'identité renseignés (IDENTITY_FIELDS du domaine),
 *    badge « Corrigé par vous », historique repliable des corrections ;
 *  - correction EN TEXTE des infos mal lues sur la photo : désignation + TOUS
 *    les champs du domaine (clavier numérique pour les champs numériques),
 *    erreurs `identity.errors.*`, chaque changement tracé ;
 *  - après une correction effective : carte « Identification corrigée »
 *    proposant de relancer l'estimation et, si la fiche complète est périmée,
 *    de la régénérer.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, type KeyboardTypeOptions } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  VBadge,
  VButton,
  VCard,
  VText,
  VTextInput,
  touchTargetSize,
  useSeniorMode,
  velumSpacing,
} from '@velum/ui';
import type { ValuationRecord, VelumItem } from '@velum/core';

import { KV, SheetSection } from '../sheets/SheetSection';
import { hasFullAnalysis, isAnalysisOutdated } from '../../lib/analysisState';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/i18n';
import { identityFieldsFor, type IdentityField } from '../../lib/identityFields';
import {
  TITLE_FIELD_LABEL_KEY,
  classificationOf,
  correctionHistory,
  hasCorrections,
  identityFormInitialValues,
  hasFormErrors,
  identityRows,
  isValuationStale,
  shouldSuggestCorrection,
  validateIdentityForm,
  type IdentityFormErrors,
} from '../../lib/itemSheet';
import type { ItemSheetActions } from './useItemSheetActions';

/** Clavier adapté : décimal, ou avec signe pour les années avant J.-C. */
function keyboardFor(field: IdentityField): KeyboardTypeOptions {
  if (!field.numeric) return 'default';
  return field.min !== undefined && field.min < 0 ? 'numbers-and-punctuation' : 'decimal-pad';
}

const NO_ERRORS: IdentityFormErrors = { title: null, fields: {} };

// ── Carte de suivi après correction ─────────────────────────────────────────

function CorrectionFollowUpCard({
  item,
  valuation,
  correctedAt,
  actions,
  onDismiss,
}: {
  item: VelumItem;
  valuation: ValuationRecord | null;
  /** Instant (ms) de l'enregistrement de la correction. */
  correctedAt: number;
  actions: ItemSheetActions;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { valuate, analyze } = actions;
  // Relancée APRÈS la correction (indépendant d'un écart d'horloge serveur).
  const revaluedAt = valuate.isSuccess ? valuate.submittedAt : null;
  const showRevalue =
    valuation === null
      ? revaluedAt === null || revaluedAt < correctedAt
      : isValuationStale(item, valuation, revaluedAt);
  const showRegenerate = hasFullAnalysis(item) && isAnalysisOutdated(item);

  return (
    <VCard tone="gilded">
      <View style={styles.cardBody} accessibilityLiveRegion="polite">
        <VText variant="heading" tone="gold" accessibilityRole="header">
          {t('item.followUp.title')}
        </VText>
        {showRevalue || showRegenerate ? (
          <VText variant="body" tone="dim">
            {t('item.followUp.body')}
          </VText>
        ) : (
          <VText variant="body">{t('item.followUp.allDone')}</VText>
        )}
        {showRevalue ? (
          <>
            {valuate.isError ? (
              <VText variant="caption" tone="danger">
                {errorMessage(valuate.error, t)}
              </VText>
            ) : null}
            <VButton
              label={t('item.followUp.revalue')}
              onPress={() => valuate.mutate()}
              loading={valuate.isPending}
              accessibilityHint={t('item.quick.estimateHint')}
            />
          </>
        ) : null}
        {showRegenerate ? (
          <>
            {analyze.isError ? (
              <VText variant="caption" tone="danger">
                {errorMessage(analyze.error, t)}
              </VText>
            ) : null}
            <VButton
              label={t('item.followUp.regenerate')}
              variant="secondary"
              onPress={() => analyze.mutate()}
              loading={analyze.isPending}
              accessibilityHint={t('item.fullSheet.outdatedBody')}
            />
          </>
        ) : null}
        <VButton label={t('item.followUp.dismiss')} variant="ghost" onPress={onDismiss} />
      </View>
    </VCard>
  );
}

// ── Historique repliable ────────────────────────────────────────────────────

function CorrectionHistory({ item }: { item: VelumItem }) {
  const { t, i18n } = useTranslation();
  const { senior } = useSeniorMode();
  const [open, setOpen] = useState(false);
  const entries = correctionHistory(item.attributes, item.domain, i18n.language);
  if (entries.length === 0) return null;
  const label = open
    ? t('item.identity.historyHide')
    : t('item.identity.historyShow', { count: entries.length });
  return (
    <View style={styles.history}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        hitSlop={velumSpacing.xs}
        style={({ pressed }) => [
          styles.historyToggle,
          { minHeight: touchTargetSize(senior) },
          pressed && styles.pressed,
        ]}
      >
        <VText variant="body" tone="gold">
          {label}
        </VText>
      </Pressable>
      {open
        ? entries.map((entry, index) => (
            <View key={`${entry.at}-${entry.field}-${index}`} style={styles.historyEntry} accessible>
              <VText variant="body">
                {t('item.identity.historyEntry', {
                  field: entry.labelKey ? t(entry.labelKey) : entry.field,
                  from: entry.from ?? t('item.identity.emptyValue'),
                  to: entry.to ?? t('item.identity.emptyValue'),
                })}
              </VText>
              <VText variant="caption" tone="dim">
                {t('item.identity.historyDate', { date: formatDate(entry.at) })}
              </VText>
            </View>
          ))
        : null}
    </View>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

export interface IdentitySectionProps {
  item: VelumItem;
  valuation: ValuationRecord | null;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  actions: ItemSheetActions;
}

export function IdentitySection({ item, valuation, editing, onEditingChange, actions }: IdentitySectionProps) {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<IdentityFormErrors>(NO_ERRORS);
  /** Instant de la dernière correction effective (carte de suivi), null : masquée. */
  const [correctedAt, setCorrectedAt] = useState<number | null>(null);
  const { correct } = actions;

  // Ouverture du formulaire : pré-remplissage depuis la version courante.
  useEffect(() => {
    if (!editing) return;
    const initial = identityFormInitialValues(item);
    setTitle(initial.title);
    setValues(initial.values);
    setErrors(NO_ERRORS);
    correct.reset();
    AccessibilityInfo.announceForAccessibility(t('item.identity.editTitle'));
    // Uniquement à l'ouverture : la saisie en cours ne doit pas être écrasée.
  }, [editing]);

  const fields = identityFieldsFor(item.domain);
  const rows = identityRows(item, i18n.language);
  const corrected = hasCorrections(item.attributes);
  const classification = classificationOf(item.attributes);

  const setValue = (key: string, text: string) => {
    setValues((current) => ({ ...current, [key]: text }));
    if (errors.fields[key]) {
      setErrors((current) => {
        const fieldErrors = { ...current.fields };
        delete fieldErrors[key];
        return { ...current, fields: fieldErrors };
      });
    }
  };

  const changeTitle = (text: string) => {
    setTitle(text);
    if (errors.title !== null) setErrors((current) => ({ ...current, title: null }));
  };

  const submit = () => {
    const found = validateIdentityForm(item.domain, title, values);
    setErrors(found);
    if (hasFormErrors(found)) {
      AccessibilityInfo.announceForAccessibility(t('item.identity.errorsSummary'));
      return;
    }
    correct.mutate(
      { title, values },
      {
        onSuccess: (result) => {
          if (result.changed) setCorrectedAt(Date.now());
          onEditingChange(false);
        },
      },
    );
  };

  return (
    <SheetSection
      title={t('item.identity.title')}
      headerRight={corrected ? <VBadge label={t('item.identity.correctedBadge')} tone="gold" /> : null}
    >
      {editing ? (
        <>
          <VText variant="caption" tone="dim">
            {t('item.identity.editHint')}
          </VText>
          <VTextInput
            label={t(TITLE_FIELD_LABEL_KEY)}
            value={title}
            onChangeText={changeTitle}
            error={errors.title !== null ? t(errors.title) : undefined}
          />
          {fields.map((field) => {
            const error = errors.fields[field.key];
            return (
              <VTextInput
                key={field.key}
                label={t(field.labelKey)}
                value={values[field.key] ?? ''}
                onChangeText={(text) => setValue(field.key, text)}
                keyboardType={keyboardFor(field)}
                error={error ? t(error) : undefined}
              />
            );
          })}
          {hasFormErrors(errors) ? (
            <VText variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {t('item.identity.errorsSummary')}
            </VText>
          ) : null}
          {correct.isError ? (
            <VText variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {errorMessage(correct.error, t)}
            </VText>
          ) : null}
          <VButton label={t('item.identity.save')} onPress={submit} loading={correct.isPending} />
          <VButton label={t('common.cancel')} variant="ghost" onPress={() => onEditingChange(false)} />
        </>
      ) : (
        <>
          {shouldSuggestCorrection(item) ? (
            <VText variant="caption" tone="gold">
              {t('item.identity.lowConfidence')}
            </VText>
          ) : null}
          {rows.length === 0 ? (
            <VText variant="body" tone="dim">
              {t('item.identity.empty')}
            </VText>
          ) : (
            rows.map((row) => (
              <KV
                key={row.key}
                label={t(row.labelKey)}
                value={row.corrected ? `${row.value} · ${t('item.identity.fieldCorrected')}` : row.value}
              />
            ))
          )}
          {classification ? (
            <VText variant="caption" tone="dim">
              {t('item.identity.classification', { path: classification.join(' › ') })}
            </VText>
          ) : null}
          <VButton
            label={t('item.identity.correct')}
            variant="secondary"
            onPress={() => onEditingChange(true)}
            accessibilityHint={t('item.quick.correctHint')}
          />
          <CorrectionHistory item={item} />
        </>
      )}
      {correctedAt !== null && !editing ? (
        <CorrectionFollowUpCard
          item={item}
          valuation={valuation}
          correctedAt={correctedAt}
          actions={actions}
          onDismiss={() => setCorrectedAt(null)}
        />
      ) : null}
    </SheetSection>
  );
}

const styles = StyleSheet.create({
  cardBody: { gap: velumSpacing.sm },
  history: { gap: velumSpacing.xs },
  historyToggle: { justifyContent: 'center' },
  historyEntry: { gap: 2, paddingVertical: velumSpacing.xs / 2 },
  pressed: { opacity: 0.7 },
});
