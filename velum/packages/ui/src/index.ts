/**
 * @velum/ui — design system VELUM accessible (WCAG 2.2 AA, mode senior §11.2).
 * Composants React Native en StyleSheet pur, consommés tels quels sur web
 * via react-native-web.
 */

// Mode senior
export { SeniorModeProvider, useSeniorMode } from './senior';
export type { SeniorModeContextValue, SeniorModeProviderProps } from './senior';

// Tokens (source de vérité : ../tailwind.js)
export {
  velumColors,
  velumTailwindTheme,
  velumSpacing,
  velumRadius,
  velumElevation,
  velumHairline,
  velumOnInk,
  velumButtonPalette,
  BADGE_TINT_ALPHA,
} from './tokens';
export type {
  VelumColors,
  VelumTailwindTheme,
  VelumSpacingKey,
  VelumElevationKey,
  VelumOnInkTone,
  VelumButtonVariant,
} from './tokens';

// Accessibilité
export {
  MIN_TOUCH_TARGET,
  SENIOR_TOUCH_TARGET,
  SENIOR_SCALE_FACTOR,
  hexToLuminance,
  contrastRatio,
  touchTargetSize,
  scaleForSenior,
} from './a11y';

// Logique pure du badge de confiance
export { confidenceTone, formatConfidence } from './confidence';
export type { ConfidenceTone } from './confidence';

// Composants
export { VText, MAX_FONT_SIZE_MULTIPLIER } from './components/VText';
export type { VTextProps, VTextVariant, VTextTone } from './components/VText';
export { VButton } from './components/VButton';
export type { VButtonProps } from './components/VButton';
export { VCard } from './components/VCard';
export type { VCardProps } from './components/VCard';
export { VTextInput } from './components/VTextInput';
export type { VTextInputProps } from './components/VTextInput';
export { VListRow } from './components/VListRow';
export type { VListRowProps } from './components/VListRow';
export { ConfidenceBadge } from './components/ConfidenceBadge';
export type { ConfidenceBadgeProps } from './components/ConfidenceBadge';
export { VEmptyState } from './components/VEmptyState';
export type { VEmptyStateProps } from './components/VEmptyState';
export { VSpinner } from './components/VSpinner';
export { VBadge } from './components/VBadge';
export type { VBadgeProps, VBadgeTone } from './components/VBadge';
