# Côté Sud — mémoire du projet

Application de suivi de perte de poids, en français, pour une seule
utilisatrice. Elle s'appelait « Carnet de Forme », que Suzon trouvait
minable. Après un passage par « La Guerre du Gras », elle a tranché pour
**Côté Sud** : elle voulait un nom qui ne parle pas de régime du tout, juste
un nom qui a du style. **Ne pas y ramener de vocabulaire de poids, de gras
ou de calories.** Le sous-titre reste « Le carnet de Suzon ». Tout tient dans **un fichier autonome**, `perte-de-poids.html` :
pas de dépendance, pas d'étape de compilation, pas de serveur.

Le dépôt contient aussi `index.html`, un planning de marathon Marvel sans
rapport. **Ne pas y toucher.**

## Où ça vit

| Quoi | Où |
|---|---|
| Code | `perte-de-poids.html`, branche `claude/programme-perte-poids-u5p9gy` |
| Application en ligne | https://claude.ai/artifact/3LM1PhEuLuXapTZoGMUeyJ |
| Harnais de test | `outils/verifie.mjs`, `outils/verifie-edition.mjs`, `outils/verifie-plats.mjs`, `outils/verifie-muscu.mjs` |
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
« Modifier » qui ouvre un formulaire à sa place : nom, repas, calories,
protéines, glucides, lipides. Le choix de repas déplace la ligne d'une liste
à l'autre, une collation notée au petit-déjeuner se range sans se refaire ;
la cible vit dans `edition.cible`, séparée de `edition.repas` qui dit où la
ligne est encore, sinon le formulaire sauterait de place à chaque frappe. Quand le nom correspond à un aliment de `ALIMENTS`, un
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

**Un repas se garde sous un nom.** Un dîner de pâtes, fromage et jambon se
refait à l'identique : sous la liste d'un repas d'au moins deux lignes,
« Enregistrer ce repas comme un plat » ouvre un champ de nom **et coche les
lignes une à une**. Tout est coché au départ, mais un dessert pris à la fin
n'appartient pas au plat : on le décoche, le résumé recompte en direct. Les
plats vivent dans `profil.plats`, `{ nom: { items: [...] } }`, et se reposent
dans n'importe quel repas depuis le menu « Mes plats ». **Les lignes sont
copiées, jamais référencées** : corriger la portion du jour ne doit pas
réécrire la recette, ni l'inverse. La sélection vit dans `nomPlat.choix`,
pas dans les cases : une rediffusion du serveur les remettrait toutes à
coché. **Modifier et supprimer sont sous le menu « Mes plats »**, dans un
`<details>` replié, et pas dans le profil : Suzon l'y cherchait et ne la
trouvait pas. « Modifier » renomme le plat et en retire des aliments, un au
moins devant rester ; pour changer une quantité, on pose le plat dans un
repas, on corrige la ligne et on réenregistre sous le même nom, ce qui
remplace la recette.

**Les raccourcis tiennent en deux menus d'une ligne.** Une liste de
pastilles dépliée prenait la moitié de l'écran. « Mes petits-déjeuners et
collations » ne contient **que ce qui est déjà passé par ces deux repas**,
et rien d'autre : `alimentsGrignotes()` parcourt tous les jours enregistrés
et ne lit que `repas.petitdej` et `repas.collation`. Ni familles piochées
dans la base, ni aliments notés au déjeuner ou au dîner. C'est un
historique, pas un catalogue, et une version intermédiaire qui injectait
520 entrées de la base a été rejetée pour ça. Tri par nombre de fois noté,
puis alphabétique à égalité. Le dernier exemplaire noté fait foi pour un
aliment saisi à la main : le choisir repose la ligne entière, macros
comprises. La recherche, elle, continue de voir toute la base. « Mes
plats » est à côté ; les deux se remettent sur « Choisir… » après usage, et
la rangée disparaît quand les deux sont vides.

**Le filtre « Type de produit » a été retiré.** Quatre boutons Tout / Maison
/ Marques / Industriel, jamais utilisés, qui prenaient une rangée entière.
La recherche cherche dans tout.

**Les repas sont repliés par défaut.** Quatre listes ouvertes faisaient un
écran entier à faire défiler avant d'atteindre le bilan. Chaque repas est un
`<details>` dont le résumé porte le nom, le nombre d'aliments et les
calories ; le chevron pivote à l'ouverture. **L'ouverture vit dans
`repasOuverts`, pas dans le DOM** : la liste est redessinée à chaque
rediffusion du serveur. Modifier une ligne, nommer un plat ou poser un plat
ouvre le repas concerné, sinon le formulaire s'ouvrirait dans un bloc fermé.

