/**
 * Fil de messages ANONYMISÉ d'une transaction (commande ou échange) :
 * pseudonymes uniquement, coordonnées masquées côté serveur (badge
 * « coordonnées masquées »), aperçu du masquage AVANT envoi. Réutilisé par
 * « Mon activité » (commandes) et le détail d'un échange.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MarketThreadKind } from '@velum/core';
import { VBadge, VButton, VText, VTextInput, velumColors, velumRadius, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { formatDate } from '../../lib/i18n';
import { redactionPreview } from '../../lib/marketForms';
import { communityKeys } from '../../lib/marketQuery';
import { showToast } from '../../stores/toastStore';
import { AsyncBlock, Notice } from './controls';
import { useMarketErrorToast } from './hooks';

const MAX_LENGTH = 2000;

export interface MessageThreadProps {
  kind: MarketThreadKind;
  threadId: string;
  /** Fil en lecture seule (transaction close). */
  readOnly?: boolean;
}

export function MessageThread({ kind, threadId, readOnly = false }: MessageThreadProps) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const onError = useMarketErrorToast();
  const [draft, setDraft] = useState('');

  const thread = useQuery({
    queryKey: communityKeys.messages(kind, threadId),
    queryFn: () => client.marketplace.messages(kind, threadId),
  });

  const send = useMutation({
    mutationFn: (body: string) => client.marketplace.sendMessage(kind, threadId, body),
    onSuccess: (message) => {
      setDraft('');
      if (message.redacted) showToast(t('community.thread.sentRedacted'), 'info');
      void queryClient.invalidateQueries({ queryKey: communityKeys.messages(kind, threadId) });
    },
    onError,
  });

  const trimmed = draft.trim();
  const preview = redactionPreview(draft);
  const tooLong = trimmed.length > MAX_LENGTH;

  return (
    <View style={styles.container} accessibilityLabel={t('community.thread.title')}>
      <VText variant="body" tone="gold" accessibilityRole="header">
        {t('community.thread.title')}
      </VText>
      <AsyncBlock source={thread} isEmpty={(m) => m.length === 0} emptyText={t('community.thread.empty')}>
        {(messages) => (
          <View style={styles.list}>
            {messages.map((m) => (
              <View
                key={m.id}
                style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}
                accessible
                accessibilityLabel={`${m.mine ? t('community.you') : m.authorAlias} : ${m.body}${
                  m.redacted ? `, ${t('community.thread.redacted')}` : ''
                }`}
              >
                <VText variant="caption" tone="dim">
                  {m.mine ? t('community.you') : m.authorAlias} · {formatDate(m.createdAt)}
                </VText>
                <VText variant="body">{m.body}</VText>
                {m.redacted ? <VBadge tone="warning" label={t('community.thread.redacted')} /> : null}
              </View>
            ))}
          </View>
        )}
      </AsyncBlock>

      {readOnly ? null : (
        <View style={styles.composer}>
          <VTextInput
            label={t('community.thread.label')}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('community.thread.placeholder')}
            autoCapitalize="sentences"
            error={tooLong ? t('community.thread.tooLong', { max: MAX_LENGTH }) : undefined}
          />
          {preview !== null ? (
            <Notice tone="warning" title={t('community.redactionPreviewTitle')}>
              {preview}
            </Notice>
          ) : (
            <VText variant="caption" tone="dim">
              {t('community.thread.anonymityHint')}
            </VText>
          )}
          <VButton
            label={t('community.thread.send')}
            onPress={() => send.mutate(trimmed)}
            disabled={trimmed.length === 0 || tooLong}
            loading={send.isPending}
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.sm },
  list: { gap: velumSpacing.sm },
  bubble: {
    maxWidth: '88%',
    gap: velumSpacing.xs,
    padding: velumSpacing.md,
    borderRadius: velumRadius.field,
    borderWidth: 1,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: velumColors.bordeaux.deep,
    borderColor: velumColors.bordeaux.DEFAULT,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: velumColors.ink.soft,
    borderColor: velumColors.ink.border,
  },
  composer: { gap: velumSpacing.sm },
});
