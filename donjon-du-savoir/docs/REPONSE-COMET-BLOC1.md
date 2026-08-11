# BLOC 1 POUR COMET — Voix du Donjon du Savoir (plan validé + matière complète)

Comet, ton plan est validé tel quel : **d'abord les 12 voix, puis les 57
répliques du Grand Héraut**. Voici TOUT ce qui te manquait, plus la
solution à ton problème de ZIP.

## Réponse à tes 3 blocages

1. **La matière est ci-dessous** : les 12 prompts Voice Design ET le
   script complet du Héraut (57 répliques, avec identifiant cible et
   intention de jeu).
2. **Tu n'as PAS à faire le ZIP ni à renommer quoi que ce soit.**
   Nouveau protocole : télécharge chaque MP3 tel quel (nom ElevenLabs
   par défaut, doublons « (1) » acceptés) et tiens un JOURNAL au fil de
   l'eau — c'est lui qui fait foi. À la fin, livre le journal en texte :
   l'utilisateur zippe son dossier Téléchargements tel quel, et le
   renommage + l'arborescence `voix/heraut/<id>.mp3` + le manifeste
   seront reconstruits automatiquement côté jeu à partir de ton journal.
3. **Les confirmations de téléchargement** : demande-les par petits lots
   (par exemple toutes les 5 générations), pour ne pas hacher le travail.

## Le journal (OBLIGATOIRE, une ligne par clip)

À chaque téléchargement, note une ligne au format :

```
<n°> | <nom EXACT du fichier téléchargé, tel qu'affiché dans la barre de téléchargements> | <id cible> | heraut
```

Exemple : `3 | ElevenLabs_2026-08-03_Donjon-Heraut (2).mp3 | 232e5b8b | heraut`

Sans ce journal, les fichiers sont inutilisables : il est aussi important
que les audios. Livre-le en bloc de texte à la fin (ou par lots).

## Étape A — Créer les 12 voix (Voice Design, JAMAIS de clonage)

Sur elevenlabs.io → Voices → Create a voice → **Voice Design**. Colle la
description, génère plusieurs propositions, ÉCOUTE, garde la plus
vivante (jamais métallique), enregistre-la sous le nom indiqué.
Rappels absolus : voix 100 % originales, aucune imitation d'une personne
réelle ; ne touche à rien d'autre sur le compte (pas de suppression, pas
d'achat) ; si un quota bloque, ARRÊTE et rapporte où tu en es.

| Nom à donner | Description à coller |
|---|---|
| Donjon-Heraut | Warm French male baritone, theatrical old-time radio showman, medieval town crier energy, playful and knowing, lively pace, never robotic |
| Donjon-Cageot | Young French male voice, bright and boastful boy-scout energy, cracks slightly when unsure, endearing |
| Donjon-Etincelle | Sparkling young French female voice, quick and mischievous, crystal-clear, joyful |
| Donjon-Gobelin | Pinched precise French male voice, fussy bank-clerk tone, relishes numbers, nasal and finicky |
| Donjon-Nebulia | Calm velvety French female alto, dreamy and distant like an observatory at night, warm smile underneath |
| Donjon-Boumbastien | Excitable nasal French male voice, mad-inventor energy, speeds up when thrilled, little bursts of joy |
| Donjon-Duchesse | Impeccable aristocratic French female diction, long satisfied vowels, affectionate condescension |
| Donjon-Flaque | Gravelly jolly French male voice, miniature sea-dog, cascading laughs, salty warmth |
| Donjon-Pelote | Soft slightly quavering elderly French female voice, FULL of mischief, the grandma who always wins at cards |
| Donjon-Hibou | Hushed scholarly French male voice, deliberate little pauses as if turning pages, gentle owl-like ooh sounds |
| Donjon-Kribouille | High-pitched elastic funny French voice, bouncy almost sung sounds, playful alien creature |
| Donjon-Plomberoy | Proud hearty French male baritone, honest craftsman, rolls his shoulders in his voice, generous |

## Étape B — Le Grand Héraut : 57 répliques (voix Donjon-Heraut)

Text to Speech → voix **Donjon-Heraut** → modèle **Eleven v3** (à défaut
Multilingual v2), français. Stability ~35 %, Style ~60 %.
Pour chaque ligne : colle la réplique MOT POUR MOT (une balise comme
`[whispers]` indiquée dans l'intention se place AVANT le texte et ne se
prononce pas). Génère, écoute ; si c'est plat ou robotique, régénère
(2 essais max, garde le meilleur). Télécharge, note la ligne de journal,
passe à la suivante — DANS L'ORDRE du tableau. Les nombres (« +3 »,
« 6 ») se disent en français.

## LE GRAND HÉRAUT (narrateur) — dossier `voix/heraut/` (57 répliques)

