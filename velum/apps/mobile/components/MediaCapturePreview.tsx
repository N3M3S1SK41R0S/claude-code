/**
 * Aperçu des clichés par rôle (multi-clichés) : miniature, rôle, état
 * pris / à prendre, action de reprise.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { VText, velumColors, velumRadius, velumSpacing } from '@velum/ui';
import type { MediaRole } from '@velum/core';
import type { DraftMedia } from '../stores/captureStore';

export interface MediaCapturePreviewProps {
  roles: MediaRole[];
  media: DraftMedia[];
  /** Rôle actuellement visé par la caméra. */
  activeRole: MediaRole;
  roleLabel: (role: MediaRole) => string;
  onSelectRole: (role: MediaRole) => void;
}

export function MediaCapturePreview({
  roles,
  media,
  activeRole,
  roleLabel,
  onSelectRole,
}: MediaCapturePreviewProps) {
  return (
    <View style={styles.row}>
      {roles.map((role) => {
        const shot = media.find((m) => m.role === role);
        const active = role === activeRole;
        return (
          <Pressable
            key={role}
            onPress={() => onSelectRole(role)}
            accessibilityRole="button"
            accessibilityLabel={roleLabel(role)}
            accessibilityState={{ selected: active }}
            style={[styles.slot, active && styles.activeSlot]}
          >
            {shot ? (
              <Image source={{ uri: shot.uri }} style={styles.thumb} contentFit="cover" />
            ) : (
              <Ionicons name="camera-outline" size={20} color={velumColors.parchment.faint} />
            )}
            <VText variant="caption" tone={active ? 'gold' : 'dim'} center>
              {roleLabel(role)}
            </VText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: velumSpacing.sm,
    paddingVertical: velumSpacing.sm,
    justifyContent: 'center',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 72,
    padding: velumSpacing.xs,
    borderRadius: velumRadius.field,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    backgroundColor: velumColors.ink.raised,
  },
  activeSlot: { borderColor: velumColors.gold.DEFAULT },
  thumb: { width: 48, height: 48, borderRadius: 8 },
});
