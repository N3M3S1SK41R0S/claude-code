/**
 * Client DÉMO : implémente l'interface VelumClient entièrement en mémoire,
 * pour utiliser l'app sans backend ni clé (scan, cave, carnet, sommelier,
 * marché). Activé par EXPO_PUBLIC_DEMO=1 (voir lib/client.ts).
 */
import type { AuthSession } from '@supabase/supabase-js';
import type { VelumClient } from '@velum/api-client';
import type { NewAlert, NewItem, QueuedMutation, ReplayReport } from '@velum/api-client';
import type {
  AlertRecord,
  Candidate,
  Profile,
  ValuationRecord,
  VelumDomain,
  VelumItem,
} from '@velum/core';
import { VelumError, type AnalysisResult, type PairingResult, type RecognitionResult, type ValuationResult } from '@velum/core';

import {
  DEMO_NOTIFICATIONS,
  DEMO_OWNER,
  demoAnalyze,
  demoRecognize,
  demoValuate,
  nowIso,
  seedAlerts,
  seedItems,
} from './demoData';

const DEMO_SESSION = {
  access_token: 'demo',
  refresh_token: 'demo',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  user: {
    id: DEMO_OWNER,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@velum.app',
    app_metadata: {},
    user_metadata: { display_name: 'Vous (mode démo)' },
    created_at: nowIso(),
  },
} as unknown as AuthSession;

