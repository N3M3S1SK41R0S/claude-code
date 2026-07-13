import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuration Expo VELUM (§15.3).
 * Feature flags exposés via `extra.features` — lus par @velum/config côté app.
 * AUCUN secret ici : seuls EXPO_PUBLIC_* (publics) sont référencés (§12.1).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'VELUM',
  slug: 'velum',
  scheme: 'velum',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/brand/icon-provisional.png',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/brand/splash-still.png',
    resizeMode: 'cover',
    backgroundColor: '#1a0d10',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.velum.app',
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        'VELUM utilise la caméra pour photographier vos vins, pièces, tableaux et timbres afin de les identifier et les estimer.',
      NSPhotoLibraryUsageDescription:
        'VELUM accède à votre galerie pour importer des photos de vos objets de collection.',
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePurchaseHistory',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
      ],
    },
  },
  android: {
    package: 'com.velum.app',
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: './assets/brand/icon-provisional.png',
      backgroundColor: '#1a0d10',
    },
    permissions: ['android.permission.CAMERA'],
  },
  web: {
    output: 'static',
    bundler: 'metro',
    favicon: './assets/brand/icon-provisional.png',
  },
  plugins: [
    'expo-router',
    'expo-camera',
    'expo-video',
    'expo-apple-authentication',
    'expo-secure-store',
    'expo-notifications',
  ],
  extra: {
    features: {
      // Philatélie : module à part entière (révision produit juillet 2026).
      enableStamps: true,
      artDomain: 'tableaux',
      enableMarketplace: false,
    },
    eas: {
      projectId: '00000000-0000-0000-0000-000000000000',
    },
  },
});
