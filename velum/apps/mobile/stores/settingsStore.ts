/**
 * Réglages locaux persistés (StorageAdapter offline) : mode senior, langue,
 * onboarding terminé, rappels « à boire ». Rehydratation asynchrone signalée
 * par `hydrated`.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_DRINK_REMINDER_PREFS,
  normalizeDrinkReminderPrefs,
  type DrinkReminderPrefs,
} from '../lib/drinkReminders';
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
  /** Rappels « à boire » (notifications locales) — ajout rétro-compatible. */
  drinkReminder: DrinkReminderPrefs;
  hydrated: boolean;
  setSenior(v: boolean): void;
  setLocale(locale: SupportedLocale): void;
  setOnboardingDone(v: boolean): void;
  setAiConsent(v: boolean): void;
  setDrinkReminder(patch: Partial<DrinkReminderPrefs>): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      senior: false,
      locale: 'fr',
      onboardingDone: false,
      aiConsent: null,
      drinkReminder: { ...DEFAULT_DRINK_REMINDER_PREFS },
      hydrated: false,
      setSenior: (v) => set({ senior: v }),
      setLocale: (locale) => {
        setLocale(locale);
        set({ locale });
      },
      setOnboardingDone: (v) => set({ onboardingDone: v }),
      setAiConsent: (v) => set({ aiConsent: v }),
      setDrinkReminder: (patch) =>
        set((state) => ({ drinkReminder: normalizeDrinkReminderPrefs({ ...state.drinkReminder, ...patch }) })),
    }),
    {
      name: 'velum.settings.v1',
      storage: createJSONStorage(() => offlineStorage),
      partialize: (s) => ({
        senior: s.senior,
        locale: s.locale,
        onboardingDone: s.onboardingDone,
        aiConsent: s.aiConsent,
        drinkReminder: s.drinkReminder,
      }),
      // Fusion défensive : un stockage antérieur (sans rappels) ou corrompu
      // retombe sur des préférences sûres au lieu de casser l'hydratation.
      merge: (persisted, current) => {
        const saved = persisted && typeof persisted === 'object' ? (persisted as Partial<SettingsState>) : {};
        return {
          ...current,
          ...saved,
          drinkReminder: normalizeDrinkReminderPrefs(saved.drinkReminder),
        };
      },
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
