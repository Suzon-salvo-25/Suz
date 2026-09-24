# Mes Pépites — le second cerveau Instagram & TikTok

**Je sauvegarde → l'appli analyse → elle classe → je retrouve.**

Une appli web (installable sur mobile) qui centralise les contenus enregistrés sur Instagram et TikTok, les classe automatiquement avec Claude et permet de les retrouver en langage naturel. Elle reprend le style du carnet *Côté Sud* : papier pêche, Fraunces et Figtree, et les aquarelles de la même planche d'autocollants.

## Ce que fait le MVP

| # | Fonction | Où |
|---|----------|----|
| 1 | Accueil de départ en 3 étapes (le cycle, ton espace, tes sources) | `vueOnboarding` |
| 2 | Compte : l'espace privé du compte claude.ai, ou ce navigateur en version autonome | `brancherCloud` |
| 3 | Import Instagram : export officiel `.zip` / `saved_posts.json` + `saved_collections.json` | `interpreterExport` |
| 4 | Import TikTok : export officiel `.zip` / `user_data_tiktok.json` (favoris, likes en option) | `interpreterExport` |
| 5 | Bibliothèque « Tout » : filtres plateforme, catégorie, créateur, type, date, collection, favoris, à compléter, doublons | `vueTout` |
| 6 | Classement automatique : règles locales tout de suite, puis Claude (titre, résumé, catégories multiples, tags, recette, lieu) | `classerParRegles`, `analyserLot` |
| 7 | Page Recettes : cartes, filtres (petit-déj… moins de 30 min), recherche « j'ai du poulet, des courgettes… » | `vueRecettes` |
| 8 | Recherche : locale et instantanée (accents, pluriels, synonymes, « sur TikTok »), puis Claude sur Entrée | `rechercher`, `rechercheIA` |
| 9 | Fiche détaillée : recette complète, lieu, catégories, tags, notes, collections, légende, capture, doublons | `ficheHTML` |
| 10 | Catégories : créer, renommer, fusionner, supprimer, sous-catégories ; collections | `vueCategories` |
| 11 | Réglages : sources, ce que chaque API permet, analyse, export JSON, suppression des données et du compte, historique | `vueReglages` |

Aussi : favoris, tags auto et manuels, notes, sélection multiple (déplacer, ajouter à une collection, reclasser avec Claude, retirer), détection et fusion des doublons, historique, coller un lien n'importe où pour l'ajouter.

## Ce que les plateformes permettent vraiment

Aucune intégration n'est simulée. L'appli le dit aussi dans ses réglages.

**Instagram**
- L'API Instagram (Instagram Login ou Facebook Login) n'accepte que les comptes professionnels. L'API Basic Display, qui servait aux comptes personnels, a fermé le 4 décembre 2024.
- **Aucun point d'accès n'expose les publications enregistrées ni les collections.** Une synchronisation automatique est donc impossible aujourd'hui.
- oEmbed (légende, miniature) demande une appli Meta validée et un serveur.
- Solution retenue : l'export « Télécharger vos informations » (JSON, rubrique *Enregistré*), qui donne le lien, l'auteur, la date et les collections, sans légende ni image. Au quotidien : partager le lien.

**TikTok**
- Login Kit (OAuth) + Display API : profil et vidéos publiques de l'utilisateur, **pas les favoris**.
- Data Portability API : peut transmettre l'activité, favoris compris, mais seulement pour les comptes de l'EEE et du Royaume-Uni, avec une appli approuvée par TikTok. C'est la voie de synchronisation automatique prévue pour la version serveur.
- oEmbed est public, mais une page ne peut pas l'appeler depuis le navigateur : il faut un serveur.
- Solution retenue : l'export « Télécharger tes données » (JSON), qui donne le lien et la date de chaque favori (et de chaque like).

Comme les exports ne contiennent pas les légendes, l'appli propose de coller la légende ou d'ajouter une capture d'écran, que Claude lit.

Ces règles changent : à revérifier dans la documentation de Meta et de TikTok avant d'écrire la version serveur.

## Fichiers

```
second-cerveau/
├── src/
│   ├── app.html             structure et styles (tokens du carnet Côté Sud)
│   ├── autocollants.css     la planche d'aquarelles, embarquée en WebP
│   └── js/
│       ├── 01-socle.js      outils, registre des PLATEFORMES, stockage
│       ├── 02-classement.js catégories, règles, analyse Claude, lecture des exports
│       ├── 03-vues.js       recherche, recettes, accueil, tout, catégories, réglages
│       ├── 04-fiche-ajout.js fiche, ajout, actions, exemples, premier lancement
│       └── 05-moteur.js     rendu, événements, démarrage
├── build.py                 assemble index.html et dist/artifact.html
├── index.html               version autonome (générée)
├── manifest.webmanifest     installation + cible de partage (share_target)
├── sw.js                    coquille hors ligne
└── icone.svg
```

Après une modification dans `src/` : `python3 build.py`.

## Deux façons de l'utiliser

**Sur claude.ai** (`dist/artifact.html`, publiée en Artifact). Capacités déclarées : `db` et `user` pour un espace privé par personne (`data/users/<id>/espace`, illisible même par le propriétaire de la page), `sample` pour l'analyse et la recherche par Claude (sur le forfait de la personne), `downloads` pour l'export. Pas de partage direct depuis Instagram vers une page claude.ai : on colle le lien.

**Version autonome** (`index.html` servi en HTTPS). Données dans le navigateur, classement par règles locales. Installée sur Android, elle apparaît dans la feuille de partage d'Instagram et de TikTok grâce au `share_target` du manifeste (le lien arrive dans `?url=`/`?text=`). iOS ne gère pas `share_target` pour les applis web : il faudra une extension de partage native.

## Ajouter une plateforme

Tout passe par le registre `PLATEFORMES` (`01-socle.js`) : une fonction `reconnaitre(url)` qui renvoie la clé anti-doublon, le type et le créateur, et, pour l'import, un tableau `api` et un `guide`. Pinterest, YouTube (et Shorts), X, Reddit et Facebook sont déjà reconnus quand on colle leurs liens ; il manque seulement l'import de leurs favoris.

## Version serveur (prochaine étape)

Pour la synchronisation automatique là où elle est permise :
1. Un backend (par exemple Supabase : Auth, Postgres, Edge Functions) avec une vraie création de compte.
2. OAuth TikTok (Login Kit + Data Portability) : jetons chiffrés au repos côté serveur, jamais exposés au navigateur, révocables depuis les réglages.
3. oEmbed Instagram et TikTok côté serveur pour récupérer légendes et miniatures des liens partagés.
4. Tâche planifiée qui tire les nouveaux favoris et les envoie à l'analyse.
5. Mêmes garanties : jamais de mot de passe, export, suppression des données et du compte.
