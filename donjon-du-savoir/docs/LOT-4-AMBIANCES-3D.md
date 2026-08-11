# Lot 4 — ambiances et effets 3D

Le fond de scène est désormais une cubemap procédurale originale, peinte dans
six canevas de 192 px. Les cinq donjons ont leur palette, leurs lueurs et leur
horizon. Aucune image ni requête supplémentaire n'est nécessaire.

Chaque famille de case déclenche une mise en scène courte autour du pion :
éclats, pièces, cartes, dés, pointes ou vortex. Ces effets sont purement
visuels, limités à trois simultanément et ne créent aucun chronomètre de jeu.

Le rendu mesure sa fluidité hors onglet masqué :

1. sous 24 fps, pixel ratio 1 et ombres dynamiques coupées ;
2. sous 20 fps pendant deux fenêtres supplémentaires, repli immédiat en 2D ;
3. l'état, le tour et les réponses restent inchangés.

Les préférences « mouvements réduits », système ou jeu, continuent de choisir
directement la vue 2D.
