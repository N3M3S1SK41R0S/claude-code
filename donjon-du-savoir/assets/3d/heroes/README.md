# Figurines 3D animées

Ce dossier contient les onze héros originaux du **Donjon du Savoir**, dans un
style de figurines de jeu chaleureuses et lisibles. Chaque modèle est un
GLB 2.0 low-poly compressé avec `KHR_draco_mesh_compression`.

- 1 232 à 1 996 triangles par héros ;
- 35 à 44 Ko par fichier ;
- quatre animations nommées `idle`, `walk`, `joy` et `disappointment` ;
- matériaux PBR en aplats de couleur, sans texture externe ;
- aucune marque, franchise ou ressource tierce.

Le sprite PNG historique est affiché immédiatement et reste le repli permanent
si WebGL, glTF ou Draco ne sont pas disponibles. Le décodeur Draco et ses
loaders sont vendorés dans `vendor/` : Three.js r128 sous licence MIT et le
décodeur Draco sous licence Apache 2.0.

Le manifeste détaillé se trouve dans `data/modeles-3d.json`.
