/**
 * État vide VELUM — inventaire vide, aucun résultat, aucune observation de
 * prix… Titre, message optionnel et action de relance.
 */
import { StyleSheet, View } from 'react-native';

import { velumSpacing } from '../tokens';
import { VButton } from './VButton';
import { VText } from './VText';

export interface VEmptyStateProps {
  title: string;
  message?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function VEmptyState({ title, message, action }: VEmptyStateProps) {
  return (
    <View style={styles.container}>
      <VText variant="heading" center={true}>
        {title}
      </VText>
      {message ? (
        <VText variant="body" tone="dim" center={true}>
          {message}
        </VText>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <VButton label={action.label} onPress={action.onPress} variant="primary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: velumSpacing.md,
    padding: velumSpacing.xxl,
  },
  action: {
    marginTop: velumSpacing.sm,
    alignSelf: 'stretch',
  },
});