**« Mon parcours » et « Où j'en suis » n'en font qu'une.** La barre de
parcours dit déjà le poids du jour, le départ et ce qui reste à perdre : les
tuiles les répétaient mot pour mot. Ne restent que les lectures que la barre
ne porte pas, moyenne sept jours, variation de la semaine, depuis le départ,
heure habituelle, tour de taille et nombre de pesées.

**Les déplacements de la journée se notent sans durée.** Ils se font par bouts
et l'application Santé n'en garde que le total : une carte à part, dans
l'onglet Sport, prend ce total et le remplace à chaque saisie au lieu de
l'empiler. Sans durée, l'équation de marche de l'ACSM se simplifie d'elle
même, son terme de vitesse valant `0,1 × v_m/min` : l'énergie par kilomètre
tombe à **0,5 kcal par kilogramme**, quelle que soit l'allure. C'est le coût
*net* qui est compté, le repos de ces minutes étant déjà porté par le niveau
d'activité du profil. L'entrée porte `jour: 1`, ce qui l'exclut du compte de
séances et du temps actif, mais pas des calories ni de la distance.
**Les étages suivent la même logique.** Le terme vertical de la même
équation vaut 1,33 × 1,8 × (mètres par minute) ml d'oxygène par kilogramme
et par minute, soit 2,39 ml par mètre grimpé, indépendamment de la vitesse
là aussi ; à 5 kcal par litre d'oxygène cela fait **0,012 kcal par
kilogramme et par mètre**. Santé compte un étage pour dix pieds, soit trois
mètres, d'où 0,036 kcal par kilogramme et par étage, environ 2,8 kcal à
77 kg. La descente n'est pas comptée : Santé ne la relève pas et elle coûte
environ trois fois moins. Les étages vivent dans `et` sur la même entrée, et
l'un des deux champs suffit pour enregistrer.

**Le double comptage est réel, et dit en clair sous le champ**, avec le
montant du jour et le nom du niveau d'activité choisi : ces calories
s'ajoutent à un coefficient qui compte déjà la marche ordinaire, donc le
mettre sur « Sédentaire » si les déplacements sont notés tous les jours.
Tentative de supprimer le niveau d'activité au profit du seul mesuré :
**refusée par Suzon**, l'écart était trop brutal (dépense de 2 080 à
1 741 kcal, objectif du jour de 1 530 à 1 200). Ne pas y revenir sans le
lui redemander. Les séances de sport, elles, restent une addition à part.

**Une séance de salle se détaille machine par machine.** Sous une séance
dont la catégorie `SPORTS` est `renfo`, et seulement celle-là, un carnet
d'exercices. Les lignes vivent dans `ex` sur l'entrée de séance : de la
fonte, `{ n, s, r, kg }`, le poids vide valant « poids du corps », ou du
cardio, `{ t:"cardio", n, m, d }`. Le formulaire bascule **tout seul** entre
les deux quand le nom tapé est celui d'une machine de `CARDIO_SALLE`, et un
lien force le mode quand le nom est inconnu. Pour le cardio, durée plus
distance **ou** allure : celle des deux qui manque se déduit de l'autre. Les
suggestions viennent de `EXERCICES` (environ 70 machines de fonte, par zone
du corps) et de `CARDIO_SALLE`, nomenclature française usuelle vérifiée sur
les catalogues d'équipementiers. Le formulaire **reste ouvert après chaque
ajout** en gardant séries et poids : on enchaîne rarement un seul exercice.
La saisie vit dans `exoSaisie`, jamais dans le DOM seul.

**« Musculation modérée » et « intense » ont disparu**, remplacées par une
seule **« Musculation »** portant le drapeau `"salle"` en cinquième champ de
`SPORTS`. Personne ne savait trancher, et l'écart valait du simple au
double, 3,5 MET contre 6. Les deux anciens noms restent dans `SPORTS` avec
le drapeau `"masque"`, hors du menu : sans eux, les séances déjà
enregistrées perdraient leur catégorie et leur carnet.

**La dépense d'une séance de salle se calcule depuis son contenu**
(`detailSalle`, `recalculeSalle`). **Ce n'est pas le temps passé sur place
qui compte, mais le temps réellement travaillé**, déduit des séries notées :
chaque série coûte ses répétitions, trois secondes l'une, plus le repos qui
la suit, pris à soixante-quinze secondes. Les minutes qui restent, celles où
l'on traîne entre deux machines, **ne comptent pas** : le niveau d'activité
du profil les compte déjà comme des minutes de vie ordinaire.

Sur ce temps travaillé, trois choses s'additionnent.

1. Les lignes de cardio, à leur propre coût et sur leurs propres minutes,
   ACSM pour les tapis, MET de vitesse pour les vélos, MET du compendium
   pour le reste.
2. Le temps de fonte au **MET publié pour la musculation à effort léger ou
   modéré, 3,5**, repos entre séries compris.
