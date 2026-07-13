-- ─────────────────────────────────────────────────────────────────────────────
-- STUB Supabase pour PostgreSQL « nu » — permet de rejouer les migrations et
-- de tester la RLS sans la plateforme (CI, poste local sans Docker).
-- Reproduit le minimum utilisé par les migrations VELUM : rôles, schéma auth
-- (users/identities/uid()), schéma storage (buckets/objects/foldername).
-- NE PAS exécuter sur un vrai projet Supabase : tout existe déjà là-bas.
-- ─────────────────────────────────────────────────────────────────────────────

-- Rôles standard Supabase (nologin ; SET ROLE depuis le superuser de test).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create extension if not exists pgcrypto;

-- ── Schéma auth ──────────────────────────────────────────────────────────────
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists auth.identities (
  id uuid,
  user_id uuid references auth.users (id) on delete cascade,
  identity_data jsonb,
  provider text,
  provider_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_sign_in_at timestamptz,
  unique (provider, provider_id)
);

-- auth.uid() de test : lit le GUC velum.uid posé par `set local velum.uid=…`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select nullif(current_setting('velum.uid', true), '')::uuid $$;

-- ── Schéma storage ───────────────────────────────────────────────────────────
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

-- Identique à l'implémentation Supabase : segments du chemin sans le fichier.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- ── Grants équivalents aux défauts Supabase ─────────────────────────────────
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
grant all on all tables in schema storage to authenticated, service_role;
