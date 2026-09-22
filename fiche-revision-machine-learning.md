# Fiche de révision : Machine Learning (apprentissage supervisé, régression)

> Fiche construite à partir des notes du tableau, complétée avec les définitions, formules et bonnes pratiques indispensables.

---

## 1. Vocabulaire de base

| Terme | Définition | Exemple |
|---|---|---|
| **Observation** (individu, échantillon) | Une ligne du dataset | Un appartement |
| **Variable** (feature, caractéristique) | Une colonne d'entrée, notée `x1, x2, …, xk` | Surface, nombre de pièces |
| **Label** (cible, target) | La colonne à prédire, notée `y` | Prix de l'appartement |
| **Dataset** | Tableau `X` de taille `n × k` + vecteur `y` de taille `n` | 1 000 appartements, 4 variables |
| **Modèle** | Fonction qui relie `X` à `y`, définie par des **paramètres** | `ŷ = a1·x1 + a2·x2 + b` |
| **Prédiction** | Valeur produite par le modèle, notée `ŷ` (« y chapeau ») | Prix estimé |
| **Erreur / résidu** | Écart entre la prédiction et la vérité : `ŷ − y` | Estimé 200 k€, réel 180 k€ → erreur 20 k€ |
| **Hyperparamètre** | Réglage fixé *avant* l'entraînement (pas appris par le modèle) | Taux d'apprentissage, degré du polynôme |

**Apprendre = trouver le lien entre les variables `X` et le label `y` à partir des données.**

---

## 2. Les deux grandes familles d'apprentissage

```
                    APPRENDRE (à partir des données)
                    /                             \
          SUPERVISÉ                          NON SUPERVISÉ
     (on connaît y)                        (pas de label y)
      /          \                          /            \
 Régression   Classification         Clustering   Réduction de dimension
 (y continu)  (y = catégorie)        (K-means…)   (ACP / PCA…)
```

| Famille | On dispose de… | Objectif | Exemples d'algorithmes |
|---|---|---|---|
| **Supervisé** | `X` **et** `y` | Prédire `y` pour de nouvelles `X` | Régression linéaire, arbres, k-NN, SVM, réseaux de neurones |
| **Non supervisé** | `X` seulement | Découvrir une structure cachée | K-means (clustering), DBSCAN, ACP |

- **Régression** : `y` est un nombre (prix, température, durée).
- **Classification** : `y` est une classe (spam / non spam, chat / chien).

---

## 3. Le modèle de régression linéaire

Forme générale (k variables) :

```
ŷ = a1·x1 + a2·x2 + … + ak·xk + b        soit       ŷ = Σ (i = 1 → k) ai·xi + b
```