3. **Le travail mécanique de la masse réellement déplacée**, ce que le MET
   ignore. `m·g·h`, la descente ajoutant un tiers, rendement musculaire
   22 %, soit `9,81 × 4/3 ÷ 0,22 ÷ 4184 =` **0,014210 kcal par kilogramme et
   par mètre**. **La masse n'est pas que la charge** : « on ne dépense pas
   les mêmes kcal quand on pousse avec les jambes ou avec les bras ». Un
   squat lève la barre *et* tout ce qui est au-dessus des genoux, une presse
   à cuisses ne lève que le chariot, des tractions lèvent le corps entier et
   rien d'autre, un curl ne lève que l'haltère et l'avant-bras. Chaque
   exercice porte donc son **amplitude** et sa **part de poids du corps
   déplacée** (`PROFIL_EXO`, à défaut `PROFIL_ZONE` par zone, à défaut
   `PROFIL_NEUTRE`), les parts venant des tables anthropométriques usuelles :
   2 % pour un avant-bras, 5 % pour un bras, 16 % pour une jambe, deux tiers
   pour le tronc et la tête. Sans ça, **des tractions valaient zéro**, leur
   charge étant nulle. À 4 × 10 avec 40 kg et 77 kg de corps : squat 59 kcal,
   presse à cuisses 45, curl 40, mollets debout 40, tractions à vide 46.

Le temps travaillé ne dépasse jamais le temps sur place, et la fonte est
plafonnée à **6 MET rapportés au temps passé sur place**, pas aux seules
minutes travaillées : sur sept minutes de séries, ce plafond écrasait tous
les écarts entre un squat et un curl, qui sont justement ce qu'on cherche à
voir. Tant
qu'aucune ligne n'est notée, la séance vaut provisoirement tout son temps à
3,5 MET et le carnet le dit ; la première ligne remplace l'estimation par le
calcul, et **le chiffre peut alors descendre, c'est normal**. Le résumé sous
le carnet dit chaque morceau séparément, y compris les minutes oisives et
pourquoi elles ne comptent pas. **La ligne de séance n'affiche pas de MET**
pour une séance de salle : la moyenne d'un tapis à 9,8 et d'une fonte
plafonnée à 6 ne veut rien dire.

**Deux versions rejetées, et pourquoi.** La première faisait varier le MET
selon la densité du travail : sous un seuil rien ne bougeait, donc les deux
premières machines notées ne changeaient **rien**, et le poids saisi ne
comptait nulle part. La seconde facturait **tout** le temps passé sur place :
« si je reste 3 h à la salle mais que je n'ai fait qu'un exo, ça n'a rien à
voir avec quelqu'un qui en a fait 200 ». Toute reprise du modèle doit garder
les trois propriétés gagnées : **chaque série notée fait bouger le chiffre**,
**le poids compte**, et **le temps oisif ne rapporte rien**.

**Une machine inconnue ne bloque rien, et le carnet le dit.** En fonte, elle
prend l'amplitude et la part de corps neutres, `PROFIL_NEUTRE` ; en cardio,
elle est comptée à `MET_CARDIO_INCONNU`, 6 MET sur la durée, la distance
étant ignorée faute de savoir ce qu'elle veut dire, trois kilomètres au
rameur ne coûtant pas trois kilomètres de course.

**Une ligne d'exercice se corrige sans se supprimer** : la ligne entière est
un bouton qui ouvre le formulaire à sa place (`exoDepuisLigne`,
`exoSaisie.edit`). Une correction referme le formulaire, un ajout le laisse
ouvert. À l'ouverture, le mode fonte ou cardio vient de la ligne, et la
détection automatique par le nom ne reprend la main que si elle aurait choisi
pareil : sinon c'est un choix explicite qu'on ne défait pas.

**Le temps passé sur place se corrige dans le carnet** (`.salle-duree`).
Toute retouche, ligne ajoutée, corrigée, retirée ou durée changée, repasse
par `recalculeSalle`.

Repères de contrôle, 77 kg : trois heures sur place avec un seul exercice de
trois séries valent **37 kcal**, les mêmes trois heures avec soixante séries
en valent **634**. Une heure avec 20 min de tapis à 9 km/h et treize séries
pour 5 040 kg donne 258 + 105 + 38 = **402 kcal**.

**Le tour de taille a été retiré de l'interface.** « Je ne le ferai
jamais. » Le champ, sa tuile et sa lecture sont partis ; le champ `tour`
reste dans le modèle et dans l'export CSV, pour ne pas effacer en silence
les mesures déjà notées. Il ne compte plus dans `aDesDonnees()`.

