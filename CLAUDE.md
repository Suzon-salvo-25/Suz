# Carnet de Forme — mémoire du projet

Application de suivi de perte de poids, en français, pour une seule
utilisatrice. Tout tient dans **un fichier autonome**, `perte-de-poids.html` :
pas de dépendance, pas d'étape de compilation, pas de serveur.

Le dépôt contient aussi `index.html`, un planning de marathon Marvel sans
rapport. **Ne pas y toucher.**

## Où ça vit

| Quoi | Où |
|---|---|
| Code | `perte-de-poids.html`, branche `claude/programme-perte-poids-u5p9gy` |
| Application en ligne | https://claude.ai/artifact/3LM1PhEuLuXapTZoGMUeyJ |
| Harnais de test | `outils/verifie.mjs` |
| Fiches d'aliments, par domaine | `donnees/aliments/*.json` |
| Planche d'autocollants source | `images/planche-autocollants.webp` |
| Fusion et contrôles | `outils/fusionne-marques.mjs` |
| Imports en masse | `outils/importe-ciqual.mjs`, `outils/importe-openfoodfacts.mjs` |

## Publier une nouvelle version

L'artefact publié est le fichier **privé des balises d'enveloppe**. Le
squelette (`<!doctype>`, `<html>`, `<head>`, `<body>`) est ajouté par la
plateforme, il ne doit donc pas figurer dans ce qui est publié.

```bash
python3 - <<'PY'
import io
s = io.open('perte-de-poids.html', encoding='utf-8').read()
a = s.index('<!-- ARTIFACT-START -->') + len('<!-- ARTIFACT-START -->')
b = s.index('<!-- ARTIFACT-END -->')
out = '\n'.join(l for l in s[a:b].split('\n')
                if l.strip() not in ('</head>', '<body>')).strip() + '\n'
io.open('/tmp/carnet-de-forme.html', 'w', encoding='utf-8').write(out)
PY
```

Puis publier ce fichier avec l'outil Artifact, **en passant l'URL ci-dessus**
pour mettre à jour la page existante au lieu d'en créer une nouvelle. La lire
d'abord (`action: "read"`) est obligatoire avant toute republication depuis
une conversation qui ne l'a pas publiée.

Capacités déclarées, à reconduire à chaque publication :
`{"db": {}, "downloads": true, "sample": {}}`

## Architecture

Un seul module anonyme. Dans l'ordre : données, stockage, calculs, rendus,
événements, démarrage.

**Données en dur** : `ALIMENTS` (3 332 entrées `[nom, kcal, prot, gluc, lip,
catégorie, portion_g, libellé]` pour 100 g) et `SPORTS` (`[nom, MET,
catégorie, type?]`, le type valant `course`, `marche`, `velo` ou `nage` pour
les disciplines à distance).

Les 379 premières entrées sont tenues à la main. Les suivantes vivent dans
`donnees/aliments/*.json`, un fichier par domaine, et sont injectées entre
les deux marqueurs `Marques — complément de recherche (généré)` et
`fin du complément de recherche`. **Ne pas éditer ce bloc à la main** : il
est réécrit à chaque fusion. Corriger le JSON, puis relancer.

```bash
node outils/fusionne-marques.mjs            # contrôle et rapport
node outils/fusionne-marques.mjs --injecte  # puis réécriture de la base
```

Les fiches tenues à la main passent avant les imports en masse et gardent
la place en cas de doublon : elles portent la vraie portion, « 1 œuf »
plutôt que 100 g.

**Projection.** L'onglet Mon poids porte une carte « D'ici le … » qui trace
trois avenirs jusqu'à la date visée du profil (`profil.fin`, par défaut le
8 avril) : ce qu'il faut tenir pour arriver à l'heure, où mène le rythme
réellement observé, et le rythme visé des réglages. Seule la deuxième est une
mesure, les autres sont des intentions.

