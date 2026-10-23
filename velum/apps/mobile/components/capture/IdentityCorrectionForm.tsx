/**
 * Correction EN TEXTE des informations lues sur la photo (et saisie assistée
 * quand rien n'a été reconnu) : champs d'identification du domaine
 * pré-remplis, libellé modifiable, validation des nombres. Les champs
 * principaux d'abord ; « Plus de champs » dévoile le reste.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VButton, VText, VTextInput, velumSpacing, type VelumButtonVariant } from '@velum/ui';
import type { Candidate, VelumDomain } from '@velum/core';

import {
  identityFieldsFor,
  identityValuesFrom,
  labelFromValues,
  validateIdentityValues,
} from '../../lib/identityFields';

/** Valeurs saisies, prêtes pour `correctCandidate`. */
export interface CorrectionDraft {
  values: Record<string, string>;
  label: string;
}

export interface CorrectionAction {
  label: string;
  variant?: VelumButtonVariant;
  accessibilityHint?: string;
  onSubmit: (draft: CorrectionDraft) => void;
}

export interface IdentityCorrectionFormProps {
  domain: VelumDomain;
  /** Lecture de la photo à corriger (null : saisie assistée vierge). */
  base: Candidate | null;
  title: string;
  hint?: string;
  /** Champs principaux seulement (ligne compacte du mode classeur). */
  primaryOnly?: boolean;
  actions: CorrectionAction[];
  onCancel?: () => void;
  busy?: boolean;
}

export function IdentityCorrectionForm({
  domain,
  base,
  title,
  hint,
  primaryOnly = false,
  actions,
  onCancel,
  busy = false,
}: IdentityCorrectionFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() =>
    identityValuesFrom(base?.attributes ?? {}, domain),
  );
  const [label, setLabel] = useState(base?.label ?? '');
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const allFields = useMemo(() => identityFieldsFor(domain), [domain]);
  const primaryFields = useMemo(() => identityFieldsFor(domain, true), [domain]);
  const fields = primaryOnly || !expanded ? primaryFields : allFields;
  const errors = validateIdentityValues(values, domain);
  const effectiveLabel = label.trim() || labelFromValues(domain, values);
  const labelMissing = submitted && effectiveLabel === '';

  const submit = (action: CorrectionAction) => {
    setSubmitted(true);
    if (busy || Object.keys(errors).length > 0 || effectiveLabel === '') return;
    action.onSubmit({ values, label: effectiveLabel });
  };

  return (
    <View style={styles.form}>
      <VText variant="heading" tone="gold" accessibilityRole="header">
        {title}
      </VText>
      {hint ? (
        <VText variant="caption" tone="dim">
          {hint}
        </VText>
      ) : null}
      <VTextInput
        label={t('candidates.fields.label')}
        value={label}
        onChangeText={setLabel}
        placeholder={labelFromValues(domain, values) || undefined}
        error={labelMissing ? t('candidates.labelRequired') : undefined}
      />
      {fields.map((field) => {
        const errorKey = errors[field.key];
        return (
          <VTextInput
            key={field.key}
            label={t(field.labelKey)}
            value={values[field.key] ?? ''}
            onChangeText={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
            keyboardType={field.numeric ? 'numeric' : undefined}
            error={errorKey ? t(errorKey) : undefined}
          />
        );
      })}
      {!primaryOnly && allFields.length > primaryFields.length ? (
        <VButton
          label={expanded ? t('candidates.fewerFields') : t('candidates.moreFields')}
          variant="ghost"
          onPress={() => setExpanded((v) => !v)}
        />
      ) : null}
      <View style={styles.actions}>
        {actions.map((action) => (
          <VButton
            key={action.label}
            label={action.label}
            variant={action.variant ?? 'primary'}
            accessibilityHint={action.accessibilityHint}
            onPress={() => submit(action)}
            loading={busy && action === actions[0]}
            disabled={busy}
          />
        ))}
        {onCancel ? (
          <VButton label={t('common.cancel')} variant="ghost" onPress={onCancel} disabled={busy} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: velumSpacing.md },
  actions: { gap: velumSpacing.sm },
});
