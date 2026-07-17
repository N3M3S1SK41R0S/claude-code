-- ==========================================================================
-- VELUM — rôles Storage du module Montres
-- --------------------------------------------------------------------------
-- Aligne item_media.kind sur le type TypeScript MediaRole. Le nom explicite
-- rend la migration idempotente face à un éventuel CHECK historique.
-- ==========================================================================

alter table public.item_media
  drop constraint if exists item_media_kind_check;

alter table public.item_media
  add constraint item_media_kind_check
  check (
    kind in (
      'label',
      'capsule',
      'obverse',
      'reverse',
      'edge',
      'front',
      'back',
      'signature',
      'frame',
      'detail',
      'dial',
      'caseback',
      'movement',
      'clasp'
    )
  ) not valid;

alter table public.item_media
  validate constraint item_media_kind_check;
