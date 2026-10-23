-- ============================================================================
-- VELUM — plateformes d'échange et de vente (1/5) : ANONYMAT pair-à-pair.
-- ----------------------------------------------------------------------------
-- Spécification : docs/COMMUNITY_MARKETPLACE.md. Contrats TypeScript :
-- packages/core/src/market.ts ; règles pures : packages/config/src/marketplace.ts
-- (SOURCE DE VÉRITÉ — toute évolution là-bas impose la même évolution ici).
--
--  1. market_trusted_actor() : distingue le code serveur (service_role,
--     fonctions SECURITY DEFINER, migrations) d'un appel client PostgREST.
--  2. market_fold() : repli casse + accents pour la recherche du catalogue.
--  3. redact_contact_info() : masquage des coordonnées, réplique EXACTE des
--     motifs de redactContactInfo (@velum/config) — vecteurs partagés rejoués
--     par supabase/tests/features/marketplace_checks.sql.
--  4. market_aliases : pseudonyme aléatoire stable « Collectionneur XXXX »,
--     un par membre, JAMAIS dérivé de l'uuid (non réversible).
--  5. listings : nature (vente / échange / les deux), description et souhaits
--     d'échange expurgés, statuts 'pending_certification' et 'exchanged',
--     publication décidée par le serveur (défaut 'active').
--  6. Le catalogue n'est plus lisible en direct par les autres membres : la
--     policy listings_select_active (0006) est supprimée ; lecture via la RPC
--     market_catalogue() (migration 5/5) qui ne renvoie ni seller_id ni item_id.
-- ============================================================================

-- ── 1. Acteur de confiance ───────────────────────────────────────────────────
-- Vrai pour : le drapeau système des fonctions de confiance (0006), le
-- service_role (Edge Functions), le propriétaire des tables (migrations, seed,
-- fonctions SECURITY DEFINER, actions référentielles en cascade). Faux pour un
-- client PostgREST (rôles anon / authenticated).
create or replace function public.market_trusted_actor()
returns boolean
language sql
stable
as $$
  select public.is_escrow_system_action()
      or current_user not in ('authenticated', 'anon')
$$;

-- Pose le drapeau système pour la suite de la transaction et renvoie l'ancienne
-- valeur ; market_system_end() la restaure. Usage réservé aux fonctions de
-- confiance (jamais exposé aux clients).
create or replace function public.market_system_begin()
returns text
language plpgsql
as $$
declare
  v_prev text := coalesce(current_setting('velum.system_action', true), '');
begin
  perform set_config('velum.system_action', '1', true);
  return v_prev;
end;
$$;

create or replace function public.market_system_end(p_prev text)
returns void
language plpgsql
as $$
begin
  perform set_config('velum.system_action', coalesce(p_prev, ''), true);
end;
$$;

revoke all on function public.market_system_begin() from public, anon, authenticated;
revoke all on function public.market_system_end(text) from public, anon, authenticated;

-- ── 2. Repli casse + accents (recherche insensible) ──────────────────────────
-- unaccent si l'extension est disponible (Supabase, PostgreSQL de CI), sinon
-- translittération des diacritiques français courants.
do $migration$
declare
  v_schema text;
begin
  if exists (select 1 from pg_available_extensions where name = 'unaccent') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      create extension if not exists unaccent with schema extensions;
    else
      create extension if not exists unaccent;
    end if;
  end if;

  select n.nspname into v_schema
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'unaccent';

  if v_schema is not null then
    execute format(
      $fn$
      create or replace function public.market_fold(p_text text)
      returns text
      language sql
      stable
      set search_path = public, %1$I
      as $body$
        select lower(%1$I.unaccent(coalesce(p_text, '')))
      $body$
      $fn$,
      v_schema
    );
  else
    raise notice 'unaccent indisponible — repli par translittération pour market_fold().';
    create or replace function public.market_fold(p_text text)
    returns text
    language sql
    immutable
    as $body$
      select translate(
        replace(replace(lower(coalesce(p_text, '')), 'œ', 'oe'), 'æ', 'ae'),
        'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
        'aaaaaaceeeeiiiinooooouuuuyy'
      )
    $body$;
  end if;
end
$migration$;

