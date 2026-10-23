# Tests SQL par fonctionnalité

Chaque fichier `*.sql` de ce dossier est exécuté automatiquement par
`supabase/tests/run-local.sh`, **après** les migrations, le seed et
`rls_checks.sql`, dans l'ordre alphabétique. Convention : un fichier par
chantier (`marketplace_checks.sql`, `wishlist_checks.sql`…), blocs `do $$`
qui lèvent une exception si l'attendu n'est pas respecté, et une dernière
ligne `select '<CHANTIER> CHECKS PASSED';`.

Les fichiers doivent être rejouables sur une base fraîche et indépendants
les uns des autres (créer leurs propres utilisateurs de test).
