/**
 * FAKE structurel minimal du client Supabase pour les tests — aucun réseau.
 * Couvre le sous-ensemble utilisé par @velum/api-client :
 *   from().select().eq().order().limit().single()/.maybeSingle(),
 *   insert/update/upsert/delete (+ .select().single() chaîné),
 *   storage.from().remove(), functions.invoke, auth.getSession/signOut.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

export interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

interface FakeInvokeResponse {
  data?: unknown;
  error?: unknown;
}

export class FakeSupabase {
  /** Données en mémoire, par table, en snake_case comme PostgREST. */
  tables: Record<string, Row[]> = {};
  /** true → toutes les opérations PostgREST/Storage échouent (panne réseau simulée). */
  offline = false;
  /** Objets Storage présents, par bucket. */
  storageObjects: Record<string, Set<string>> = {};
  /** Journal des suppressions Storage demandées. */
  storageRemovals: { bucket: string; paths: string[] }[] = [];
  /** Erreur Storage ciblée, indépendante de PostgREST. */
  storageError: { message: string } | null = null;
  /** Journal des invocations d'Edge Functions. */
  invocations: { fn: string; body: unknown }[] = [];
  /** Réponses simulées par nom de fonction Edge. */
  invokeResponses: Record<string, FakeInvokeResponse> = {};
  /** Session simulée pour auth.getSession(). */
  session: { user: { id: string } } | null = null;

  constructor(
    /** Horloge injectée : les tests temporels ne dépendent jamais de l'heure réelle. */
    readonly now: () => string = () => new Date().toISOString(),
  ) {}

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }

  storage = {
    from: (bucket: string) => ({
      remove: async (
        paths: string[],
      ): Promise<{ data: { name: string }[] | null; error: { message: string } | null }> => {
        const requested = [...paths];
        this.storageRemovals.push({ bucket, paths: requested });
        if (this.offline) {
          return { data: null, error: { message: 'réseau indisponible (simulé)' } };
        }
        if (this.storageError !== null) return { data: null, error: this.storageError };

        const objects = this.storageObjects[bucket] ?? new Set<string>();
        this.storageObjects[bucket] = objects;
        const removed: { name: string }[] = [];
        for (const path of requested) {
          if (objects.delete(path)) removed.push({ name: path });
        }
        return { data: removed, error: null };
      },
    }),
  };

  functions = {
    invoke: async (
      fn: string,
      options?: { body?: unknown },
    ): Promise<{ data: unknown; error: unknown }> => {
      this.invocations.push({ fn, body: options?.body ?? undefined });
      const response = this.invokeResponses[fn];
      if (response === undefined) return { data: null, error: null };
      return { data: response.data ?? null, error: response.error ?? null };
    },
  };

  auth = {
    getSession: async (): Promise<{ data: { session: { user: { id: string } } | null } }> => ({
      data: { session: this.session },
    }),
    signOut: async (): Promise<{ error: null }> => ({ error: null }),
  };

  /** Rangée d'une table, ou undefined. */
  row(table: string, id: string): Row | undefined {
    return (this.tables[table] ?? []).find((r) => r['id'] === id);
  }
}

/** Cast structurel vers le type attendu par les façades du package. */
export function asSupabase(fake: FakeSupabase): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type ResultShape = 'rows' | 'single' | 'maybeSingle';

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  private operation: Operation = 'select';
  private payload: Row | Row[] | null = null;
  private filters: { column: string; value: unknown }[] = [];
  private ordering: { column: string; ascending: boolean } | null = null;
  private max: number | null = null;
  private shape: ResultShape = 'rows';

  constructor(
    private readonly fake: FakeSupabase,
    private readonly table: string,
  ) {}

  select(_columns?: string): this {
    return this; // la projection de colonnes n'est pas simulée
  }

  insert(row: Row | Row[]): this {
    this.operation = 'insert';
    this.payload = row;
    return this;
  }

  update(row: Row): this {
    this.operation = 'update';
    this.payload = row;
    return this;
  }

  upsert(row: Row): this {
    this.operation = 'upsert';
    this.payload = row;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.ordering = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number): this {
    this.max = count;
    return this;
  }

  single(): this {
    this.shape = 'single';
    return this;
  }

  maybeSingle(): this {
    this.shape = 'maybeSingle';
    return this;
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<FakeResult> {
    if (this.fake.offline) {
      return { data: null, error: { message: 'réseau indisponible (simulé)' } };
    }
    const rows = this.fake.tables[this.table] ?? (this.fake.tables[this.table] = []);
    const matches = (row: Row): boolean =>
      this.filters.every((f) => row[f.column] === f.value);

    switch (this.operation) {
      case 'select': {
        let out = rows.filter(matches);
        if (this.ordering !== null) {
          const { column, ascending } = this.ordering;
          out = [...out].sort((a, b) => compareValues(a[column], b[column]) * (ascending ? 1 : -1));
        }
        if (this.max !== null) out = out.slice(0, this.max);
        return this.finish(out);
      }

      case 'insert': {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
        const inserted = payloads.map((payload) => {
          const row: Row = { ...payload };
          const timestamp = this.fake.now();
          if (row['id'] === undefined) row['id'] = `fake-${this.table}-${rows.length + 1}`;
          if (row['created_at'] === undefined) row['created_at'] = timestamp;
          if (this.table === 'items' && row['updated_at'] === undefined) {
            row['updated_at'] = timestamp;
          }
          rows.push(row);
          return row;
        });
        return this.finish(inserted);
      }

      case 'update': {
        const payload = Array.isArray(this.payload) ? {} : (this.payload ?? {});
        const updated: Row[] = [];
        for (let i = 0; i < rows.length; i++) {
          const current = rows[i];
          if (current !== undefined && matches(current)) {
            const next: Row = { ...current, ...payload };
            rows[i] = next;
            updated.push(next);
          }
        }
        return this.finish(updated);
      }

      case 'upsert': {
        const payload = Array.isArray(this.payload) ? {} : (this.payload ?? {});
        const row: Row = { ...payload };
        const index =
          row['id'] === undefined ? -1 : rows.findIndex((r) => r['id'] === row['id']);
        if (index >= 0) {
          const next: Row = { ...(rows[index] ?? {}), ...row };
          rows[index] = next;
          return this.finish([next]);
        }
        if (row['id'] === undefined) row['id'] = `fake-${this.table}-${rows.length + 1}`;
        rows.push(row);
        return this.finish([row]);
      }

      case 'delete': {
        const removed = rows.filter(matches);
        this.fake.tables[this.table] = rows.filter((r) => !matches(r));
        return this.finish(removed);
      }
    }
  }

  private finish(out: Row[]): FakeResult {
    if (this.shape === 'single') {
      const first = out[0];
      if (first === undefined) {
        return { data: null, error: { message: 'aucune ligne ne correspond (simulé)' } };
      }
      return { data: first, error: null };
    }
    if (this.shape === 'maybeSingle') {
      return { data: out[0] ?? null, error: null };
    }
    return { data: out, error: null };
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
