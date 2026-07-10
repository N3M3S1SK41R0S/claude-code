/**
 * Repositories Postgres (via PostgREST) : items, valuations, alerts, profile.
 * La RLS (migration 0001) garantit que chaque utilisateur ne voit que ses
 * données — les repos n'ajoutent aucun filtrage de propriété côté client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VelumError,
  type AlertRecord,
  type Profile,
  type ValuationRecord,
  type VelumDomain,
  type VelumItem,
} from '@velum/core';
import {
  alertToRow,
  itemPatchToRow,
  newItemToRow,
  profilePatchToRow,
  rowToAlert,
  rowToItem,
  rowToProfile,
  rowToValuation,
  type AlertRow,
  type ItemRow,
  type NewAlert,
  type NewItem,
  type ProfilePatch,
  type ProfileRow,
  type ValuationRow,
} from './mappers';

/** Convertit une erreur PostgREST en VelumError lisible. */
function dbError(context: string, error: { message: string }): VelumError {
  return new VelumError('SOURCE_UNAVAILABLE', `${context} : ${error.message}`);
}

// ── items ────────────────────────────────────────────────────────────────────

export interface ItemsRepo {
  /** Liste les objets (tri updated_at décroissant), filtrés par domaine si fourni. */
  list(domain?: VelumDomain): Promise<VelumItem[]>;
  get(id: string): Promise<VelumItem | null>;
  insert(input: NewItem): Promise<VelumItem>;
  /** Met à jour et pousse updated_at = maintenant (last-write-wins côté file). */
  update(id: string, patch: Partial<VelumItem> & { updatedAt: string }): Promise<VelumItem>;
  remove(id: string): Promise<void>;
}

export function createItemsRepo(supabase: SupabaseClient): ItemsRepo {
  return {
    async list(domain) {
      let query = supabase.from('items').select('*');
      if (domain !== undefined) query = query.eq('domain', domain);
      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw dbError('Lecture des objets impossible', error);
      return ((data ?? []) as ItemRow[]).map(rowToItem);
    },

    async get(id) {
      const { data, error } = await supabase.from('items').select('*').eq('id', id).maybeSingle();
      if (error) throw dbError("Lecture de l'objet impossible", error);
      return data === null ? null : rowToItem(data as ItemRow);
    },

    async insert(input) {
      const { data, error } = await supabase
        .from('items')
        .insert(newItemToRow(input))
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError("Création de l'objet impossible", error ?? { message: 'réponse vide' });
      }
      return rowToItem(data as ItemRow);
    },

    async update(id, patch) {
      const row = { ...itemPatchToRow(patch), updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('items')
        .update(row)
        .eq('id', id)
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError("Mise à jour de l'objet impossible", error ?? { message: 'objet introuvable' });
      }
      return rowToItem(data as ItemRow);
    },

    async remove(id) {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw dbError("Suppression de l'objet impossible", error);
    },
  };
}

// ── valuations ───────────────────────────────────────────────────────────────

export interface ValuationsRepo {
  /** Historique complet, du plus récent au plus ancien. */
  history(itemId: string): Promise<ValuationRecord[]>;
  /** Dernière valorisation, ou null si l'objet n'a jamais été valorisé. */
  latest(itemId: string): Promise<ValuationRecord | null>;
}

export function createValuationsRepo(supabase: SupabaseClient): ValuationsRepo {
  return {
    async history(itemId) {
      const { data, error } = await supabase
        .from('valuations')
        .select('*')
        .eq('item_id', itemId)
        .order('valued_at', { ascending: false });
      if (error) throw dbError("Lecture de l'historique de valorisation impossible", error);
      return ((data ?? []) as ValuationRow[]).map(rowToValuation);
    },

    async latest(itemId) {
      const { data, error } = await supabase
        .from('valuations')
        .select('*')
        .eq('item_id', itemId)
        .order('valued_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw dbError('Lecture de la dernière valorisation impossible', error);
      return data === null ? null : rowToValuation(data as ValuationRow);
    },
  };
}

// ── alerts ───────────────────────────────────────────────────────────────────

export interface AlertsRepo {
  list(itemId?: string): Promise<AlertRecord[]>;
  /** Crée (sans id) ou remplace (avec id) une alerte. */
  upsert(alert: NewAlert): Promise<AlertRecord>;
  remove(id: string): Promise<void>;
}

export function createAlertsRepo(supabase: SupabaseClient): AlertsRepo {
  return {
    async list(itemId) {
      let query = supabase.from('alerts').select('*');
      if (itemId !== undefined) query = query.eq('item_id', itemId);
      const { data, error } = await query;
      if (error) throw dbError('Lecture des alertes impossible', error);
      return ((data ?? []) as AlertRow[]).map(rowToAlert);
    },

    async upsert(alert) {
      const { data, error } = await supabase
        .from('alerts')
        .upsert(alertToRow(alert))
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError("Enregistrement de l'alerte impossible", error ?? { message: 'réponse vide' });
      }
      return rowToAlert(data as AlertRow);
    },

    async remove(id) {
      const { error } = await supabase.from('alerts').delete().eq('id', id);
      if (error) throw dbError("Suppression de l'alerte impossible", error);
    },
  };
}

// ── profile ──────────────────────────────────────────────────────────────────

export interface ProfileApi {
  /** Profil de l'utilisateur connecté (RLS : une seule ligne visible), ou null. */
  get(): Promise<Profile | null>;
  update(patch: ProfilePatch): Promise<void>;
}

export function createProfileApi(supabase: SupabaseClient): ProfileApi {
  return {
    async get() {
      const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
      if (error) throw dbError('Lecture du profil impossible', error);
      return data === null ? null : rowToProfile(data as ProfileRow);
    },

    async update(patch) {
      const row = profilePatchToRow(patch);
      if (Object.keys(row).length === 0) return; // patch vide → rien à faire
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        throw new VelumError('UNAUTHORIZED', 'Aucune session active : connexion requise');
      }
      const { error } = await supabase.from('profiles').update(row).eq('id', userId);
      if (error) throw dbError('Mise à jour du profil impossible', error);
    },
  };
}
