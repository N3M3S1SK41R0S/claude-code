# Prompts ChatGPT (génération d'images) — 3 nouveaux héros

Pour la génération d'images de ChatGPT. Génère **une image par personnage**
(un seul héros à la fois = meilleur rendu). Chaque portrait vient se **superposer
automatiquement** au médaillon SVG déjà en jeu : si l'image manque, le dessin
SVG reste affiché (aucun risque à tester).

## Où déposer les fichiers

Dans `donjon-du-savoir/assets/`, nommés **exactement** :

| Héros | Fichier attendu |
|-------|-----------------|
| 🏴‍☠️ Capitaine Flaque | `portrait-flaque.png` |
| 🧶 Mémé Pelote | `portrait-pelote.png` |
| 🦉 Professeur Hibou | `portrait-hibou.png` |

## Spécifications techniques (identiques pour les 3)

- **Format carré**, 1024×1024 px (512 suffit), **PNG**.
- **Fond transparent** autour du médaillon (idéal pour la superposition).
- Portrait **en buste** (tête + épaules), **centré**, cadré dans un **médaillon
  circulaire** avec un fin **liseré doré** — même échelle pour les 3 (même
  taille de tête) afin qu'ils s'accordent avec les 6 compagnons existants.
- **Aucun texte, aucun logo, aucune signature** sur l'image.
- Personnages **100 % originaux et bienveillants** : pas de personne réelle,
  aucun personnage de marque, de film ou de licence.

## Style maison (à coller en tête de chaque prompt)

> Illustration de mascotte pour un jeu de plateau familial médiéval-fantaisie.
> Style : cartoon plat et chaleureux façon livre d'enfants, contours doux,
> aplats de couleur, légères ombres, ambiance parchemin de donjon. Portrait en
> buste centré, dans un médaillon circulaire au fin liseré doré, fond
> transparent avec un léger halo radial coloré. Bienveillant, expressif, tout
> public. Pas de texte ni de logo.

---

## 1) 🏴‍☠️ Capitaine Flaque — `portrait-flaque.png`

> [Style maison ci-dessus] Un joyeux **corsaire d'eau douce**, gentil et
> espiègle : **bandana rouge** noué sur la tête, **cache-œil** sur l'œil
> gauche, large **sourire malicieux**, joues rondes, petite barbe naissante.
> Autour du médaillon, quelques **éclaboussures d'eau turquoise** et une petite
> flaque qui clapote. **Couleur dominante turquoise (#2f9e8f)**. Air bon enfant,
> aventurier de bassine, pas du tout menaçant.

## 2) 🧶 Mémé Pelote — `portrait-pelote.png`

> [Style maison ci-dessus] Une adorable **mamie tricoteuse** de sortilèges :
> **chignon de cheveux gris**, **lunettes rondes**, joues roses, **sourire
> tendre**, châle tricoté sur les épaules. Elle tient une **pelote de laine
> rose** traversée de deux **aiguilles à tricoter**. **Couleur dominante rose
> laine (#d47ba6)**. Air doux et rassurant, avec une étincelle farceuse dans
> le regard.

## 3) 🦉 Professeur Hibou — `portrait-hibou.png`

> [Style maison ci-dessus] Un **hibou savant** et sympathique, bibliothécaire
> un peu myope : **plumage brun-beige**, **grosses lunettes rondes**, deux
> **aigrettes** (touffes de plumes) dressées sur la tête, petit **nœud
> papillon** ou col universitaire, il tient un **petit livre** sous l'aile.
> **Couleur dominante violet-nuit (#7a6ad0)**. Air studieux, curieux et
> bienveillant.

---

### Astuce cohérence

Si tu veux qu'ils collent parfaitement aux 6 déjà en jeu (Sire Cageot, Dame
Étincelle, Gobelin Comptable, Nébulia, Boumbastien, La Duchesse Anecdote),
ajoute à la fin de chaque prompt : « même style, même cadrage et même liseré
doré que cette série de portraits-médaillons ».