**« Où j'en suis » doit passer par ses points.** Une seule fonction,
`serieMesuree()`, décide de ce qu'on affiche comme poids réel, et toute la
page la lit : la courbe d'évolution, celle de la projection, le parcours et
la carte de projection. Sous quatre pesées ou moins d'une semaine d'écart,
elle relie les pesées elles-mêmes ; au-delà elle lisse sur sept jours, et la
légende dit alors qu'elle lisse. Avant cette correction, la courbe traçait la
moyenne dès la deuxième pesée : elle affichait 77,1 kg quand la pesée du jour
disait 76,9, sans rien expliquer. Elle partait en plus du deuxième point, si
bien qu'avec deux pesées il n'y avait aucun trait, juste des points.

**Une pente ne se prolonge jamais au-delà de l'objectif.** Prolongée
bêtement, une bonne pente annonçait 49,9 kg en avril pour un objectif à 66 :
faux, et malsain à afficher dans une application de perte de poids. La
projection est bornée à l'objectif, et ce qui est annoncé devient la *date*
à laquelle il tombe. Même prudence sur les messages : sur une pente presque
plate, le retard calculé part à des années, on le dit au lieu d'afficher un
nombre de jours absurde.

**Corriger, pas supprimer et refaire.** Chaque ligne de repas porte un bouton
« Modifier » qui ouvre un formulaire à sa place : nom, calories, protéines,
glucides, lipides. Quand le nom correspond à un aliment de `ALIMENTS`, un
champ quantité apparaît et recalcule les quatre valeurs. C'est pour cela que
les lignes gardent `gr`, leur quantité en grammes. Les valeurs en cours de
saisie vivent dans l'objet `edition`, **jamais dans le DOM seul** : une
rediffusion du serveur redessine la liste à tout moment, et des champs non
sauvegardés seraient perdus. Une modification à la main retire l'étiquette
« Estimé » : ce ne sont plus les chiffres de Claude.

**Les valeurs trouvées par Claude sont modifiables.** La saisie libre porte
ses propres champs de macronutriments, et `libreCalcul()` les lit. Avant, les
macros venaient d'une fiche figée, retrouvée par comparaison du nom :
renommer l'aliment ou corriger une valeur faisait silencieusement retomber la
composition à zéro.

**Modèle** : `profil/moi` et un document par jour, `jours/AAAA-MM-JJ`,
contenant poids, heure, tour de taille, eau, repas et séances. Le profil
porte aussi `debut` et `fin`, les deux bornes de la trajectoire.

**Stockage** : capacité `db` quand elle est là, `localStorage` **toujours**,
en parallèle. Le mode est affiché en bas de page.

## Pièges déjà payés — ne pas les réintroduire

1. **Les documents du serveur sont gelés.** Écrire dans un objet issu d'un
   instantané lève `object is not extensible` et interrompt l'action en
   silence. Tout passe par `copieLibre()` avant d'entrer dans l'état.
2. **Un instantané ne doit jamais écraser une saisie en vol.** Compteurs
   `enEcriture[date]` et `enEcritureProfil`, plus une fenêtre de quatre
   secondes après la dernière frappe (`profilEdite`).
3. **Le clavier français produit une virgule décimale**, que
   `input[type=number]` refuse en renvoyant une chaîne vide. Tous les champs
   décimaux sont en `type="text"`, lus par `nombre()`.
4. **`[hidden]` doit être forcé en CSS.** Sans la règle, tout élément ayant un
   `display` explicite reste visible.
5. **Les caractères typographiques ne sont pas centrés** dans leur cadratin.
   Les icônes sont des SVG dessinés.
6. **Une exception non rattrapée laisse des boutons inertes sans rien dire.**
   `signaleErreur()` affiche une bannière, `protege()` enveloppe les
   gestionnaires sensibles.

## Règles de contenu

