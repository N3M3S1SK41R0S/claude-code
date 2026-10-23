/**
 * Liste d'envies — implémentation DÉMO en mémoire du contrat WishlistRepo.
 *
 * Mêmes règles que le dépôt réel : validation et normalisation par les
 * mappers de @velum/api-client (titre obligatoire et borné, notes, prix cible
 * ≥ 0), `acquiredAt` posé / effacé uniquement quand `acquired` change, ordre
 * « en cours d'abord, puis plus récentes », copies à chaque lecture (le cache
 * React Query ne partage jamais un objet muté en place). Horloge, identifiants
 * et latence injectables pour des tests déterministes.
 */
import {
  newWishlistEntryToRow,
  rowToWishlistEntry,
  wishlistPatchToRow,
  type WishlistRepo,
  type WishlistRow,
} from '@velum/api-client';
import { VelumError, type WishlistEntry } from '@velum/core';

import { DEMO_OWNER } from './demoData';

export interface DemoWishlistOptions {
  /** Horloge (défaut : heure réelle). */
  now?: () => Date;
  /** Générateur d'identifiants (défaut : aléatoire). */
  nextId?: () => string;
  /** Latence simulée en ms (défaut : 120 ; 0 en test). */
  latencyMs?: number;
  /** Jeu de départ (défaut : `seedWishlist()`). */
  seed?: WishlistEntry[];
}

type SeedInput = Pick<WishlistEntry, 'id' | 'domain' | 'title' | 'createdAt'> &
  Partial<Omit<WishlistEntry, 'id' | 'domain' | 'title' | 'createdAt' | 'ownerId'>>;

function seedEntry(input: SeedInput): WishlistEntry {
  return {
    ownerId: DEMO_OWNER,
    kind: 'wish',
    notes: null,
    attributes: {},
    source: 'manual',
    sourceItemId: null,
    targetPrice: null,
    priority: 'medium',
    acquired: false,
    acquiredAt: null,
    updatedAt: input.acquiredAt ?? input.createdAt,
    ...input,
  };
}

/**
 * Jeu démo : plusieurs catégories, envies / idées / obtenues, toutes les
 * origines. Certaines envies existent dans le catalogue démo de la communauté
 * (« Napoléon III 20 Francs Or », « Cérès 20c noir 1849 »…) pour montrer la
 * vérification « Disponible dans la communauté ? ».
 */
export function seedWishlist(): WishlistEntry[] {
  return [
    seedEntry({
      id: 'demo-wish-1',
      domain: 'wine',
      title: 'Domaine Tempier Bandol La Tourtine 2019',
      notes: 'Goûté chez des amis — superbe sur un gigot d’agneau.',
      attributes: { producer: 'Domaine Tempier', appellation: 'Bandol', vintage: 2019, cuvee: 'La Tourtine' },
      source: 'tasting',
      targetPrice: 60,
      priority: 'high',
      createdAt: '2026-07-10T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-2',
      domain: 'coin',
      kind: 'idea',
      title: '10 Francs Coq or — compléter la série',
      notes: 'Il me manque les millésimes 1906 et 1910.',
      attributes: { country: 'France', type: '10 Francs Coq', metal: 'or' },
      createdAt: '2026-07-10T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-3',
      domain: 'wine',
      title: 'Château Pradeaux Bandol',
      notes: 'Bu au restaurant, scanné sur la carte — à retrouver chez un caviste.',
      attributes: { producer: 'Château Pradeaux', appellation: 'Bandol' },
      source: 'scan',
      targetPrice: 45,
      createdAt: '2026-08-02T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-4',
      domain: 'wine',
      kind: 'idea',
      title: 'Vins orange du Jura',
      notes: 'Idée : explorer les macérations, demander conseil au caviste.',
      priority: 'low',
      createdAt: '2026-06-15T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-5',
      domain: 'wine',
      title: 'Château Talbot 2010',
      notes: 'Pour l’anniversaire de Paul.',
      attributes: { producer: 'Château Talbot', appellation: 'Saint-Julien', vintage: 2010 },
      targetPrice: 70,
      acquired: true,
      acquiredAt: '2026-09-12T00:00:00Z',
      createdAt: '2026-05-20T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-6',
      domain: 'coin',
      title: 'Napoléon III 20 Francs Or',
      notes: 'Compléter la série Second Empire, belle qualité (TTB ou mieux).',
      attributes: { country: 'France', type: '20 Francs Or Napoléon III', metal: 'or' },
      targetPrice: 350,
      priority: 'high',
      createdAt: '2026-07-01T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-7',
      domain: 'coin',
      title: 'Hercule 10 Francs argent 1965',
      attributes: { country: 'France', type: '10 Francs Hercule', year: 1965 },
      source: 'market',
      targetPrice: 25,
      acquired: true,
      acquiredAt: '2026-08-30T00:00:00Z',
      createdAt: '2026-07-20T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-8',
      domain: 'stamp',
      title: 'Cérès 20c noir 1849',
      notes: 'Oblitération grille, marges complètes.',
      attributes: { country: 'France', catalogNumber: 'YT 3', year: 1849 },
      source: 'scan',
      targetPrice: 300,
      priority: 'high',
      createdAt: '2026-08-20T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-9',
      domain: 'art',
      kind: 'idea',
      title: 'Lithographie provençale d’après-guerre',
      notes: 'Pour le salon : paysage lumineux, format moyen.',
      priority: 'low',
      createdAt: '2026-06-01T00:00:00Z',
    }),
    seedEntry({
      id: 'demo-wish-10',
      domain: 'watch',
      title: 'Omega Speedmaster Professional',
      notes: 'Essayée chez un ami : le calibre manuel, un classique.',
      attributes: { brand: 'Omega', model: 'Speedmaster Professional' },
      targetPrice: 5500,
      createdAt: '2026-04-10T00:00:00Z',
    }),
  ];
}

