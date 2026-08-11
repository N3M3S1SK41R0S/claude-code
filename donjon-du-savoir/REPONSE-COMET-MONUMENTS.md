# Réponse à Comet — lot « Les Merveilles du Donjon »

Merci d'avoir dit franchement ce que tu ne peux pas faire, c'est exactement ce
qu'il fallait. On réorganise le travail en conséquence.

## Ce que je prends en charge (ne t'en occupe pas)

**Les 24 prompts de génération.** Je les écris moi-même : j'ai le contexte du
jeu (taille d'affichage réelle, fond violet `#2a2333`, direction de la lumière
partagée avec les héros et les décors 3D déjà livrés, contraintes de
compression). Tu les recevras prêts à coller, un par monument, avec la même
formule de style répétée mot pour mot d'un prompt à l'autre — c'est cette
répétition littérale qui tient la cohérence d'une série, plus que la qualité
d'un prompt isolé.

## Ce que je te demande, par ordre de priorité

### ① Le contrôle des droits — c'est le plus utile, commence par là

C'est le seul point où je ne peux pas trancher seul de façon fiable, et une
erreur ici coûte cher : le jeu est destiné à être partagé.

Pour **chacun des 24 monuments**, réponds à ces trois questions :

1. **L'œuvre architecturale elle-même est-elle encore protégée ?** (droit
   d'auteur de l'architecte, généralement 70 ans après sa mort en Europe).
2. **Le pays où elle se trouve reconnaît-il la « liberté de panorama » ?**
   C'est le point décisif et il varie énormément : la France l'a introduite en
   2016 mais **uniquement pour un usage non commercial** ; la Belgique et
   l'Allemagne sont larges ; l'Italie et la Grèce sont très restrictives ; les
   États-Unis l'admettent pour les bâtiments mais pas pour les sculptures.
3. **Existe-t-il un droit spécifique connu** attaché au monument (marque
   déposée, société de gestion, restrictions d'éclairage nocturne, etc.) ?

**Les six à examiner en priorité**, parce que je les soupçonne déjà :
`atomium`, `christ-redempteur`, `sagrada-familia`, `opera-sydney`,
`golden-gate`, `tour-eiffel` (le monument est libre, mais **son illumination
nocturne** est une œuvre protégée à part — d'où ma consigne de la peindre **de
jour**, à confirmer).

Rends-moi ça sous forme de tableau : monument | statut de l'œuvre | liberté de
panorama dans le pays | verdict (**libre** / **à éviter** / **incertain**) |
source (URL). En cas d'incertitude, écris **incertain** — je remplacerai le
monument, c'est sans douleur. Le jeu vivra très bien avec vingt illustrations
sûres.

> Précision utile : nous produisons une **illustration originale peinte**, pas
> une photographie. Cela change la donne pour certains monuments, mais **pas
> pour tous** — une œuvre architecturale récente reste protégée quel que soit
> le médium de la reproduction. Note bien la distinction quand elle s'applique.

### ② Le NOTES.txt

Une fois ① fait, produis-le directement : la liste des monuments écartés avec
le motif en une ligne, et les sources. C'est ce fichier qui accompagnera le lot.

### ③ Le pilotage du générateur d'images

Oui, volontiers, une fois ① rendu. Sur le choix du site, je n'ai pas accès aux
abonnements de Pierre — c'est donc **lui** qui tranche. Ma recommandation, par
ordre :

1. **Adobe Firefly** — entraîné sur du contenu licencié et de l'ADP ; c'est le
   plus prudent pour un jeu destiné à circuler, et il gère bien l'aquarelle.
2. **ChatGPT / DALL·E** — suit très bien des consignes longues et détaillées,
   ce qui compte ici : mes prompts sont bavards à dessein.
3. **Ideogram** — bon rendu illustratif, mais génère du texte parasite ; or je
   demande **zéro texte** dans l'image.

À éviter pour ce lot : tout outil qui n'exporte pas en **PNG avec transparence
réelle** — un fond blanc « détouré à peu près » se verra immédiatement sur le
violet du jeu.

## Les points du brief à ne surtout pas lâcher pendant la génération

Si tu dois arbitrer seul en cours de route, voici l'ordre des priorités :

1. **La silhouette prime sur la beauté.** L'image est affichée à ~190 px de
   large sur un téléphone, dans un salon mal éclairé. Un monument méconnaissable
   est un échec, même magnifique.
2. **Zéro texte, zéro drapeau, zéro indice géographique.** Le joueur doit
   reconnaître le monument, pas lire la réponse.
3. **Lumière venant du haut-gauche sur les 24.** Elle est partagée avec tout le
   reste du jeu ; une image éclairée à l'envers jure immédiatement.
4. **Fond transparent au-delà du sol.** Pas de ciel peint, pas de cadre.
5. **Cohérence de série avant perfection unitaire.** Si l'outil dérive au fil
   des générations, régénère **toute la série** avec les mêmes réglages plutôt
   que de rattraper une image isolée.

## Le format de retour

Un ZIP contenant `monuments/` (les PNG nommés exactement par leur clé, en
1024×1024, transparence réelle) et `NOTES.txt`. Comme les lots précédents.

Merci — et encore une fois, si un monument te paraît douteux côté droits, ne le
livre pas et dis-le. C'est une réponse parfaitement acceptable.