- `ai` : **coefficients** (poids) → mesurent l'influence de chaque variable.
- `b` : **biais** (ordonnée à l'origine, souvent noté `a0` avec `x0 = 1`).
- En 1 dimension : `ŷ = a·x + b`, c'est une **droite** ajustée au nuage de points.

Écriture matricielle : `ŷ = X·a` (avec une colonne de 1 dans `X` pour le biais).

Exemple du tableau : après entraînement, l'algorithme a trouvé `ŷ = 3,5·x1 + 2,2·x2`.

---

## 4. Les trois étapes du ML

### Étape 1 — Optimisation (l'entraînement)

**But** : trouver les paramètres `(a1, a2, …)` qui rendent les prédictions les plus proches possible des vraies valeurs.

1. On définit une **fonction de coût** (loss function) `L(a1, a2, …)` qui mesure l'erreur globale du modèle.
2. On cherche les paramètres qui **minimisent** `L`.

**Fonction de coût classique en régression : moindres carrés ordinaires (Ordinary Least Squares, OLS)**

```
L(a) = Σ (i = 1 → n) (ŷi − yi)²
```

- On élève au carré pour que les erreurs positives et négatives ne s'annulent pas et pour pénaliser fortement les grosses erreurs.
- La version moyennée est la MSE (voir métriques).

**Deux façons de trouver le minimum :**

| Méthode | Principe | Avantages | Limites |
|---|---|---|---|
| **Équation normale** (solution analytique) | Formule directe : `a = (XᵀX)⁻¹ Xᵀ y` | Exacte, pas d'hyperparamètre | Coûteuse si beaucoup de variables (inversion de matrice) |
| **Descente de gradient** | Itératif : on part de paramètres aléatoires et on « descend la pente » de `L` | Fonctionne pour tout modèle, gros datasets | Choix du taux d'apprentissage, peut être lent |

**Descente de gradient, la règle de mise à jour :**

```
a ← a − α · ∂L/∂a
```

- `α` (alpha) = **taux d'apprentissage** (learning rate) : taille du pas.
  - Trop petit → convergence très lente.
  - Trop grand → on « saute » par-dessus le minimum, la loss diverge.
- `∂L/∂a` = gradient : direction de la plus forte montée, donc on va dans le sens opposé.
- On répète jusqu'à ce que la loss ne baisse plus (**convergence**).
- Variantes : *batch* (tout le dataset à chaque pas), *stochastique* (une observation), *mini-batch* (un petit paquet, le plus utilisé).

> Astuce : **normaliser / standardiser** les variables (même échelle) accélère beaucoup la descente de gradient.

### Étape 2 — Validation (pendant l'apprentissage)

Vérifier que le modèle **généralise** (fonctionne sur des données qu'il n'a jamais vues) et régler les hyperparamètres. Détaillé dans la partie 6.

### Étape 3 — Fin : Évaluation (après l'apprentissage)

On mesure la qualité finale du modèle sur le jeu de **test** avec des **métriques**, et on la compare à une **baseline**.

---

## 5. Les métriques de régression

Soit `n` observations, `yi` la vraie valeur, `ŷi` la prédiction, `ȳ` la moyenne des `y`.

| Métrique | Formule | Unité | Lecture |
|---|---|---|---|
| **MSE** (Mean Squared Error) | `(1/n) · Σ (ŷi − yi)²` | unité² | Pénalise fortement les grosses erreurs. Sensible aux valeurs aberrantes. |
| **RMSE** (Root MSE) | `√MSE` | même unité que `y` | Version interprétable de la MSE (« erreur typique »). |
| **MAE** (Mean Absolute Error) | `(1/n) · Σ |ŷi − yi|` | même unité que `y` | Erreur moyenne « brute ». Plus robuste aux valeurs aberrantes. |
| **R²** (coefficient de détermination) | `1 − Σ(ŷi − yi)² / Σ(yi − ȳ)²` | sans unité | Part de la variance de `y` expliquée par le modèle. |

**Interpréter R² :**
- `R² = 1` → prédictions parfaites.
- `R² = 0` → le modèle ne fait pas mieux que prédire la moyenne `ȳ`.
- `R² < 0` → le modèle fait **pire** que la moyenne (mauvais signe !).

**La baseline (modèle de référence)**

Avant de juger un modèle, on le compare à un modèle « bête » :
- Régression : **prédire toujours la moyenne de `y`** (`ŷ = ȳ`). C'est exactement le modèle pour lequel `R² = 0`.
- Classification : prédire toujours la classe majoritaire.

Un modèle n'a d'intérêt que s'il **bat nettement la baseline**.

**Quelle métrique choisir ?**
- Grosses erreurs inacceptables → RMSE.
- Données avec valeurs aberrantes → MAE.
- Communiquer un score global sans unité → R².
- En pratique on en regarde plusieurs.

---

## 6. Les problèmes du ML : sous-apprentissage vs sur-apprentissage

| | **Sous-apprentissage** (underfitting) | **Sur-apprentissage** (overfitting) |
|---|---|---|
| Modèle | **Trop rigide / trop simple** | **Trop flexible / trop complexe**, « collé » au dataset |
| Symptôme | Erreur **élevée** sur train **et** sur validation | Erreur **faible** sur train, **élevée** sur validation |
| Cause | Pas assez de capacité, variables manquantes, entraînement trop court | Trop de paramètres, pas assez de données, bruit appris par cœur |
| Image | Une droite pour modéliser une courbe | Une courbe qui passe par tous les points, bruit compris |
| Remèdes | Modèle plus complexe, ajouter des variables, entraîner plus longtemps | Plus de données, régularisation (Ridge, Lasso), simplifier le modèle, arrêt anticipé, validation croisée |

**Compromis biais / variance** : c'est la version « théorique » du même problème.
- **Biais** élevé = modèle trop simple → sous-apprentissage.
- **Variance** élevée = modèle trop sensible aux données → sur-apprentissage.
- Le bon modèle est **au milieu** : assez souple pour capter la tendance, assez contraint pour ignorer le bruit.

---

## 7. Les solutions

### Solution 1 — Précaution : le hold-out (découpage du dataset)

On ne doit **jamais** évaluer un modèle sur les données qui ont servi à l'entraîner (il les connaît déjà par cœur).

```
DATASET  ──►  [ TRAIN  ~70 %  | VAL  ~20 %  | TEST  ~10 % ]
                    │              │              │
             Ajuster les      Régler les      Estimation finale,
             paramètres    hyperparamètres,   UNE seule fois,
                            détecter le       jamais utilisé
                            sur-apprentissage  pour choisir quoi
                                               que ce soit
```

| Jeu | Rôle | Utilisé quand ? |
|---|---|---|
| **Train** (entraînement) | Le modèle apprend ses paramètres dessus | Pendant l'optimisation |
| **Validation** | Comparer plusieurs modèles / hyperparamètres, surveiller l'overfitting | Pendant le développement |
| **Test** | Mesurer la performance de **généralisation** finale | Une seule fois, à la toute fin |

Règles importantes :
- **Mélanger** (shuffle) les données avant de découper, sauf séries temporelles (on découpe alors dans l'ordre chronologique).
- Les proportions sont indicatives : 70/20/10, 80/10/10, 60/20/20…
- Le jeu de test doit rester « vierge » : si on s'en sert pour choisir un modèle, il devient un jeu de validation et l'estimation finale est biaisée.
- **Fuite de données** (data leakage) : calculer la normalisation, la moyenne, etc. sur tout le dataset avant le découpage fausse l'évaluation. On ajuste ces transformations sur le train seulement.

**Validation croisée (cross-validation, k-fold)** : quand on a peu de données, on découpe le train en `k` parties (souvent 5 ou 10) ; chaque partie sert tour à tour de validation, et on moyenne les `k` scores. Estimation plus fiable qu'un seul découpage.

### Solution 2 — Courbes d'apprentissage (monitoring)

On trace **l'erreur (loss)** en fonction du **nombre d'observations `n`** utilisées pour entraîner (ou du nombre d'itérations / époques), pour le train **et** la validation.

```
Erreur
(loss)
  │\
  │ \  VAL
  │  \_____
  │        ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾  ← écart = sur-apprentissage
  │      _______________
  │    /   TRAIN
  │  /
  └────────────────────────────►  nombre d'observations n
   10 %  20 %          100 %
```

Lecture :

| Ce qu'on observe | Diagnostic | Action |
|---|---|---|
| Train et val convergent vers une erreur **basse** | Bon modèle | Rien |
| Train et val convergent vers une erreur **haute** | **Sous-apprentissage** (biais) | Modèle plus complexe, meilleures variables |
| Train **bas**, val **haut**, écart persistant | **Sur-apprentissage** (variance) | Plus de données, régularisation, simplifier |
| Les deux courbes descendent encore | Manque de données | Collecter plus d'observations |
| Val remonte au fil des itérations | Overfitting en cours | **Arrêt anticipé** (early stopping) |

---

## 8. Le pipeline complet, résumé

```
1. Données      : collecter, nettoyer, choisir les variables X et le label y
2. Découpage    : train / validation / test (mélanger d'abord)
3. Prétraitement: normalisation, encodage (ajusté sur le train uniquement)
4. Choix modèle : régression linéaire, arbre, …
5. Optimisation : minimiser la loss (OLS) par équation normale ou descente de gradient
6. Validation   : courbes d'apprentissage, réglage des hyperparamètres, détecter under/overfitting
7. Évaluation   : métriques (MSE, RMSE, MAE, R²) sur le TEST, comparer à la baseline (moyenne de y)
8. Déploiement  : utiliser le modèle sur de nouvelles données, surveiller la dérive
```

---

## 9. Formules à retenir (l'essentiel en une page)

```
Modèle linéaire        ŷ = Σ ai·xi + b
Loss OLS               L(a) = Σ (ŷi − yi)²
Équation normale       a = (XᵀX)⁻¹ Xᵀ y
Descente de gradient   a ← a − α · ∂L/∂a
MSE                    (1/n) Σ (ŷi − yi)²
RMSE                   √MSE
MAE                    (1/n) Σ |ŷi − yi|
R²                     1 − Σ(ŷi − yi)² / Σ(yi − ȳ)²
Baseline régression    ŷ = ȳ   (R² = 0)
```

---

## 10. Auto-évaluation (questions flash)

1. Quelle est la différence entre apprentissage supervisé et non supervisé ?
2. Que représente `ŷ` ? Et `ŷ − y` ?
3. Pourquoi élève-t-on l'erreur au carré dans les moindres carrés ?
4. Que se passe-t-il si le taux d'apprentissage est trop grand ? Trop petit ?
5. Quelle métrique a la même unité que `y` : MSE ou RMSE ?
6. Que signifie un R² négatif ?
7. Pourquoi ne doit-on pas évaluer le modèle sur le jeu d'entraînement ?
8. À quoi sert le jeu de validation, par rapport au jeu de test ?
9. Sur une courbe d'apprentissage, comment reconnaît-on le sur-apprentissage ?
10. Citez trois remèdes contre le sur-apprentissage.

<details>
<summary>Réponses</summary>

1. Supervisé : on a le label `y` et on veut le prédire. Non supervisé : pas de label, on cherche une structure (clustering).
2. `ŷ` est la prédiction du modèle ; `ŷ − y` est l'erreur (résidu).
3. Pour que les erreurs positives et négatives ne s'annulent pas, et pour pénaliser davantage les grosses erreurs.
4. Trop grand : la loss diverge, on saute le minimum. Trop petit : convergence très lente.
5. RMSE (la MSE est en unité²).
6. Le modèle fait pire que prédire simplement la moyenne de `y`.
7. Il connaît déjà ces données ; le score serait optimiste et ne mesurerait pas la généralisation.
8. Validation : choisir le modèle et les hyperparamètres. Test : estimation finale, une seule fois, sans jamais influencer les choix.
9. Erreur de train basse, erreur de validation nettement plus haute, écart qui ne se referme pas.
10. Plus de données, régularisation (Ridge/Lasso), modèle plus simple, arrêt anticipé, validation croisée.

</details>
