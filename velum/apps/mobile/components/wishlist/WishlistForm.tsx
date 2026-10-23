/**
 * Formulaire d'envie (création et modification) : catégorie, envie / idée,
 * titre (obligatoire, ou composé depuis l'identification), notes, prix cible,
 * priorité, et champs d'identification PRINCIPAUX du domaine (repliables pour
 * limiter le défilement). Toute la validation est dans lib/wishlist.ts.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { VelumDomain, WishlistEntry, WishlistKind, WishlistPriority } from '@velum/core';
import { VButton, VText, VTextInput, velumSpacing } from '@velum/ui';

import { DomainFilterChips } from '../search/DomainFilterChips';
import { identityFieldsFor } from '../../lib/identityFields';
import {
  WISHLIST_KINDS,
  WISHLIST_NOTES_MAX_LENGTH,
  WISHLIST_PRIORITIES,
  buildWishlistInput,
  withDomain,
  type WishlistFormValues,
  type WishlistInput,
} from '../../lib/wishlist';
import { ChoiceChips } from './ChoiceChips';
import { NotesField } from './NotesField';

export interface WishlistFormProps {
  initial: WishlistFormValues;
  /** Envie modifiée : ses attributs hors formulaire sont conservés. */
  base?: Pick<WishlistEntry, 'domain' | 'attributes'>;
  /** Catégories proposées (domaines actifs). */
  domains: readonly VelumDomain[];
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: WishlistInput) => void;
  /** Annuler la modification (absent en création : l'en-tête « Retour » suffit). */
  onCancel?: () => void;
  /** Bloc affiché au-dessus du bouton principal (ex. doublon détecté). */
  notice?: ReactNode;
  /** Notifié à chaque saisie (ex. pour retirer un avertissement de doublon). */
  onEdit?: () => void;
}

function hasIdentityValues(values: WishlistFormValues): boolean {
  return Object.values(values.identity).some((v) => v.trim().length > 0);
}

export function WishlistForm({
  initial,
  base,
  domains,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
  notice,
  onEdit,
}: WishlistFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<WishlistFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [identityOpen, setIdentityOpen] = useState(() => hasIdentityValues(initial));

  const update = (patch: Partial<WishlistFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
    onEdit?.();
  };
  const setIdentity = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, identity: { ...prev.identity, [key]: value } }));
    onEdit?.();
  };

  const submit = () => {
    const result = buildWishlistInput(values, base);
    if (!result.ok) {
      setErrors(result.errors);
      // Une erreur d'identification doit être visible : on déplie la section.
      const identityKeys = identityFieldsFor(values.domain, true).map((f) => f.key);
      if (identityKeys.some((key) => result.errors[key] !== undefined)) setIdentityOpen(true);
      return;
    }
    setErrors({});
    onSubmit(result.input);
  };

  const errorText = (key: string): string | undefined => {
    const messageKey = errors[key];
    return messageKey ? t(messageKey) : undefined;
  };

  const identityFields = identityFieldsFor(values.domain, true);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <VText variant="caption" tone="dim">
          {t('wishlist.form.category')}
        </VText>
        <DomainFilterChips
          value={values.domain}
          onChange={(domain) => {
            if (domain === null) return;
            setValues((prev) => withDomain(prev, domain));
            setErrors({});
            onEdit?.();
          }}
          domains={domains}
          hideAll
        />
      </View>

      <View style={styles.group}>
        <VText variant="caption" tone="dim">
          {t('wishlist.kind.label')}
        </VText>
        <ChoiceChips<WishlistKind>
          label={t('wishlist.kind.label')}
          value={values.kind}
          onChange={(kind) => update({ kind })}
          options={WISHLIST_KINDS.map((kind) => ({
            value: kind,
            label: t(`wishlist.kind.${kind}`),
            hint: t(`wishlist.kind.${kind}Hint`),
          }))}
        />
      </View>

      <VTextInput
        label={t('wishlist.form.title')}
        value={values.title}
        onChangeText={(title) => update({ title })}
        placeholder={
          values.domain === 'wine' ? t('wishlist.form.titlePlaceholderWine') : t('wishlist.form.titlePlaceholder')
        }
        autoCapitalize="sentences"
        error={errorText('title')}
      />

      <NotesField
        label={t('wishlist.form.notes')}
        value={values.notes}
        onChangeText={(notes) => update({ notes })}
        placeholder={t('wishlist.form.notesPlaceholder')}
        maxLength={WISHLIST_NOTES_MAX_LENGTH}
        error={errorText('notes')}
      />

      <VTextInput
        label={t('wishlist.form.targetPrice')}
        value={values.targetPrice}
        onChangeText={(targetPrice) => update({ targetPrice })}
        placeholder={t('wishlist.form.targetPricePlaceholder')}
        keyboardType="decimal-pad"
        error={errorText('targetPrice')}
      />

      <View style={styles.group}>
        <VText variant="caption" tone="dim">
          {t('wishlist.priority.label')}
        </VText>
        <ChoiceChips<WishlistPriority>
          label={t('wishlist.priority.label')}
          value={values.priority}
          onChange={(priority) => update({ priority })}
          options={WISHLIST_PRIORITIES.map((priority) => ({
            value: priority,
            label: t(`wishlist.priority.${priority}`),
          }))}
        />
      </View>

      <VButton
        label={identityOpen ? t('wishlist.form.identityHide') : t('wishlist.form.identityShow')}
        variant="ghost"
        onPress={() => setIdentityOpen((open) => !open)}
        accessibilityHint={t('wishlist.form.identityHint')}
      />
      {identityOpen ? (
        <View style={styles.group}>
          <VText variant="caption" tone="dim">
            {t('wishlist.form.identityHint')}
          </VText>
          {identityFields.map((field) => (
            <VTextInput
              key={`${values.domain}-${field.key}`}
              label={t(field.labelKey)}
              value={values.identity[field.key] ?? ''}
              onChangeText={(text) => setIdentity(field.key, text)}
              keyboardType={field.numeric ? 'numeric' : undefined}
              error={errorText(field.key)}
            />
          ))}
        </View>
      ) : null}

      {notice}

      {hasErrors ? (
        <VText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t('wishlist.form.invalid')}
        </VText>
      ) : null}

      <VButton label={submitLabel} onPress={submit} loading={submitting} disabled={submitting} />
      {onCancel ? (
        <VButton label={t('wishlist.form.cancel')} variant="ghost" onPress={onCancel} disabled={submitting} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: velumSpacing.md },
  group: { gap: velumSpacing.xs },
});
