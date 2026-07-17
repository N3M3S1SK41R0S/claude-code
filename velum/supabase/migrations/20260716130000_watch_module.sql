-- Module Montres de collection (5e module VELUM, décision produit juillet 2026).
-- Ajoute la valeur 'watch' à l'enum velum_domain : les tables items, analyses,
-- valuations, calibration_outcomes… l'acceptent alors sans autre changement.
--
-- Note : depuis PostgreSQL 12, ADD VALUE est autorisé dans une transaction tant
-- que la nouvelle valeur n'y est pas UTILISÉE — cette migration n'insère rien.
alter type velum_domain add value if not exists 'watch';