- **Ne jamais inventer une valeur nutritionnelle de marque.** Sourcer, ou
  omettre. Contrôle systématique : les calories doivent être proches de
  4×protéines + 4×glucides + 9×lipides, à 20 % près, sauf alcool.
  `outils/fusionne-marques.mjs` applique ce contrôle et refuse le reste ;
  il a déjà rattrapé une inversion kJ/kcal et deux protéines aberrantes.
  Pour l'alcool, l'éthanol apporte 7 kcal/g sans figurer dans les macros :
  les fiches portent `"alcool": true` et sont jugées sur les grammes
  d'alcool que l'écart implique.
- **Le générique vient de Ciqual, la marque vient de l'étiquette.** La table
  de l'Anses couvre les aliments sans marque, cuissons comprises ; les
  produits d'enseigne n'y sont pas et relèvent d'Open Food Facts.
- **Les plats maison se calculent depuis leurs ingrédients**, déjà présents
  dans la base, jamais au jugé.
- Étiquettes : Maison, Marque, Industriel, Générique, Estimé. La dernière est
  réservée aux fiches obtenues via la capacité `sample`.
- Repères retenus : 1,6 g de protéines par kg du poids visé, lipides entre
  20 et 40 % des calories, 7 700 kcal par kilogramme de masse grasse,
  Mifflin-St Jeor pour le métabolisme, équations de l'ACSM pour la course et
  la marche.
- Le niveau d'activité du profil **exclut** les séances de sport, qui
  s'ajoutent à l'objectif du jour.

## Style

Interface en français, tutoiement. Pas de tiret cadratin. Les messages disent
quoi faire, pas seulement ce qui cloche.

**Aucun émoji dans l'interface.** Ni en tête d'alerte, ni sur les onglets, ni
devant les repas. Ils faisaient cheap à côté des aquarelles, qui sont les
seules images de la page. Les seuls signes qui restent sont fonctionnels :
les chevrons de navigation et la croix de suppression.

Direction visuelle : **un carnet de papier**. Les aquarelles sont la seule
chose forte de la page ; tout le reste se tait. Papier chaud, filets d'un
pixel, ombres à peine posées, aucun aplat de couleur qui vienne concurrencer
les dessins. On doit avoir envie d'y passer du temps : c'est le critère qui
tranche entre deux options.

Une version précédente était éditoriale et dure, capitales Anton massives,
bordures de 2 px presque noires, biseaux en `clip-path`, bandes saturées
pleine largeur. Des aquarelles délicates collées sur une affiche brutaliste :
les deux se bagarraient. Ne pas y revenir.

**La couleur revient par trois endroits, jamais par de grandes zones** : le
lavis d'orange derrière le titre, les taches teintées sous les dessins des
en-têtes, et les barres du bilan. L'orange domine, et le texte posé dessus
est toujours l'encre brune.

**Les formes ne sont pas géométriques.** Les rayons à quatre valeurs
(`--r-lg: 28px 22px 30px 24px`) donnent des bords peints plutôt que des
rectangles arrondis. Sous les dessins, la pastille est une tache
(`border-radius: 58% 42% 47% 53% / 52% 46% 54% 48%`), déclinée par
`:nth-of-type` pour qu'aucune carte ne répète la précédente. En revanche les
boutons restent des pilules franches : un rayon dissymétrique sur un bouton
ne fait pas peint, il fait raté.

| Rôle | Clair | Sombre |
|---|---|---|
| Papier, carte, panneau | `#fff4e6` / `#fffdfa` / `#ffe6d0` | `#2b1a12` / `#38241a` / `#452e21` |
| Encre, douce, pâle | `#3d1f14` / `#7d5442` / `#8a6350` | `#fff1e4` / `#d6b19a` / `#b08d75` |
| Filet | `#f5d3b4` | `#5c3c2a` |
| Orange d'accent (`--peche`) | `#ff8a3c` | `#e2762c` |
| Rose poudré, lavande | `#ffb0ca` / `#d3bff0` | `#d47a9c` / `#9a82c4` |
| Glucides (`--orange`) | `#ff9a4a` | `#ffb070` |
| Lipides (`--aqua`) | `#e8337f` | `#ff3d90` |
| Protéines (`--blue`) | `#6a3d8f` | `#bfa8e8` |
| États ok / limite / hors cible | `#0e8a5f` / `#9c6000` / `#7e0512` | `#3fd69b` / `#ffc24d` / `#f4566b` |

