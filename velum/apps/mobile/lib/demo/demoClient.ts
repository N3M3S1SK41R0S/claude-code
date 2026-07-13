/**
 * Client DÉMO : implémente l'interface VelumClient entièrement en mémoire,
 * pour utiliser l'app sans backend ni clé (scan, cave, carnet, sommelier,
 * marché). Activé par EXPO_PUBLIC_DEMO=1 (voir lib/client.ts).
 */
import type { AuthSession } from '@supabase/supabase-js';
import type { VelumClient } from '@velum/api-client';
import type {
  NewAlert,
  NewItem,
  NewListing,
  NewProvenanceEntry,
  NewTastingNote,
  QueuedMutation,
  ReplayReport,
} from '@velum/api-client';
import type {
  AlertRecord,
  Candidate,
  DisputeRecord,
  EscrowState,
  ListingRecord,
  MarketOrder,
  Profile,
  ProvenanceEntry,
  SellerReputation,
  TastingNote,
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
  const tastingNotes = new Map<string, TastingNote[]>();
  const provenance = new Map<string, ProvenanceEntry[]>();
  // Communauté démo : 2 annonces d'autres collectionneurs (achetables) + mes ventes.
  const listings: ListingRecord[] = [
    {
      id: 'demo-listing-1', itemId: 'demo-mkt-1', sellerId: 'demo-seller-a',
      askPrice: 320, currency: 'EUR', status: 'active',
      title: 'Napoléon III 20 Francs Or 1868', domain: 'coin', createdAt: '2026-07-08T00:00:00Z',
    },
    {
      id: 'demo-listing-2', itemId: 'demo-mkt-2', sellerId: 'demo-seller-b',
      askPrice: 780, currency: 'EUR', status: 'active',
      title: 'Bloc CITEX 1949 neuf — authentifié', domain: 'stamp', createdAt: '2026-07-03T00:00:00Z',
    },
  ];
  const orders: MarketOrder[] = [];
  const disputes: DisputeRecord[] = [];
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

    tastingNotes: {
      async list(itemId: string) {
        return [...(tastingNotes.get(itemId) ?? [])].sort((a, b) =>
          b.tastedAt.localeCompare(a.tastedAt),
        );
      },
      async add(input: NewTastingNote) {
        const rec: TastingNote = {
          id: `note-${Math.random().toString(36).slice(2)}`,
          itemId: input.itemId,
          rating: input.rating ?? null,
          note: input.note ?? null,
          tastedAt: input.tastedAt ?? nowIso().slice(0, 10),
          createdAt: nowIso(),
        };
        tastingNotes.set(input.itemId, [rec, ...(tastingNotes.get(input.itemId) ?? [])]);
        return rec;
      },
      async remove(id: string) {
        for (const [key, list] of tastingNotes) {
          tastingNotes.set(key, list.filter((n) => n.id !== id));
        }
      },
    },

    provenance: {
      async list(itemId: string) {
        return [...(provenance.get(itemId) ?? [])].sort((a, b) =>
          (a.eventDate ?? '').localeCompare(b.eventDate ?? ''),
        );
      },
      async add(input: NewProvenanceEntry) {
        const rec: ProvenanceEntry = {
          id: `prov-${Math.random().toString(36).slice(2)}`,
          itemId: input.itemId,
          ownerLabel: input.ownerLabel ?? null,
          acquiredFrom: input.acquiredFrom ?? null,
          note: input.note ?? null,
          eventDate: input.eventDate ?? null,
          createdAt: nowIso(),
        };
        provenance.set(input.itemId, [...(provenance.get(input.itemId) ?? []), rec]);
        return rec;
      },
      async remove(id: string) {
        for (const [key, list] of provenance) {
          provenance.set(key, list.filter((p) => p.id !== id));
        }
      },
    },

    marketplace: {
      async browseActive() {
        await tick();
        return listings.filter((l) => l.status === 'active' && l.sellerId !== DEMO_OWNER);
      },
      async myListings() {
        return listings.filter((l) => l.sellerId === DEMO_OWNER);
      },
      async createListing(input: NewListing) {
        const item = findItem(input.itemId);
        const rec: ListingRecord = {
          id: `list-${Math.random().toString(36).slice(2)}`,
          itemId: input.itemId,
          sellerId: DEMO_OWNER,
          askPrice: input.askPrice,
          currency: input.currency ?? 'EUR',
          status: 'active',
          title: item?.title ?? null,
          domain: item?.domain ?? null,
          createdAt: nowIso(),
        };
        listings.unshift(rec);
        return rec;
      },
      async myOrders() {
        return orders.filter((o) => o.buyerId === DEMO_OWNER || o.sellerId === DEMO_OWNER);
      },
      async buy(listingId: string) {
        await tick();
        const l = listings.find((x) => x.id === listingId);
        if (!l) throw new VelumError('INVALID_INPUT', 'Annonce introuvable (démo)');
        const rec: MarketOrder = {
          id: `ord-${Math.random().toString(36).slice(2)}`,
          listingId,
          buyerId: DEMO_OWNER,
          sellerId: l.sellerId,
          amount: l.askPrice,
          currency: l.currency,
          commissionRate: 0.05,
          escrowState: 'pending_payment',
          carrier: null,
          trackingNumber: null,
          deliveredAt: null,
          releasedAt: null,
          createdAt: nowIso(),
        };
        orders.unshift(rec);
        return rec;
      },
      async advanceOrder(orderId: string, escrowState: EscrowState, patch) {
        const o = orders.find((x) => x.id === orderId);
        if (!o) throw new VelumError('INVALID_INPUT', 'Commande introuvable (démo)');
        o.escrowState = escrowState;
        if (patch?.carrier !== undefined) o.carrier = patch.carrier;
        if (patch?.trackingNumber !== undefined) o.trackingNumber = patch.trackingNumber;
        if (patch?.deliveredAt !== undefined) o.deliveredAt = patch.deliveredAt;
        if (escrowState === 'released') o.releasedAt = nowIso();
        return o;
      },
      async openDispute(orderId: string, reason: string) {
        const o = orders.find((x) => x.id === orderId);
        if (o) o.escrowState = 'disputed';
        const rec: DisputeRecord = {
          id: `disp-${Math.random().toString(36).slice(2)}`,
          orderId,
          openedBy: DEMO_OWNER,
          reason,
          status: 'open',
          resolutionNote: null,
          createdAt: nowIso(),
          resolvedAt: null,
        };
        disputes.push(rec);
        return rec;
      },
      async reputation(sellerId: string): Promise<SellerReputation> {
        const mine = orders.filter((o) => o.sellerId === sellerId);
        return {
          completedSales: mine.filter((o) => o.escrowState === 'released').length,
          refunded: mine.filter((o) => o.escrowState === 'refunded').length,
          disputes: disputes.filter((d) => mine.some((o) => o.id === d.orderId)).length,
          disputeRate: 0,
          memberSince: '2024-01-01T00:00:00Z',
        };
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
