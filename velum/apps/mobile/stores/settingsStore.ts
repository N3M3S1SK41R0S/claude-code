/**
 * Réglages locaux persistés (StorageAdapter offline) : mode senior, langue,
 * onboarding terminé. Rehydratation asynchrone signalée par `hydrated`.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { setLocale, type SupportedLocale } from '../lib/i18n';
import { offlineStorage } from '../lib/offlineStorage';

export interface SettingsState {
  senior: boolean;
  locale: SupportedLocale;
  onboardingDone: boolean;
  /**
   * Consentement au traitement IA des photos/descriptions (règle stores
   * 2026 + RGPD 6.1.a) : null = jamais demandé, false = refusé (photo et
   * texte désactivés, import fichier disponible), true = accordé.
   */
  aiConsent: boolean | null;
  hydrated: boolean;
  setSenior(v: boolean): void;
  setLocale(locale: SupportedLocale): void;
  setOnboardingDone(v: boolean): void;
  setAiConsent(v: boolean): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      senior: false,
      locale: 'fr',
      onboardingDone: false,
      aiConsent: null,
      hydrated: false,
      setSenior: (v) => set({ senior: v }),
      setLocale: (locale) => {
        setLocale(locale);
        set({ locale });
      },
      setOnboardingDone: (v) => set({ onboardingDone: v }),
      setAiConsent: (v) => set({ aiConsent: v }),
    }),
    {
      name: 'velum.settings.v1',
      storage: createJSONStorage(() => offlineStorage),
      partialize: (s) => ({
        senior: s.senior,
        locale: s.locale,
        onboardingDone: s.onboardingDone,
        aiConsent: s.aiConsent,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Applique la langue persistée puis signale la fin de l'hydratation.
          setLocale(state.locale);
          useSettingsStore.setState({ hydrated: true });
        } else {
          useSettingsStore.setState({ hydrated: true });
        }
      },
    },
  ),
);
