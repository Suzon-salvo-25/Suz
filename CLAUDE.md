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

**Données en dur** : `ALIMENTS` (379 entrées `[nom, kcal, prot, gluc, lip,
catégorie, portion_g, libellé]` pour 100 g) et `SPORTS` (`[nom, MET,
catégorie, type?]`, le type valant `course`, `marche`, `velo` ou `nage` pour
les disciplines à distance).

**Modèle** : `profil/moi` et un document par jour, `jours/AAAA-MM-JJ`,
contenant poids, heure, tour de taille, eau, repas et séances.

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

Palette validée pour les déficiences de la vision des couleurs dans les deux
thèmes : bleu `#2a78d6`, orange `#eb6834`, aqua `#1baf7a` en clair ;
`#3987e5`, `#d95926`, `#199e70` en sombre. Ne pas changer sans revalider.

Typographie : Bricolage Grotesque (titres), Figtree (texte), Azeret Mono
(chiffres). Tout token de couleur est défini sur `:root` nu, puis redéfini
sous `@media (prefers-color-scheme: dark)` avec la garde
`:root:not([data-theme="light"])` et sous `:root[data-theme="dark"]`.

## Vérifier avant de publier

```bash
node -e "new Function(require('fs').readFileSync('perte-de-poids.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1])"
node outils/verifie.mjs
```

Le harnais simule un serveur **gelé, lent et bavard**, celui qui a révélé la
plupart des bugs ci-dessus. Un test qui passe sans lui ne prouve rien : les
trois défauts les plus coûteux n'apparaissaient que sur la version publiée.

## Reste à faire

Compléter la base de marques françaises par recherche web, un domaine par
agent, en écrivant les résultats dans des fichiers JSON séparés puis en les
fusionnant avec contrôle de cohérence. Le budget de recherche web est compté
par session : prévoir une session neuve.

Non couvert à ce jour : bières et spiritueux, confiseries (Côte d'Or,
Toblerone, Kit Kat, Mars, Haribo, Carambar), traiteur de la mer (Labeyrie,
Coraya, Connétable, Saupiquet), restauration rapide hors McDonald's, pain et
viennoiserie industrielle, apéritif salé, sauces (Amora, Heinz, Lesieur,
Maille, Bénédicta), et les œufs.