| Fichier | Intention (jeu d'acteur) | Réplique à jouer |
|---|---|---|
| `232e5b8b.mp3` | Grandiose, lever de rideau — il ouvre le tournoi du siècle | Oyez, oyez ! Le Donjon du Savoir ouvre ses portes. Essuyez vos pieds sur la culture. |
| `7ae45066.mp3` | Grandiose, lever de rideau — il ouvre le tournoi du siècle | Bienvenue, nobles aventuriers ! Ici, on ne tue pas de dragons : on répond à des questions. C'est plus dangereux. |
| `bfa0aa37.mp3` | Grandiose, lever de rideau — il ouvre le tournoi du siècle | Par ma trompette ! Que les cerveaux s'échauffent, le Donjon vous attend. |
| `c1396fe2.mp3` | Émerveillé, un rien vertigineux | Un tourbillon ! Accrochez votre chapeau, le voyage est inclus dans le prix. |
| `f61ab207.mp3` | Émerveillé, un rien vertigineux | Le tourbillon vous regarde avec appétit. C'est flatteur, d'une certaine façon. |
| `0e7fc66e.mp3` | Curieux, met la pression gentiment | Un carrefour ! Deux chemins, zéro GPS. Le Donjon adore vous voir hésiter. |
| `b4f3f316.mp3` | Curieux, met la pression gentiment | Carrefour en vue. Petit conseil du Héraut : le chemin le plus court n'est jamais gratuit. |
| `f3924a4d.mp3` | Annonce de case, malicieux | Une question ! Le Donjon teste votre esprit. Il est joueur, mais jamais pressé. |
| `d13a4fd0.mp3` | Annonce de case, malicieux | Halte ! Nul ne passe sans faire travailler sa cervelle. |
| `3b4d993b.mp3` | Gourmand, ravi pour le joueur | Case Chance ! Le Donjon est de bonne humeur, profitez-en. |
| `1a23bc03.mp3` | Gourmand, ravi pour le joueur | Fortune sourit ! C'est rare, savourez. |
| `4081ea1f.mp3` | Annonce de case, malicieux | Événement ! Tout le monde sur le pont, même ceux qui dormaient. |
| `987aade4.mp3` | Annonce de case, malicieux | Grand rassemblement ! Le Donjon convoque toutes les cervelles. |
| `a75bad5a.mp3` | Fataliste et drôle | Aïe. Le Donjon a ses humeurs, et là, c'est la mauvaise. |
| `b9a6ce80.mp3` | Fataliste et drôle | Coup dur ! Courage, les légendes naissent dans la boue. |
| `11827ddc.mp3` | Annonce de case, malicieux | Des pièces d'or ! Le Gobelin Comptable en frémit quelque part. |
| `ccb80183.mp3` | Annonce de case, malicieux | Sonnante et trébuchante fortune ! Ramassez, ramassez. |
| `4e40e407.mp3` | Annonce de case, malicieux | Une carte Joker ! Gardez-la précieusement, elle vaut son pesant de malice. |
| `ea8164a7.mp3` | Annonce de case, malicieux | Le Donjon vous offre un Joker. Il attend un merci. |
| `8f4c8859.mp3` | Annonce de case, malicieux | GAMBIT ! Un nombre, des paris, et beaucoup de mauvaise foi. J'adore. |
| `af67821f.mp3` | Annonce de case, malicieux | Place au Gambit ! Les spectateurs deviennent parieurs. |
| `3db2bc57.mp3` | [whispers] Faussement inquiet, suspense | LE TROU NOIR... Même moi, je baisse la voix. La question suprême vous attend. |
| `07bf039d.mp3` | [whispers] Faussement inquiet, suspense | Frissons garantis : voici le Trou Noir. Nul chronomètre, mais quel vertige. |
| `54430d43.mp3` | Annonce de case, malicieux | LE TRÉSOR EST EN VUE ! |
| `9d297e8d.mp3` | Éclatant — il célèbre le joueur, sourire dans la voix | Exact ! Le Donjon applaudit des deux créneaux. |
| `81fe2f68.mp3` | Éclatant — il célèbre le joueur, sourire dans la voix | Bonne réponse. Le Donjon applaudirait des deux mains s'il en avait. |
| `05822e83.mp3` | Éclatant — il célèbre le joueur, sourire dans la voix | Exact. Je n'en attendais pas moins, et j'attendais beaucoup. |
| `c4a47982.mp3` | Éclatant — il célèbre le joueur, sourire dans la voix | C'est juste ! Le comité d'experts que je suis à moi tout seul valide. |
| `bdb402b5.mp3` | Éclatant — il célèbre le joueur, sourire dans la voix | Bonne réponse ! Quelque part, un parchemin verse une larme de joie. |
| `dd502907.mp3` | Éclatant — il célèbre le joueur, sourire dans la voix | Bravo ! Votre cervelle mérite une statue. Petite, mais une statue. |
| `6003736d.mp3` | Éclatant — il célèbre le joueur, sourire dans la voix | Correct ! Même les gargouilles sont impressionnées. |
| `1957adfc.mp3` | Consolant et taquin — jamais moqueur | Raté ! Mais quel panache dans l'erreur. |
| `6d24e7ce.mp3` | Consolant et taquin — jamais moqueur | Raté. Mais dit avec une conviction remarquable, c'est déjà ça. |
| `af632edf.mp3` | Consolant et taquin — jamais moqueur | Non. Réponse incorrecte, aplomb impeccable : moyenne honorable. |
| `7ae25ea4.mp3` | Consolant et taquin — jamais moqueur | Perdu ! Le Donjon efface tout et ne retient que le panache. |
| `b5b52cb0.mp3` | Consolant et taquin — jamais moqueur | Hélas ! Le Donjon note l'audace, à défaut de la réponse. |
| `6df8de51.mp3` | Consolant et taquin — jamais moqueur | Non ! Mais rassurez-vous : ici, on apprend même en se trompant. |
| `ee76f848.mp3` | Consolant et taquin — jamais moqueur | Perdu ! Les plus grands héros ont commencé par se cogner aux murs. |
| `8e483e7c.mp3` | Confidence — il ménage son petit effet | Et maintenant, la minute savante du Héraut : |
| `43a4fa52.mp3` | Confidence — il ménage son petit effet | Approchez, voici la pépite du jour : |
| `285761fd.mp3` | Confidence — il ménage son petit effet | Le saviez-vous ? Le Donjon, lui, le savait : |
| `e175a793.mp3` | [whispers] Chuchoté, façon documentaire animalier | Chut… Observons l'aventurier s'approcher du Trou Noir. Il ne se doute de rien. Enfin si : il y a un panneau. |
| `4fd979f2.mp3` | [whispers] Chuchoté, façon documentaire animalier | Le Trou Noir, milieu hostile s'il en est. L'aventurier avance. La science reste sans voix ; moi, je chuchote. |
| `b63617f8.mp3` | [whispers] Chuchoté, façon documentaire animalier | Notez la démarche assurée de l'espèce. C'est précisément ainsi que commencent les grandes anecdotes. |
| `d8482afb.mp3` | Compatissant, amusé du sort | Le dé a parlé. Le dé est parfois laconique. |
| `84ff920a.mp3` | Compatissant, amusé du sort | Un. C'est un début. Techniquement. |
| `6b63b641.mp3` | Compatissant, amusé du sort | Le dé vous offre un 1. Il précise que c'est pour votre humilité. |
| `97ed0649.mp3` | Stupéfait, admiratif | Trois 6 d'affilée. Je ne dis rien. Je note. |
| `cfc22556.mp3` | Stupéfait, admiratif | Encore un 6. Le dé et vous, on en reparlera. |
| `f904ef2f.mp3` | Ton publicité radio rétro, second degré assumé | La Taverne du Gobelin — certifiée sans dragon depuis mardi. |
| `74fe3093.mp3` | Ton publicité radio rétro, second degré assumé | Les Potions de la Fée Bricole : effets garantis, effets non précisés. |
| `2944c490.mp3` | Ton publicité radio rétro, second degré assumé | Boucliers Groumf & Fils. Solides. Comme l'argument. |
| `19dd99c8.mp3` | Ton publicité radio rétro, second degré assumé | L'Auberge du Trou Noir : personne n'est jamais revenu se plaindre. |
| `49749ee2.mp3` | Ton publicité radio rétro, second degré assumé | Parchemins Merlinouche — l'orthographe est comprise, l'ordre des mots en option. |
| `c49dd46f.mp3` | Ton publicité radio rétro, second degré assumé | Les cours du soir de Maître Hibou : hou hou, mais avec mention. |
| `a1280e86.mp3` | Emphase héroïque, roulement de tambour verbal | Pouvoir activé ! La magie opère, réglementairement. |
| `fb1ed469.mp3` | Emphase héroïque, roulement de tambour verbal | Et hop ! Un pouvoir de moins, un moment de gloire de plus. |

## Livraison du bloc 1

Quand les 57 clips sont téléchargés : livre le **journal complet** et un
mini-rapport (répliques régénérées, difficultés, quota consommé).
L'utilisateur enverra son dossier de téléchargements zippé tel quel —
rien d'autre à faire de ton côté. Les 11 héros (121 répliques) suivront
dans un BLOC 2 après validation du Héraut.