Palette validée pour les déficiences de la vision des couleurs : simulation
protanopie, deutéranopie, tritanopie, écart CIEDE2000 ≥ 14 entre chaque paire
de macronutriments dans les deux thèmes, plus les contrastes de texte.
**Ne pas changer sans revalider** : `python3 outils/valide-palette.py` refait
la mesure, mettre à jour les valeurs qu'il teste en même temps que le CSS.
L'encre pâle est à `#8a6350` et pas plus claire : c'est le seuil qui lui fait
passer 4,5 sur le papier.

Les tokens gardent leurs anciens noms (`--blue`, `--aqua`, `--violet`) parce
que le JavaScript les référence pour les macronutriments : les renommer
casserait le bilan. Leur rôle est celui du tableau, pas celui du nom.

**Piège de cascade, déjà payé.** Le CSS de base porte
`.card.violet > header { background: var(--violet) }` et
`.tab[data-c="aqua"][aria-selected="true"]`, plus spécifiques que
`.card > header` et `.tab[aria-selected="true"]`. Une nouvelle couche qui se
contente de la règle courte ne gagne pas : les aplats saturés reviennent par
la cascade. Il faut neutraliser à spécificité égale, en listant les classes.

**Illustrations.** Vingt-trois motifs découpés dans la planche
d'autocollants aquarelle de Suzon, qui lui appartient. **Source de
référence : `images/planche-autocollants.webp`, 1125 × 2000.** Une première version avait été
découpée dans un aperçu à 232 × 405 : les motifs y faisaient 40 à 90 px et
rendaient flou. Si la planche doit être redécoupée, partir de la haute
résolution, jamais d'un aperçu.

Ils sont détourés du fond blanc, exportés en WebP à transparence et
**embarqués en base64** dans le CSS : le fichier doit rester autonome, donc
jamais d'image externe. Chaque motif est déclaré une seule fois, dans une
classe `.st-<nom>`, et posé par `<span class="illu st-<nom>"
aria-hidden="true">`. Tous en `aria-hidden` : ils décorent, ils n'informent
pas.

Chaque en-tête de carte en porte un, distinct ; cinq états vides en portent
un aussi ; le bandeau a le soleil et l'étoile de mer, qui flottent doucement
(animation coupée sous `prefers-reduced-motion`). **Aucun motif déclaré sans
emploi**, et un contrôle au montage le vérifie. La bouteille de soda de
marque a été écartée : elle n'a pas sa place dans un carnet de perte de
poids.

Budget d'export : 210 px de côté pour les motifs d'en-tête, 420 px pour le
soleil et l'étoile du bandeau, seuls affichés en grand. Ce sont les deux
seuls qui méritent le poids. L'ensemble pèse 238 ko de WebP, soit 319 ko une
fois en base64.

Le découpage est reproductible : masque du fond par « clair et peu saturé »
puis remplissage depuis les bords, de sorte que les blancs intérieurs d'un
dessin (reflets, pulpe) restent opaques ; étiquetage des composantes
connexes. Deux corrections tiennent à la planche elle-même : la tête de la
tortue se détache du corps et doit être recollée ; la pêche touche les
fraises et se sépare par deux pixels d'érosion. **L'érosion laisse des
éclats de quelques pixels** : les filtrer avant de nommer les morceaux,
sinon le troisième n'a pas de nom.

Typographie : **Fraunces** (display, variable, axes `opsz`, `SOFT` et `WONK`
réglés pour une serif ronde et un peu bancale) et **Figtree** (texte et
étiquettes). Plus de fonte à chasse fixe : elle faisait technique. Les
chiffres s'alignent par `font-variant-numeric: tabular-nums`. Tout token
de couleur est défini sur `:root` nu, puis redéfini sous
`@media (prefers-color-scheme: dark)` avec la garde
`:root:not([data-theme="light"])` et sous `:root[data-theme="dark"]`.