/** Ordre de `list()` : en cours d'abord, puis plus récentes (identifiant en dernier recours). */
function compareForList(a: WishlistEntry, b: WishlistEntry): number {
  if (a.acquired !== b.acquired) return a.acquired ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function copy(entry: WishlistEntry): WishlistEntry {
  return { ...entry, attributes: { ...entry.attributes } };
}

/** Entrée → ligne PostgREST (pour réutiliser les mappers du dépôt réel). */
function toRow(entry: WishlistEntry): WishlistRow {
  return {
    id: entry.id,
    owner_id: entry.ownerId,
    domain: entry.domain,
    kind: entry.kind,
    title: entry.title,
    notes: entry.notes,
    attributes: entry.attributes,
    source: entry.source,
    source_item_id: entry.sourceItemId,
    target_price: entry.targetPrice,
    priority: entry.priority,
    acquired: entry.acquired,
    acquired_at: entry.acquiredAt,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

export function createDemoWishlistRepo(options: DemoWishlistOptions = {}): WishlistRepo {
  const now = options.now ?? (() => new Date());
  const nextId = options.nextId ?? (() => `wish-${Math.random().toString(36).slice(2, 10)}`);
  const latencyMs = options.latencyMs ?? 120;
  const entries: WishlistEntry[] = (options.seed ?? seedWishlist()).map(copy);

  const tick = (): Promise<void> =>
    latencyMs > 0 ? new Promise((resolve) => setTimeout(resolve, latencyMs)) : Promise.resolve();

  const indexOf = (id: string): number => {
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) throw new VelumError('INVALID_INPUT', 'Envie introuvable (démo)');
    return index;
  };

  return {
    async list(domain) {
      await tick();
      return entries
        .filter((e) => domain === undefined || e.domain === domain)
        .sort(compareForList)
        .map(copy);
    },

    async add(input) {
      await tick();
      // Même validation / normalisation que le dépôt réel (INVALID_INPUT sinon).
      const row = newWishlistEntryToRow(input, DEMO_OWNER);
      const at = now().toISOString();
      const entry = rowToWishlistEntry({
        ...(row as Omit<WishlistRow, 'id' | 'acquired' | 'acquired_at' | 'created_at' | 'updated_at'>),
        id: nextId(),
        acquired: false,
        acquired_at: null,
        created_at: at,
        updated_at: at,
      });
      entries.unshift(entry);
      return copy(entry);
    },

    async update(id, patch) {
      await tick();
      const index = indexOf(id);
      const current = entries[index] as WishlistEntry; // indexOf garantit l'existence
      const changes = wishlistPatchToRow(patch);
      if (Object.keys(changes).length === 0) return copy(current);
      const at = now().toISOString();
      const acquiredChanged = patch.acquired !== undefined && patch.acquired !== current.acquired;
      const next = rowToWishlistEntry({
        ...toRow(current),
        ...changes,
        // Comme le trigger serveur : acquired_at suit `acquired`, jamais fourni.
        acquired_at: acquiredChanged ? (patch.acquired ? at : null) : current.acquiredAt,
        updated_at: at,
      } as WishlistRow);
      entries[index] = next;
      return copy(next);
    },

    async remove(id) {
      await tick();
      const index = entries.findIndex((e) => e.id === id);
      if (index >= 0) entries.splice(index, 1);
    },
  };
}
