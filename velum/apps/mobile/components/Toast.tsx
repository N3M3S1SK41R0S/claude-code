/**
 * Toasts non bloquants — rendus au-dessus de la navigation (racine).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { VText, velumColors, velumRadius, velumSpacing } from '@velum/ui';
import { useToastStore, type ToastTone } from '../stores/toastStore';

const TONE_COLORS: Record<ToastTone, string> = {
  info: velumColors.info,
  success: velumColors.success,
  danger: velumColors.danger,
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {toasts.map((toast) => (
        <Pressable
          key={toast.id}
          onPress={() => dismiss(toast.id)}
          accessibilityRole="alert"
          accessibilityLabel={toast.message}
          style={[styles.toast, { borderLeftColor: TONE_COLORS[toast.tone] }]}
        >
          <VText variant="body">{toast.message}</VText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: velumSpacing.lg,
    right: velumSpacing.lg,
    bottom: 96,
    gap: velumSpacing.sm,
  },
  toast: {
    backgroundColor: velumColors.ink.raised,
    borderRadius: velumRadius.field,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    padding: velumSpacing.md,
  },
});
