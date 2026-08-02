# MISSION VOIX v1 — « Les voix vivantes du Donjon »
*(pour une IA de génération de voix — ElevenLabs ou équivalent. Objectif :
que plus PERSONNE ne devine qu'une machine parle. Des personnalités, pas
des synthèses.)*

## 0. Règles absolues

- **Voix 100 % ORIGINALES.** Aucune imitation d'une personne réelle,
  d'un acteur, d'un personnage sous licence. On crée des caractères.
- **Français naturel et vivant** : liaisons justes, respirations aux
  virgules, fins de phrases habitées. JAMAIS de débit saccadé ni de
  monotonie « répondeur ».
- **Jouer, pas lire.** Chaque réplique du script porte son intention
  (contexte dans l'inventaire) : une annonce de victoire PÉTILLE, un
  commentaire de Trou Noir se CHUCHOTE comme un documentaire animalier.
- Public familial : chaleureux, malicieux, jamais moqueur envers les
  enfants.

## 1. Le scénario technique (déjà en place dans le jeu)

Le moteur joue le clip MP3 d'une réplique s'il existe, sinon il retombe
sur la synthèse — livraison partielle possible, rien ne casse jamais.
**Chaque fichier doit porter EXACTEMENT le nom indiqué dans
`REPLIQUES-A-ENREGISTRER.md`** (identifiant calculé sur le texte).

Spécifications : **MP3, 44,1 kHz, MONO, ~64 kbps, -16 LUFS**, aucun
fond sonore, silences < 150 ms en tête et queue de fichier.
Livraison : ZIP avec l'arborescence `voix/<perso>/<id>.mp3`.

## 2. LE CASTING (12 voix, toutes différentes)

### 🎺 LE GRAND HÉRAUT — la voix du jeu (PRIORITÉ ABSOLUE, 57 répliques)
Baryton chaleureux de bonimenteur de radio-théâtre. Emphase médiévale
assumée, l'œil qui frise : il ANNONCE tout comme si c'était le tournoi
du siècle, avec un second degré pince-sans-rire à la commentateur
sportif qui s'amuse. Tempo vif, jamais précipité. Il sait aussi
chuchoter (ses « documentaires » du Trou Noir) et s'émerveiller.

### Les 11 héros (11 répliques chacun)
- **Cageot, chevalier en carton** : jeune voix claire et bravache, un
  enthousiasme de scout qui se croit invincible ; craque un peu dans
  les aigus quand il doute.
- **Étincelle, magicienne pétillante** : voix féminine vive et
  cristalline, débit espiègle, on ENTEND les étincelles.
- **Le Gobelin Comptable** : voix pincée et précise de guichetier
  tatillon, roule légèrement les chiffres avec gourmandise.
- **Nébulia, sorcière cosmique** : alto posé et velouté, un calme
  d'observatoire, chaque mot semble venir de loin — mais souriante.
- **Boumbastien, inventeur farfelu** : voix nasillarde surexcitée qui
  accélère quand il s'emballe, petites explosions de joie.
- **La Duchesse érudite** : diction aristocratique impeccable,
  condescendance AFFECTUEUSE, voyelles longues et satisfaites.
- **Flaque, corsaire des flaques** : voix rocailleuse et joyeuse de
  loup de mer miniature, rires en cascade.
- **Pelote, mamie tricoteuse** : voix douce et chevrotante PLEINE de
  malice — la grand-mère qui gagne toujours aux cartes.
- **Le Hibou bibliothécaire** : voix feutrée et docte, marque de
  petites pauses… comme s'il tournait des pages, houlule
  discrètement ses « oh » et ses « hou ».
- **Kribouille, créature des étoiles** : voix haut perchée, élastique
  et rigolote, sons rebondissants, presque chantée.
- **Plomberoy, plombier-chevalier** : baryton d'artisan fier, franc et
  généreux, roule des mécaniques mais bon comme le pain.

## 3. Le script

Le fichier `REPLIQUES-A-ENREGISTRER.md` (joint) liste les 178 répliques
avec leur nom de fichier exact et leur contexte de jeu. Les répliques
personnalisées (elles contiennent le prénom d'un joueur) restent en
synthèse : elles ne sont PAS dans le script.

## 4. Processus de validation (le procédé qui marche)

1. **Livrer D'ABORD le Héraut complet** (57 fichiers) : c'est lui qu'on
   entend à chaque tour, c'est lui qui fait le jeu.
2. Validation sur pièce (fluidité, chaleur, zéro robot).
3. Puis les 11 héros, par lots ou d'un coup.
4. (Un lot 2 « PNJ » suivra : Gérard, Zébulon, la Fée Bricole… —
   inventaire en préparation.)

Critère d'acceptation : on fait écouter trois répliques à quelqu'un qui
ne connaît pas le projet ; s'il demande « c'est quel comédien ? »,
c'est gagné. S'il dit « c'est une IA ? », on recommence.