export function createDemoClient(): VelumClient {
  const items: VelumItem[] = seedItems();
  const valuations = new Map<string, ValuationRecord[]>();
  const alerts: AlertRecord[] = seedAlerts(items);
  const authListeners = new Set<(event: string, session: AuthSession | null) => void>();

  const findItem = (id: string) => items.find((i) => i.id === id) ?? null;

  const notificationsQuery = {
    select: () => notificationsQuery,
    order: () => notificationsQuery,
    limit: () => notificationsQuery,
    then: (resolve: (r: { data: unknown; error: null }) => void) =>
      resolve({ data: DEMO_NOTIFICATIONS, error: null }),
  };

  const client: VelumClient = {
    // Échappatoire minimale : seul l'onglet Marché lit `notifications`.
    supabase: { from: () => notificationsQuery } as unknown as VelumClient['supabase'],

    auth: {
      async signInWithEmail() {
        authListeners.forEach((cb) => cb('SIGNED_IN', DEMO_SESSION));
        return DEMO_SESSION;
      },
      async signUpWithEmail() {
        authListeners.forEach((cb) => cb('SIGNED_IN', DEMO_SESSION));
        return DEMO_SESSION;
      },
      async signInWithIdToken() {
        authListeners.forEach((cb) => cb('SIGNED_IN', DEMO_SESSION));
        return DEMO_SESSION;
      },
      async signOut() {
        authListeners.forEach((cb) => cb('SIGNED_OUT', null));
      },
      async deleteAccount() {
        items.length = 0;
        authListeners.forEach((cb) => cb('SIGNED_OUT', null));
      },
      onAuthStateChange(cb) {
        authListeners.add(cb);
        // Session démo immédiate → l'utilisateur est « connecté » sans saisie.
        cb('INITIAL_SESSION', DEMO_SESSION);
        return () => authListeners.delete(cb);
      },
      async getSession() {
        return DEMO_SESSION;
      },
    },

    edge: {
      async recognize(domain: VelumDomain, input): Promise<RecognitionResult> {
        await tick();
        return demoRecognize(domain, input);
      },
      async analyze(domain: VelumDomain, candidate: Candidate): Promise<AnalysisResult> {
        await tick();
        return demoAnalyze(domain, candidate);
      },
      async valuate(domain: VelumDomain, candidate: Candidate, itemId?: string): Promise<ValuationResult> {
        await tick();
        const result = demoValuate(domain, candidate);
        if (itemId) {
          const rec: ValuationRecord = {
            id: `val-${Math.random().toString(36).slice(2)}`,
            itemId,
            central: result.central,
            ci80Low: result.ci80[0],
            ci80High: result.ci80[1],
            ci95Low: result.ci95[0],
            ci95High: result.ci95[1],
            reliability: result.reliability,
            sources: result.observations,
            valuedAt: nowIso(),
          };
          valuations.set(itemId, [rec, ...(valuations.get(itemId) ?? [])]);
        }
        return result;
      },
      async cellarPairing(dish: string): Promise<PairingResult> {
        await tick();
        const cave = items.filter((i) => i.domain === 'wine');
        if (cave.length === 0) {
          return { recommendations: [], fallbackAdvice: 'Votre cave démo est vide.' };
        }
        const top = cave[0] as VelumItem;
        return {
          recommendations: [
            {
              itemId: top.id,
              label: top.title ?? 'Vin',
              score: 0.9,
              reasoning: `Accord démo avec « ${dish} » : la structure tannique et la garrigue soutiennent le plat.`,
              serveAt: '17 °C, carafé 1 h',
            },
          ],
        };
      },
    },

    items: {
      async list(domain?: VelumDomain) {
        return domain ? items.filter((i) => i.domain === domain) : [...items];
      },
      async get(id) {
        return findItem(id);
      },
      async insert(input: NewItem) {
        const item: VelumItem = {
          id: input.id ?? `demo-${Math.random().toString(36).slice(2, 10)}`,
          ownerId: DEMO_OWNER,
          domain: input.domain,
          title: input.title ?? null,
          attributes: input.attributes ?? {},
          confidence: input.confidence ?? null,
          acquiredAt: input.acquiredAt ?? null,
          acquiredPrice: input.acquiredPrice ?? null,
          condition: input.condition ?? null,
          notes: input.notes ?? null,
          storageLocation: input.storageLocation ?? null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        items.unshift(item);
        return item;
      },
      async update(id, patch) {
        const item = findItem(id);
        if (!item) throw new VelumError('INVALID_INPUT', 'Objet introuvable (démo)');
        Object.assign(item, patch, { updatedAt: patch.updatedAt });
        return item;
      },
      async remove(id) {
        const idx = items.findIndex((i) => i.id === id);
        if (idx >= 0) items.splice(idx, 1);
      },
    },

    valuations: {
      async history(itemId) {
        return valuations.get(itemId) ?? [];
      },
      async latest(itemId) {
        return valuations.get(itemId)?.[0] ?? null;
      },
    },

    alerts: {
      async list(itemId?: string) {
        return itemId ? alerts.filter((a) => a.itemId === itemId) : [...alerts];
      },
      async upsert(alert: NewAlert) {
        const rec: AlertRecord = {
          id: `alert-${Math.random().toString(36).slice(2)}`,
          itemId: alert.itemId,
          type: alert.type,
          config: alert.config ?? {},
          active: true,
        };
        alerts.push(rec);
        return rec;
      },
      async remove(id) {
        const idx = alerts.findIndex((a) => a.id === id);
        if (idx >= 0) alerts.splice(idx, 1);
      },
    },

    profile: {
      async get(): Promise<Profile> {
        return {
          id: DEMO_OWNER,
          displayName: 'Vous (mode démo)',
          locale: 'fr',
          a11yMode: false,
          plan: 'platine', // toutes les fonctions ouvertes en démo
          createdAt: nowIso(),
        };
      },
      async update() {
        /* no-op en démo */
      },
    },

    // File de mutations inutile en démo (tout est synchrone/local).
    queue: {
      async enqueue(_m: QueuedMutation) {},
      async size() {
        return 0;
      },
      async replay(): Promise<ReplayReport> {
        return { applied: 0, skipped: 0, failed: 0 };
      },
      async clear() {},
    } as VelumClient['queue'],
  };

  return client;
}

/** Petit délai pour simuler la latence réseau (spinners visibles). */
function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 350));
}
