import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires des modules PURS de l'app (exporters, valueHistory).
 * Les écrans React Native ne sont pas testés ici (pas de runtime natif).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'stores/**/*.test.ts'],
  },
});