Le lavis derrière le titre déborde du conteneur par un `inset` négatif :
**il ne peut pas dépasser 18 px**, la gouttière de `.wrap`, sinon la page
déborde d'autant sur mobile. Le harnais vérifie qu'aucune largeur ne dépasse
la fenêtre, à 390 et 1000 px, et c'est lui qui a attrapé les 8 px de trop.

## Vérifier avant de publier

```bash
node -e "new Function(require('fs').readFileSync('perte-de-poids.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1])"
node outils/verifie.mjs
```

Le harnais simule un serveur **gelé, lent et bavard**, celui qui a révélé la
plupart des bugs ci-dessus. Un test qui passe sans lui ne prouve rien : les
trois défauts les plus coûteux n'apparaissaient que sur la version publiée.

## L'accès au web, et ce qu'on fait quand il manque

Ce qui a coûté le plus cher jusqu'ici n'est pas la recherche, c'est son
accès. Deux limites à connaître avant de lancer quoi que ce soit :

- **Le budget `WebSearch` est compté par session** (200 appels) et **partagé
  par tous les agents**. Huit agents lancés ensemble l'épuisent en quelques
  minutes. Prévoir une session neuve, et lancer moins d'agents à la fois.
- **La politique d'egress peut bloquer les sources.** Lors de la session du
  21 septembre, `openfoodfacts.org`, `ciqual.anses.fr`, `data.gouv.fr` et
  les sites d'enseignes répondaient tous 403 au CONNECT. Vérifier d'abord :
  `curl -sS "$HTTPS_PROXY/__agentproxy/status"`.

**GitHub et les registres de paquets, eux, répondent.** C'est la porte de
sortie : la table Ciqual y est publiée convertie en JSON, et c'est ainsi
que les 2 837 aliments génériques sont entrés sans toucher au web.

```bash
git clone --depth 1 https://github.com/LaurentPortefaix/waistline-ciqual
node outils/importe-ciqual.mjs waistline-ciqual/waistline_ciqual.json
```

Un import en masse ne court-circuite aucun contrôle : il écrit un JSON de
plus dans `donnees/aliments`, qui repasse par la fusion comme les autres.

## Reste à faire

**Les produits d'enseigne : Carrefour, Lidl et les autres.** C'est la
demande explicite de Suzon, et c'est le seul manque important qui reste.
Ces produits ne sont pas dans Ciqual, qui ne connaît pas les marques. Ils
sont dans Open Food Facts, dont l'export complet se télécharge sur
https://world.openfoodfacts.org/data. `outils/importe-openfoodfacts.mjs`
est écrit et attend ce fichier :

```bash
node outils/importe-openfoodfacts.mjs en.openfoodfacts.org.products.csv.gz \
     --marques "Carrefour,Lidl" --max 400
```

Il filtre sur la France, exige les quatre macros, applique Atwater, et
garde les plus scannés d'abord, un catalogue d'enseigne comptant des
milliers de références dont on ne mange pas les milliers. **Il n'a jamais
tourné sur un vrai export** : son entête et son classement des catégories
sont à vérifier au premier passage.

**Domaines de marques restés incomplets**, faute de budget de recherche :
Lesieur et Bénédicta en entier, les sauces asiatiques, Domino's, Pizza Hut,
Starbucks, O'Tacos, les viennoiseries surgelées, Wasa et les biscottes, les
biscuits apéritifs (Belin, Tuc, Curly, Apéricube), les fruits secs salés,
olives et cornichons. Un import Open Food Facts bien filtré en couvrirait
la plus grande partie d'un coup, et plus sûrement qu'une recherche.

**Points signalés, non tranchés** : la crème de cassis porte des valeurs
pour 100 g et non 100 ml, ce qui la sous-estime d'environ 10 % ; quatre
portions de pain de mie sont à 30 g par défaut et méritent vérification ;
l'œuf au plat avec matière grasse vient de l'édition Ciqual 2020, l'Anses
l'ayant retiré en 2025.
