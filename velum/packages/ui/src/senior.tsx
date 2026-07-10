/**
 * Mode senior VELUM (§11.2) : gros boutons, typographie majorée ×1.25,
 * cibles tactiles 56 pt. Fourni via contexte React à toute l'app.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { scaleForSenior } from './a11y';

export interface SeniorModeContextValue {
  /** Mode senior actif ? */
  senior: boolean;
  setSenior(v: boolean): void;
  /** Majore une dimension : ×1.25 arrondi en mode senior (16 → 20), identité sinon. */
  scale(n: number): number;
}

/** Valeur par défaut (hors provider) : mode standard, réglage inopérant. */
const defaultValue: SeniorModeContextValue = {
  senior: false,
  setSenior: () => {},
  scale: (n) => n,
};

const SeniorModeContext = createContext<SeniorModeContextValue>(defaultValue);

export interface SeniorModeProviderProps {
  children: ReactNode;
  /** État initial (ex. `profile.a11yMode` persisté côté Supabase). */
  initialSenior?: boolean;
  /** Callback de persistance à chaque changement. */
  onChange?: (v: boolean) => void;
}

export function SeniorModeProvider({ children, initialSenior = false, onChange }: SeniorModeProviderProps) {
  const [senior, setSeniorState] = useState(initialSenior);

  const setSenior = useCallback(
    (v: boolean) => {
      setSeniorState(v);
      onChange?.(v);
    },
    [onChange],
  );

  const scale = useCallback((n: number) => scaleForSenior(n, senior), [senior]);

  const value = useMemo<SeniorModeContextValue>(() => ({ senior, setSenior, scale }), [senior, setSenior, scale]);

  return <SeniorModeContext.Provider value={value}>{children}</SeniorModeContext.Provider>;
}

/** Accès au mode senior — utilisable sans provider (mode standard par défaut). */
export function useSeniorMode(): SeniorModeContextValue {
  return useContext(SeniorModeContext);
}
