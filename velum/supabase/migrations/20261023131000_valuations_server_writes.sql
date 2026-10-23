-- ============================================================================
-- VELUM — estimations (valuations) écrites par le SERVEUR seul.
-- ----------------------------------------------------------------------------
-- La policy valuations_all_via_item (0001, FOR ALL) laissait le propriétaire
-- insérer, modifier ou supprimer ses estimations via PostgREST. Or la
-- dernière estimation VELUM entre dans le seuil de certification des
-- plateformes (max(prix, estimation) > 500 €) : une estimation forgée basse,
-- ou datée dans le futur, masquait l'estimation réelle et dispensait de
-- certification. Écrivains légitimes : l'Edge Function valuate (client
-- service-role APRÈS contrôle de propriété de l'objet par le client
-- utilisateur) et price-cron (service-role). Le client ne fait que LIRE
-- (historique, courbe de valeur, arbitre), sous la même règle de propriété.
-- La suppression d'un objet efface toujours ses estimations (cascade
-- référentielle, exécutée avec les droits du propriétaire de la table).
-- ============================================================================

drop policy "valuations_all_via_item" on public.valuations;

create policy "valuations_select_via_item" on public.valuations
  for select using (exists (
    select 1 from public.items
    where items.id = valuations.item_id and items.owner_id = auth.uid()
  ));

revoke insert, update, delete, truncate on public.valuations from anon, authenticated;