**Modèle** : `profil/moi` et un document par jour, `jours/AAAA-MM-JJ`,
contenant poids, heure, eau, repas et séances (plus `tour`, conservé sans
interface). Le profil
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
7. **Un conteneur flex jette les nœuds de texte blancs.** Passer un bouton en
   `display: inline-flex` a transformé « Ajouter <span>0</span> kcal » en
   « Ajouter0kcal ». Un `<button>` centre déjà son texte : `min-height`
   suffit, la flexbox est de trop.
8. **Un second `<details>` dans un panneau casse les sélecteurs des tests.**
   `#panel-alim summary` désignait la saisie libre, jusqu'à ce que le bloc
   de suppression des plats arrive avant elle. Le bloc de saisie libre
   porte `id="libreBloc"`, et les harnais le visent par cet identifiant.
9. **`window.confirm` ne s'ouvre pas dans l'artefact.** La page tourne dans
   une iframe bac à sable : l'appel renvoie faux sans rien afficher, donc
   `if (!confirm(...)) return;` transformait le bouton en bouton mort, sans
   message ni bannière. C'est ce qui a fait dire à Suzon que la suppression
   d'un plat ne marchait pas, et « Tout effacer » avait le même défaut
   depuis toujours. **Aucune boîte native** : la question se pose dans la
   page, dans la ligne concernée. Le harnais compte les `dialog` et refuse
   qu'il y en ait.
10. **Une règle de grille écrite pour une liste s'applique à l'autre.**
   Les lignes de repas ont un bloc `.actions`, celles du sport une croix
   nue : placer `.kc` en colonne 2 a fait tomber la croix des séances sur
   une ligne à elle. La liste des séances porte `items-simple` et garde ses
   trois colonnes.

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

**L'en-tête, sous 600 px, passe en grille.** Les boutons ronds tiennent le
coin haut droit, le titre garde une ligne entière en dessous, le soleil et
l'étoile gardent le bas. Avant, une marge droite les écartait du soleil et
les poussait à la ligne, où ils flottaient au milieu de rien avec l'étoile
posée dessus. C'est ce que Suzon a appelé « un décalage qui ne fait pas
net ».

**Les champs d'une même rangée ont une hauteur commune**, 42 px. Un
`input[type="time"]` se dessine plus haut qu'un champ de texte et un bouton
`sm` plus bas qu'un bouton plein : alignés par le bas, leurs étiquettes ne
tombaient plus sur la même ligne.

**Sur mobile, « Modifier » est une pilule, pas un lien.** Souligné et pâle à
côté de la croix, il ne se voyait pas. Les deux commandes prennent
maintenant toute la largeur sous la ligne, la pilule porte un crayon dessiné
et fait 40 px de haut ; les calories remontent à droite du nom.

**Le lavis doit contenir le titre entier, sous-titre compris.** Son coin bas
gauche avait un rayon vertical de 42 % de la hauteur : la courbe passait
au-dessus de « LE CARNET DE SUZON », qui dépassait dans le fond sombre. Il
est à 30 %, la somme du bord gauche tombe donc sous 100 % et y laisse un
segment droit, et le bas de l'en-tête a 30 px de marge sur mobile. Le
contrôle est géométrique : le coin bas gauche du sous-titre doit vérifier
`((x-cx)/rx)² + ((y-cy)/ry)² ≤ 1` pour l'ellipse de ce coin.

**Les onglets se centrent à la main.** La couche de base empile icône et
texte en colonne, donc centrés ; la couche carnet les repasse en ligne et
ils retombaient sur `justify-content: flex-start`. « Alimentation » et
« Sport » se calaient à gauche de leur cellule, et seule la pastille de
l'onglet actif semblait centrée.

**Le titre doit tenir sur une ligne.** « Côté Sud » fait 34 px de
haut à 390 comme à 430 px, donc une seule ligne. Un titre plus long
passerait à deux et repousserait le sous-titre hors du lavis : mesurer la
hauteur du `h1` après tout changement de nom.

Le lavis derrière le titre déborde du conteneur par un `inset` négatif :
**il ne peut pas dépasser 18 px**, la gouttière de `.wrap`, sinon la page
déborde d'autant sur mobile. Le harnais vérifie qu'aucune largeur ne dépasse
la fenêtre, à 390 et 1000 px, et c'est lui qui a attrapé les 8 px de trop.

## Vérifier avant de publier

```bash
node -e "new Function(require('fs').readFileSync('perte-de-poids.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1])"
node outils/verifie.mjs           # stockage et mise en page, 20 contrôles
node outils/verifie-edition.mjs   # correction d'une ligne, changement de
                                  # repas, kilomètres et étages du jour,
                                  # 34 contrôles
node outils/verifie-plats.mjs     # plats, raccourcis, repli des repas,
                                  # modification et suppression,
                                  # 59 contrôles
node outils/verifie-muscu.mjs     # séance de salle : carnet, cardio
                                  # dedans, correction d'une ligne, masse
                                  # déplacée, 41 contrôles
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
