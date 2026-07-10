/**
 * Garde-fou d'erreurs de rendu : affiche un écran de repli avec relance
 * plutôt qu'un crash — jamais d'écran blanc.
 */
import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { VButton, VText, velumColors, velumSpacing } from '@velum/ui';

interface Props extends WithTranslation {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundaryInner extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  private readonly reset = () => {
    this.setState({ hasError: false });
  };

  override render() {
    const { t, children } = this.props;
    if (!this.state.hasError) return children;
    return (
      <View style={styles.container}>
        <VText variant="heading" center>
          {t('errors.generic')}
        </VText>
        <View style={styles.spacer} />
        <VButton label={t('common.retry')} onPress={this.reset} />
      </View>
    );
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: velumSpacing.xl,
    backgroundColor: velumColors.ink.DEFAULT,
  },
  spacer: { height: velumSpacing.lg },
});