-- ── 3. Masquage des coordonnées (anonymat, anti-contournement) ───────────────
-- Réplique EXACTE de redactContactInfo (@velum/config) : mêmes briques, mêmes
-- motifs (texte recopié tel quel), même ordre, mêmes drapeaux ; vecteurs
-- partagés (bloc M1 de supabase/tests/features/marketplace_checks.sql, relu
-- par marketplace.test.ts), sortie identique au caractère près.
-- Différences de moteur neutralisées :
--  - les motifs n'emploient ni `\b`, ni `\w`, ni `\d`, ni `\p{…}` (sens
--    différent d'un moteur à l'autre) : classes explicites ;
--  - `\s` / `\S` JavaScript (blancs Unicode, dont les insécables) sont
--    réécrits à l'emploi en classes explicites (voir `sp` et la boucle) ;
--  - PostgreSQL retient la correspondance la plus LONGUE au point de départ le
--    plus à gauche : les motifs JS sont écrits pour que leur premier succès
--    soit justement celui-là (quantificateurs gloutons, assertions de bord).
-- Pure et idempotente : le jeton ne correspond à aucun motif.
create or replace function public.redact_contact_info(p_text text)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  -- Blancs au sens de `\s` JavaScript, contenu d'une classe [...] :
  -- \t \n \v \f \r, espace, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029,
  -- U+202F, U+205F, U+3000, U+FEFF.
  sp constant text := '\t\n\v\f\r ' || chr(160) || chr(5760) || chr(8192) || '-' || chr(8202)
    || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279);

  -- Briques : mêmes noms (en minuscules) et même texte que dans marketplace.ts.
  letter constant text := 'A-Za-zÀ-ÖØ-öø-ÿĀ-ſ';
  word constant text := letter || '0-9_';
  domain_label constant text := '[' || word || '][' || word || '-]*';
  domain_tld constant text := '(?:com|fr|net|org|eu|be|ch|lu|io|me|info|biz|co|art|shop|store|online)';
  email_dot constant text := '(?:\.+|\s+\.\s+|\s*[(\[](?:dot|point)[)\]]\s*|\s+(?:point|dot)\s+)';
  email_at constant text := '(?:@\s*|\s+@\s+|\s+@(?=(?:' || domain_label || '\.)+' || domain_tld
    || '(?![' || word || ']))|\s*[(\[](?:at|ar{1,2}obase?)[)\]]\s*|\s+ar{1,2}obase?\s+|\s+at\s+(?=['
    || word || '+-]+' || email_dot || '[' || word || ']))';
  email_chunk constant text := '[' || word || '+-]+(?:' || email_dot || '[' || word || '+-]+)*';
  digit_sep constant text := '[\s.,/_\u2010-\u2015-]';
  street_type constant text :=
    '(?:rue|avenue|av\.?|boulevard|bd|chemin|allée|allee|impasse|place|quai|route|cours|chaussée|chaussee|passage|square|faubourg|sentier)';
  street_word constant text := '[' || letter || '''’-]+';

  -- Motifs et drapeaux, dans l'ordre de CONTACT_PATTERNS (commentaires
  -- détaillés côté TypeScript).
  patterns constant text[] := array[
    -- 1. URL explicites (http, https) : tout jusqu'au prochain blanc.
    ['https?://\S+', 'gi'],
    -- 2. E-mails ENTIERS, partie locale comprise, y compris maquillés.
    [email_chunk || email_at || email_chunk, 'gi'],
    -- 3. Adresses « www. » : tout jusqu'au prochain blanc.
    ['(?<![' || word || '])www\.\S+', 'gi'],
    -- 4. Domaines nus, sous-domaines et suffixes à deux lettres compris, chemin compris.
    ['(?:' || domain_label || '\.)+' || domain_tld || '(?:\.[a-z]{2})?(?![' || word || '])(?:/\S*)?', 'gi'],
    -- 5. IBAN, insensible à la casse ; garde : au moins 8 chiffres dans la suite.
    ['(?<![' || word || '])[A-Z]{2}[0-9]{2}(?=(?:[\sA-Z]*[0-9]){8})(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?(?!['
      || word || '])', 'gi'],
    -- 6a. Téléphone international : « + » ou « 00 », indicatif, 8 à 15 chiffres en tout.
    ['(?:\+|(?<![0-9])00)[\s.]?[1-9](?:' || digit_sep || '?\(?[0-9]\)?){7,14}(?![0-9])', 'g'],
    -- 6b. Téléphone national : 0 + chiffre non nul + 8 chiffres ; pas une date jj/mm/aaaa.
    ['(?<![0-9])(?![0-9]{2}[./-][0-9]{2}[./-][0-9]{4})\(?0\)?' || digit_sep || '?[1-9]\)?(?:' || digit_sep
      || '?[0-9]){8}(?![0-9])', 'g'],
    -- 6c. Longue suite de 9 à 15 chiffres d'un seul tenant.
    ['(?<![0-9])[0-9]{9,15}(?![0-9])', 'g'],
    -- 6d. Numéro national sans son 0, groupé par paires.
    ['(?<![0-9])[1-9](?:' || digit_sep || '[0-9]{2}){4}(?!' || digit_sep || '?[0-9])', 'g'],
    -- 7. Pseudonymes de réseaux sociaux (@pseudo) — après les e-mails.
    ['(?<![' || word || '.])@[' || word || '][' || word || '.]*[' || word || ']', 'gi'],
    -- 8. Adresses postales : numéro (bis, ter) + type de voie + nom de 1 à 6 mots.
    ['(?<![' || word || '])[0-9]{1,4}(?:\s?(?:bis|ter))?,?\s+' || street_type || '\s+' || street_word
      || '(?:\s' || street_word || '){0,5}', 'gi']
  ];
  -- Passes au plus (MAX_REDACTION_PASSES) : un masquage peut créer une
  -- frontière de mot qui en révèle un autre au passage suivant ; on répète
  -- jusqu'à stabilité → sortie idempotente par construction.
  max_passes constant integer := 5;
  tok constant text := '[coordonnées masquées]';
  rx text[] := '{}';
  v text := p_text;
  v_before text;
begin
  if v is null then
    return null;
  end if;
  -- `\s` JavaScript : dans une classe (« [\s… ») → ses blancs ; seul → [blancs] ;
  -- `\S` → [^blancs].
  for i in 1 .. array_length(patterns, 1) loop
    rx := rx || replace(replace(replace(patterns[i][1], '[\s', '[' || sp), '\s', '[' || sp || ']'),
                        '\S', '[^' || sp || ']');
  end loop;
  for pass in 1 .. max_passes loop
    v_before := v;
    for i in 1 .. array_length(patterns, 1) loop
      v := regexp_replace(v, rx[i], tok, patterns[i][2]);
    end loop;
    exit when v = v_before;
  end loop;
  return v;
end;
$$;

comment on function public.redact_contact_info(text) is
  'Masque les coordonnées d''un texte libre — réplique exacte de redactContactInfo (@velum/config).';

-- ── 4. Pseudonymes stables et non réversibles ────────────────────────────────
create table public.market_aliases (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  -- « Collectionneur 7F3A » : suffixe ALÉATOIRE (jamais dérivé de l'uuid).
  alias text not null unique check (alias ~ '^Collectionneur [0-9A-F]{4,8}$'),
  created_at timestamptz not null default now()
);

alter table public.market_aliases enable row level security;
revoke all on public.market_aliases from anon, authenticated;
grant select on public.market_aliases to authenticated;
-- Chacun ne lit que SON pseudonyme : la table de correspondance n'est jamais
-- exposée (elle permettrait de relier un pseudonyme à un membre).
create policy "market_aliases_select_own" on public.market_aliases
  for select using (member_id = auth.uid());

-- Pseudonyme d'un membre, créé à la volée si besoin (usage serveur uniquement).
create or replace function public.ensure_market_alias(p_member uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alias text;
  v_try integer := 0;
begin
  select alias into v_alias from public.market_aliases where member_id = p_member;
  if found then
    return v_alias;
  end if;

  loop
    v_try := v_try + 1;
    -- 4 caractères hexadécimaux aléatoires ; 6 puis 8 en cas de collisions
    -- répétées (espace quasi saturé).
    v_alias := 'Collectionneur ' || upper(substr(
      replace(gen_random_uuid()::text, '-', ''), 1,
      case when v_try <= 12 then 4 when v_try <= 24 then 6 else 8 end));
    begin
      insert into public.market_aliases (member_id, alias) values (p_member, v_alias);
      return v_alias;
    exception when unique_violation then
      -- Création concurrente pour le même membre : on relit.
      select alias into v_alias from public.market_aliases where member_id = p_member;
      if found then
        return v_alias;
      end if;
      if v_try >= 40 then
        raise exception 'Pseudonyme impossible à générer' using errcode = 'P0001';
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.ensure_market_alias(uuid) from public, anon, authenticated;

-- Tout nouveau profil reçoit son pseudonyme dès l'inscription.
create or replace function public.profiles_assign_market_alias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_market_alias(new.id);
  return null;
end;
$$;

create trigger profiles_assign_market_alias
  after insert on public.profiles
  for each row execute function public.profiles_assign_market_alias();

-- Rattrapage : profils existants.
do $$
begin
  perform public.ensure_market_alias(p.id) from public.profiles p;
end
$$;

-- Pseudonyme de l'utilisateur courant (affiché « vous apparaissez comme … »).
create or replace function public.my_market_alias()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Session requise' using errcode = 'VL401';
  end if;
  return public.ensure_market_alias(v_uid);
end;
$$;

revoke all on function public.my_market_alias() from public, anon;
grant execute on function public.my_market_alias() to authenticated, service_role;

-- Pseudonyme d'affichage (lecture seule, repli si absent) — usage serveur.
create or replace function public.market_alias_of(p_member uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select alias from public.market_aliases where member_id = p_member),
    'Membre VELUM'
  )
$$;

revoke all on function public.market_alias_of(uuid) from public, anon, authenticated;

-- ── 5. Annonces : nature, textes publics expurgés, nouveaux statuts ─────────
alter table public.listings
  add column kind text not null default 'sale'
    check (kind in ('sale', 'exchange', 'sale_or_exchange')),
  add column description text check (char_length(description) <= 4000),
  add column exchange_wishes text check (char_length(exchange_wishes) <= 1000);

-- Contrainte de statut élargie : 'pending_certification' (certification
-- d'expert exigée et pas encore obtenue — jamais visible au catalogue) et
-- 'exchanged' (objet parti dans un échange conclu).
alter table public.listings drop constraint listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('draft', 'pending_certification', 'active', 'sold', 'exchanged', 'withdrawn'));

-- Le SERVEUR décide de la publication : une annonce créée sans statut est
-- publiée ('active'), ou retenue en 'pending_certification' si une
-- certification est exigée (trigger de la migration 2/5).
alter table public.listings alter column status set default 'active';

create index listings_catalogue_idx on public.listings (status, domain, created_at desc);

-- Textes libres publics : coordonnées masquées à l'écriture, blancs normalisés.
create or replace function public.redact_listing_texts()
returns trigger
language plpgsql
as $$
begin
  new.description := nullif(btrim(public.redact_contact_info(new.description)), '');
  new.exchange_wishes := nullif(btrim(public.redact_contact_info(new.exchange_wishes)), '');
  return new;
end;
$$;

create trigger listings_redact_texts
  before insert or update of description, exchange_wishes on public.listings
  for each row execute function public.redact_listing_texts();

-- Le titre public (copié de l'item privé, 0006) est lui aussi expurgé : un
-- titre d'objet saisi librement ne doit pas faire fuiter de coordonnées.
create or replace function public.set_listing_display()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select public.redact_contact_info(i.title), i.domain into new.title, new.domain
  from public.items i where i.id = new.item_id;
  return new;
end;
$$;

-- ── 6. Fin de la lecture directe du catalogue par les autres membres ────────
-- La policy de 0006 exposait seller_id et item_id de toute annonce active.
drop policy "listings_select_active" on public.listings;

-- ── 7. Notifications in-app des plateformes (usage serveur) ─────────────────
create or replace function public.market_notify(p_member uuid, p_title text, p_body text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (owner_id, title, body)
  select p_member, p_title, p_body
  where p_member is not null
$$;

revoke all on function public.market_notify(uuid, text, text) from public, anon, authenticated;
