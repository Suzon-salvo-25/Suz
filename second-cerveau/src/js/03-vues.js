
/* ==================================================================
   RECHERCHE
   Deux étages. Tout de suite, une recherche locale qui comprend les
   pluriels, les accents, quelques synonymes et « sur TikTok ». Sur
   demande (Entrée), Claude relit l'index et répond à la question telle
   qu'elle a été posée.
   ================================================================== */

var VIDES = new Set(("le la les l un une des du de d au aux a et ou en sur avec pour que qui quoi dont mon ma mes ton ta tes son sa ses " +
  "truc trucs chose choses machin j je tu il elle on nous vous ils avais avait ai as avoir enregistre enregistree enregistres enregistrees " +
  "sauvegarde sauvegardee vu vue cette ce cet ces dans par pas plus tres peu comme y est c ca celui celle celles ceux genre style " +
  "trouve retrouve cherche montre veux voudrais faire idee idees un une").split(" "));
var MOTS_PLAT = { tiktok: "tiktok", tik: "tiktok", instagram: "instagram", insta: "instagram", ig: "instagram", youtube: "youtube", yt: "youtube", pinterest: "pinterest" };
var SYNONYMES = {
  abdo: ["abdo", "abdominau", "abs", "gainage", "core", "sangle"],
  resto: ["restaurant", "resto", "trattoria", "brasserie", "bistrot", "pizzeria"],
  restaurant: ["restaurant", "resto", "trattoria", "brasserie", "bistrot", "pizzeria"],
  italien: ["italien", "italie", "trattoria", "pizza", "pizzeria", "pasta"],
  hotel: ["hotel", "resort", "airbnb", "hebergement"],
  pate: ["pate", "pasta", "spaghetti", "tagliatelle", "penne", "linguine", "lasagne", "rigatoni", "gnocchi", "orzo"],
  robe: ["robe", "dress"],
  avocat: ["avocat", "avocado", "guacamole"],
  noisette: ["noisette", "hazelnut", "praline", "gianduja"],
  poulet: ["poulet", "chicken", "volaille"],
  dessert: ["dessert", "gateau", "cake", "cookie", "tarte", "brownie", "tiramisu"],
  piscine: ["piscine", "pool"],
  exercice: ["exercice", "workout", "entrainement", "seance"],
  serie: ["serie", "netflix", "saison"],
  maquillage: ["maquillage", "makeup"],
  cheveu: ["cheveu", "cheveux", "hair", "coiffure"],
  deco: ["deco", "decoration", "interieur"]
};

var indexCache = {};
function indexItem(it) {
  var c = indexCache[it.id];
  if (c && c.m === it.modifie && c.n === Object.keys(Store.cats).length) return c;
  var r = it.recette || {};
  var champ = function (s) { return mots(s).map(racine); };
  c = {
    m: it.modifie, n: Object.keys(Store.cats).length,
    titre: champ((it.titre || "") + " " + (r.nom || "")),
    cats: champ(catsValides(it).map(function (id) {
      var x = Store.cats[id]; return x.nom + " " + (x.parent && Store.cats[x.parent] ? Store.cats[x.parent].nom : "");
    }).join(" ")),
    ingr: champ((r.ingredients || []).map(function (i) { return i.nom; }).join(" ")),
    tags: champ((it.tags || []).concat(it.tagsAuto || []).join(" ")),
    lieu: champ(it.lieu ? [it.lieu.nom, it.lieu.ville, it.lieu.pays].join(" ") : ""),
    reste: champ([it.resume, it.legende, it.note, it.createur, (it.collectionsOrigine || []).join(" "), TYPES[it.type]].join(" "))
  };
  indexCache[it.id] = c;
  return c;
}
var POIDS = { titre: 5, cats: 4, ingr: 3, tags: 3, lieu: 4, reste: 1 };

function motCorrespond(liste, t) {
  for (var i = 0; i < liste.length; i++) {
    var w = liste[i];
    if (w.indexOf(t) === 0 || (t.length >= 5 && w.length >= 4 && t.indexOf(w) === 0)) return true;
  }
  return false;
}

function analyserRequete(q) {
  var toks = mots(q), plat = null, termes = [];
  toks.forEach(function (w) {
    if (MOTS_PLAT[w]) { plat = MOTS_PLAT[w]; return; }
    if (VIDES.has(w) || w.length < 2) return;
    var r = racine(w);
    if (termes.indexOf(r) < 0) termes.push(r);
  });
  return { plat: plat, termes: termes };
}

function rechercher(q, source) {
  var a = analyserRequete(q);
  var liste = source || tousItems();
  if (a.plat) liste = liste.filter(function (it) { return it.plateforme === a.plat; });
  if (!a.termes.length) return { exacts: a.plat ? liste : [], proches: [], plat: a.plat, termes: a.termes };
  var res = [];
  liste.forEach(function (it) {
    var ix = indexItem(it), score = 0, trouves = 0, horsCat = 0;
    a.termes.forEach(function (t) {
      var variantes = SYNONYMES[t] || [t], meilleur = 0, ailleurs = false;
      variantes.forEach(function (v) {
        Object.keys(POIDS).forEach(function (f) {
          if (!motCorrespond(ix[f], v)) return;
          if (POIDS[f] > meilleur) meilleur = POIDS[f];
          if (f !== "cats") ailleurs = true;
        });
      });
      if (meilleur) { trouves++; score += meilleur; if (ailleurs) horsCat++; }
    });
    // Un « proche » qui ne partage que le nom d'une catégorie (« recette ») n'aide pas.
    if (trouves) res.push({ it: it, cov: trouves / a.termes.length, hors: horsCat, score: score + (it.favori ? .5 : 0) });
  });
  res.sort(function (x, y) { return y.cov - x.cov || y.score - x.score || (y.it.importe || 0) - (x.it.importe || 0); });
  return {
    exacts: res.filter(function (r) { return r.cov === 1; }).map(function (r) { return r.it; }),
    proches: res.filter(function (r) { return r.cov < 1 && r.cov >= .5 && r.hors > 0; }).map(function (r) { return r.it; }),
    plat: a.plat, termes: a.termes
  };
}

function ligneIndex(it) {
  var r = it.recette;
  return [it.id, nomPlat(it.plateforme), it.titre, libelleCats(it),
    (it.tags || []).concat(it.tagsAuto || []).join(","),
    r ? "ingrédients: " + (r.ingredients || []).map(function (i) { return i.nom; }).join(", ") : "",
    it.lieu ? "lieu: " + [it.lieu.nom, it.lieu.ville, it.lieu.pays].filter(Boolean).join(", ") : "",
    it.createur ? "@" + it.createur : "",
    String(it.resume || it.legende || it.note || "").replace(/\s+/g, " ").slice(0, 140)
  ].filter(Boolean).join(" | ");
}

async function rechercheIA(q) {
  if (!iaDispo() || !q.trim()) return;
  if (ICI.iaCtl) ICI.iaCtl.abort();
  var ctl = new AbortController();
  ICI.iaCtl = ctl;
  ICI.ia = { q: q, enCours: true };
  rendreBientot();
  var local = rechercher(q);
  var ordre = local.exacts.concat(local.proches);
  var vus = {};
  ordre.forEach(function (it) { vus[it.id] = 1; });
  tousItems().sort(function (a, b) { return (b.importe || 0) - (a.importe || 0); }).forEach(function (it) { if (!vus[it.id]) ordre.push(it); });
  var enc = new TextEncoder(), lignes = [], taille = 0, max = 52000;
  for (var i = 0; i < ordre.length; i++) {
    var l = ligneIndex(ordre[i]), n = enc.encode(l).length + 1;
    if (taille + n > max) break;
    lignes.push(l); taille += n;
  }
  var prompt = [
    "Tu aides une personne à retrouver un contenu parmi ceux qu'elle a enregistrés sur Instagram et TikTok.",
    "Sa demande, telle qu'elle l'a écrite : « " + q + " »",
    "Voici son index (une ligne par contenu : id | plateforme | titre | catégories | tags | ingrédients | lieu | créateur | extrait) :",
    lignes.join("\n"),
    "",
    "Comprends l'intention (synonymes, fautes, plateforme citée, souvenir vague) et choisis les contenus qui y répondent, du plus au moins pertinent (24 au plus).",
    "Ne propose que des id présents dans l'index. Si rien ne correspond, renvoie une liste vide et dis-le.",
    "Réponds uniquement en JSON : {\"ids\": [\"…\"], \"reponse\": \"une phrase en français, en tutoyant, qui dit ce que tu as trouvé\"}."
  ].join("\n");
  try {
    var rep = await IA.sample.json(prompt, { signal: ctl.signal, modelTier: "default" });
    if (ICI.iaCtl !== ctl) return;
    var ids = ((rep && rep.ids) || []).filter(function (id) { return Store.items[id]; });
    ICI.ia = { q: q, ids: ids, reponse: rep && rep.reponse ? String(rep.reponse) : "", tronque: lignes.length < ordre.length };
  } catch (e) {
    if (e && e.code === "cancelled") return;
    iaFatal(e);
    ICI.ia = { q: q, erreur: messageIA(e) };
  }
  ICI.iaCtl = null;
  rendreBientot();
}

/* ==================================================================
   RECETTES
   ================================================================== */

var BASIQUES = ["sel", "poivre", "huile", "eau", "huile d olive", "sucre", "farine", "beurre", "epice"];
function estRecette(it) { return !!it.recette || parentsItem(it).indexOf("recettes") >= 0; }
function aCat(it, nomSous) {
  var c = trouverCat(nomSous, "recettes");
  return c ? catsValides(it).indexOf(c.id) >= 0 : false;
}
function aRepas(it, r) { return !!(it.recette && (it.recette.repas || []).indexOf(r) >= 0); }
var FILTRES_REC = [
  ["petit-dejeuner", "Petit-déjeuner", function (it) { return aRepas(it, "petit-dejeuner") || aCat(it, "Petit-déjeuner"); }],
  ["dejeuner", "Déjeuner", function (it) { return aRepas(it, "dejeuner") || aCat(it, "Déjeuner"); }],
  ["diner", "Dîner", function (it) { return aRepas(it, "diner") || aCat(it, "Dîner"); }],
  ["dessert", "Dessert", function (it) { return aRepas(it, "dessert") || aCat(it, "Desserts"); }],
  ["aperitif", "Apéritif", function (it) { return aRepas(it, "aperitif") || aCat(it, "Apéritifs"); }],
  ["healthy", "Healthy", function (it) { return (it.recette && it.recette.healthy === true) || aCat(it, "Healthy"); }],
  ["rapide", "Rapide", function (it) { return aCat(it, "Recettes rapides") || !!(it.recette && it.recette.temps && it.recette.temps <= 20); }],
  ["vegetarien", "Végétarien", function (it) { return !!(it.recette && it.recette.vegetarien === true); }],
  ["moins30", "Moins de 30 min", function (it) { return !!(it.recette && it.recette.temps && it.recette.temps < 30); }]
];

// « J'ai du poulet, des courgettes et du parmesan » → [poulet, courgette, parmesan]
function ingredientsDemandes(txt) {
  var t = " " + norm(txt).replace(/\bj ai\b|\bil me reste\b|\bdans (mon|le) frigo\b|\bj avais\b|\bqu est ce que je (peux|fais)\b/g, " ") + " ";
  return t.split(/,|;|\+|\/|\bet\b|\bavec\b|\bou\b|\n/)
    .map(function (p) {
      return mots(p).filter(function (w) { return !VIDES.has(w) && !/^\d+$/.test(w) && ["peu", "reste", "frigo", "aussi"].indexOf(w) < 0; }).map(racine);
    })
    .filter(function (p) { return p.length; });
}
function correspondanceFrigo(it, demandes) {
  var ingr = (it.recette && it.recette.ingredients) || [];
  if (!ingr.length || !demandes.length) return null;
  var ok = [], manque = [], utilises = {};
  ingr.forEach(function (i) {
    var m = mots(i.nom).map(racine);
    var trouve = demandes.some(function (d, k) {
      var hit = d.some(function (w) { return motCorrespond(m, w); });
      if (hit) utilises[k] = 1;
      return hit;
    });
    if (trouve) ok.push(i.nom);
    else if (!BASIQUES.some(function (b) { return norm(i.nom).indexOf(b) === 0; })) manque.push(i.nom);
  });
  if (!ok.length) return null;
  return { ok: ok, manque: manque, nbUtilises: Object.keys(utilises).length };
}

/* ==================================================================
   ÉTAT DE L'INTERFACE
   ================================================================== */

var ICI = {
  vue: "accueil",
  q: "", ia: null, iaCtl: null,
  tout: { texte: "", plat: "", cat: "", createur: "", type: "", periode: "", coll: "", fav: false, acompleter: false, doublons: false, tri: "recent" },
  limite: 60,
  sel: new Set(), modeSel: false, barre: null,
  rec: { filtres: [], frigo: "" },
  catEdit: null, collEdit: null,
  confirm: null,
  onb: 1,
  fiche: null, ficheConfirm: false, ficheTitre: false,
  ajout: { onglet: "liens", plat: "instagram", liens: "", legende: "", note: "", capture: null, lecture: null, likes: false }
};

function tousItems() { return Object.keys(Store.items).map(function (k) { return Store.items[k]; }); }
function recents(liste) { return liste.slice().sort(function (a, b) { return (b.importe || 0) - (a.importe || 0) || (b.ajoute || 0) - (a.ajoute || 0); }); }
function aCompleter(it) { return !catsValides(it).length || (it.analyse && it.analyse.etat === "vide"); }

function cleSimilaire(it) {
  var fiable = (it.analyse && (it.analyse.par === "ia" || it.analyse.titreManuel)) || it.demo;
  var base = (it.recette && it.recette.nom) || (fiable ? it.titre : "");
  var m = mots(base).filter(function (w) { return !VIDES.has(w); }).map(racine);
  if (m.length < 2) return null;
  return m.sort().join(" ");
}
function groupesDoublons() {
  var g = {};
  tousItems().forEach(function (it) { var k = cleSimilaire(it); if (k) (g[k] = g[k] || []).push(it.id); });
  // Deux liens courts TikTok peuvent désigner la même vidéo qu'un lien long.
  return Object.keys(g).map(function (k) { return g[k]; }).filter(function (a) { return a.length > 1; });
}
function similaires(it) {
  var k = cleSimilaire(it);
  if (!k) return [];
  return tousItems().filter(function (x) { return x.id !== it.id && cleSimilaire(x) === k; });
}

/* ==================================================================
   MORCEAUX DE RENDU
   ================================================================== */

function vis(it, ratio) {
  var c = catVisuelle(it);
  var ar = ratio || (it.ratio ? Math.max(.6, Math.min(1.4, it.ratio)).toFixed(3) : ["4 / 5", "1 / 1", "3 / 4", "4 / 5", "5 / 6"][parseInt(hash(it.id), 36) % 5]);
  var etat = "";
  if (IA.file.indexOf(it.id) >= 0 || (it.analyse && it.analyse.etat === "attente" && IA.enCours)) etat = '<span class="etat ia">Analyse…</span>';
  else if (it.demo) etat = '<span class="etat">Exemple</span>';
  else if (aCompleter(it)) etat = '<span class="etat">À compléter</span>';
  return '<span class="pep-vis t-' + teinteCat(c) + '" style="--ar:' + ar + '">' +
    (it.vignette ? '<img src="' + esc(it.vignette) + '" alt="" loading="lazy">' : '<span class="illu st-' + stickerItem(it, c) + '" aria-hidden="true"></span>') +
    etat +
    (it.favori ? '<span class="fav" aria-label="Favori"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7C19.5 15.9 12 20.5 12 20.5z"/></svg></span>' : "") +
    '</span>';
}
function lienOrig(it, classe) {
  if (!it.url) return "";
  return '<a class="' + (classe || "lien-orig") + '" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">Ouvrir ↗</a>';
}
function badgePlat(it) {
  var p = PLATEFORMES[it.plateforme] || PLATEFORMES.web;
  return '<span class="plat ' + p.classe + '">' + esc(p.nom) + '</span>';
}
function carte(it) {
  var choisi = ICI.sel.has(it.id);
  return '<article class="pep' + (choisi ? " choisi" : "") + '" data-id="' + esc(it.id) + '">' +
    '<button type="button" class="coche" data-action="cocher" data-id="' + esc(it.id) + '" aria-pressed="' + choisi + '" aria-label="Sélectionner">' +
      (choisi ? '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>' : "") +
    '</button>' +
    '<button type="button" class="pep-ouvrir" data-action="' + (ICI.modeSel ? "cocher" : "fiche") + '" data-id="' + esc(it.id) + '">' +
      vis(it) +
      '<span class="pep-corps"><h3>' + esc(it.titre || titreParDefaut(it)) + '</h3>' +
      '<span class="cats">' + esc(libelleCats(it, 2) || "Non classé") + '</span></span>' +
    '</button>' +
    '<div class="pep-pied">' + badgePlat(it) + '<span class="qui">' + (it.createur ? "@" + esc(it.createur.replace(/^@/, "")) : "") + '</span>' + lienOrig(it) + '</div>' +
  '</article>';
}
function mur(liste) {
  if (!liste.length) return "";
  return '<div class="mur">' + liste.map(carte).join("") + '</div>';
}
function vide(sticker, texte) {
  return '<p class="empty"><span class="illu-mini st-' + sticker + '" aria-hidden="true"></span>' + texte + '</p>';
}

/* ==================================================================
   ACCUEIL
   ================================================================== */

var EXEMPLES_Q = ["recette avec des noisettes", "pâtes au poulet", "restaurant italien à Chicago", "robe noire", "exercices pour les abdos", "hôtel avec piscine", "truc que j'avais enregistré sur TikTok avec de l'avocat"];

function vueAccueil() {
  var items = tousItems();
  var nbRec = items.filter(estRecette).length;
  var nbAC = items.filter(aCompleter).length;
  var h = '<section aria-label="Recherche">' +
    '<form class="recherche" id="formRecherche" role="search">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>' +
      '<input type="search" id="q" autocomplete="off" enterkeyhint="search" aria-label="Chercher dans mes sauvegardes" placeholder="Chercher dans mes sauvegardes…" value="' + esc(ICI.q) + '">' +
      (ICI.q ? '<button type="button" class="efface" data-action="effacer-q" aria-label="Effacer">×</button>' : "") +
      '<button type="submit" class="btn go sm"' + (iaDispo() ? "" : ' title="Recherche locale"') + '>' + (iaDispo() ? "Demander" : "Chercher") + '</button>' +
    '</form>';
  if (!ICI.q) {
    h += '<div class="exemples">' + EXEMPLES_Q.map(function (e) {
      return '<button type="button" class="chip" data-action="exemple-q" data-q="' + esc(e) + '">« ' + esc(e) + ' »</button>';
    }).join("") + '</div>';
    h += '<p class="resume-ligne"><span><b>' + items.length + '</b> ' + (items.length > 1 ? "pépites" : "pépite") + '</span>' +
      '<span><b>' + nbRec + '</b> ' + (nbRec > 1 ? "recettes" : "recette") + '</span>' +
      (nbAC ? '<button type="button" data-action="voir-acompleter">' + nbAC + ' à compléter</button>' : "") +
      '<span>' + (iaDispo() ? "Classement par Claude" : "Classement par règles locales") + '</span></p>';
  }
  h += '</section>';

  if (ICI.q) return h + resultatsRecherche();

  if (!items.length) {
    return h + '<div class="card" style="margin-top:26px"><header><span class="tache t-peche"><span class="illu st-framboise"></span></span><h2>Ta première pépite</h2></header>' +
      '<div class="body"><p class="prose">Importe l\'export de tes enregistrements Instagram ou de tes favoris TikTok, ou colle simplement un lien. L\'appli range tout, tu n\'as plus qu\'à chercher.</p>' +
      '<div class="boutons"><button type="button" class="btn go" data-action="ouvrir-ajout" data-onglet="liens">Coller un lien</button>' +
      '<button type="button" class="btn ghost" data-action="ouvrir-ajout" data-onglet="export" data-plat="instagram">Importer Instagram</button>' +
      '<button type="button" class="btn ghost" data-action="ouvrir-ajout" data-onglet="export" data-plat="tiktok">Importer TikTok</button>' +
      '<button type="button" class="btn ghost" data-action="charger-exemples">Voir avec des exemples</button></div></div></div>';
  }

  var ps = parents();
  h += '<div class="titre-sec"><h2>Mes univers</h2><button type="button" class="lien" data-action="vue" data-vue="categories">Gérer les catégories</button></div>';
  h += '<div class="univers">' + ps.map(function (p, i) {
    var n = items.filter(function (it) { return dansCat(it, p.id); }).length;
    return '<button type="button" class="univ" data-action="voir-cat" data-cat="' + esc(p.id) + '">' +
      '<span class="tache t-' + teinteCat(p) + ' b' + (i % 4 + 1) + '"><span class="illu st-' + stickerCat(p) + '" aria-hidden="true"></span></span>' +
      '<span><h3>' + esc(p.nom) + '</h3><span class="n">' + (n ? pluriel(n, "pépite") : "Rien encore") + '</span></span></button>';
  }).join("");
  var nc = items.filter(function (it) { return !catsValides(it).length; }).length;
  if (nc) h += '<button type="button" class="univ" data-action="voir-acompleter"><span class="tache t-lavande b2"><span class="illu st-meduse" aria-hidden="true"></span></span><span><h3>Non classés</h3><span class="n">' + pluriel(nc, "pépite") + '</span></span></button>';
  h += '</div>';

  var rec = recents(items).slice(0, 12);
  h += '<div class="titre-sec"><h2>Ajoutés récemment</h2><button type="button" class="lien" data-action="vue" data-vue="tout">Tout voir</button></div>' + mur(rec);

  var favs = recents(items.filter(function (it) { return it.favori; })).slice(0, 8);
  if (favs.length) h += '<div class="titre-sec"><h2>Mes favoris</h2><button type="button" class="lien" data-action="voir-favoris">Tous les favoris</button></div>' + mur(favs);
  return h;
}

function resultatsRecherche() {
  var r = rechercher(ICI.q), h = "";
  var ia = ICI.ia && ICI.ia.q === ICI.q ? ICI.ia : null;
  if (ia) {
    if (ia.enCours) h += '<div class="ia-bloc"><span class="illu-mini st-meduse" aria-hidden="true"></span><span>Claude relit tes pépites…</span></div>';
    else if (ia.erreur) h += '<div class="ia-bloc erreur"><span class="illu-mini st-grenade" aria-hidden="true"></span><span>' + esc(ia.erreur) + ' Les résultats ci-dessous viennent de la recherche locale.</span></div>';
    else {
      h += '<div class="ia-bloc"><span class="illu-mini st-etoile" aria-hidden="true"></span><span><b>Claude :</b> ' + esc(ia.reponse || (ia.ids.length ? "Voici ce que j'ai trouvé." : "Rien ne correspond.")) +
        (ia.tronque ? ' <span class="aide">(Index trop long : les contenus les plus anciens n\'ont pas été relus.)</span>' : "") + '</span></div>';
      if (ia.ids.length) h += '<div class="titre-sec"><h2>Selon Claude</h2><span class="lab">' + pluriel(ia.ids.length, "résultat") + '</span></div>' + mur(ia.ids.map(function (id) { return Store.items[id]; }).filter(Boolean));
    }
  }
  var titre = ia && !ia.enCours && !ia.erreur ? "Recherche par mots" : "Résultats";
  var filtre = r.plat ? " sur " + nomPlat(r.plat) : "";
  if (r.exacts.length) {
    h += '<div class="titre-sec"><h2>' + titre + filtre + '</h2><span class="lab">' + pluriel(r.exacts.length, "pépite") + '</span></div>' + mur(r.exacts.slice(0, 60));
  }
  if (r.proches.length) {
    h += '<div class="titre-sec"><h2>Ça pourrait être ça</h2><span class="lab">' + pluriel(r.proches.length, "pépite") + '</span></div>' + mur(r.proches.slice(0, 30));
  }
  if (!r.exacts.length && !r.proches.length && !(ia && ia.ids && ia.ids.length)) {
    h += '<div style="margin-top:18px">' + vide("coquillage", "Rien trouvé avec ces mots." + (iaDispo() && !ia ? " Appuie sur Entrée pour demander à Claude, il comprend les demandes floues." : "")) + '</div>';
  } else if (iaDispo() && !ia) {
    h += '<p class="aide" style="margin-top:14px">Pas ce que tu cherchais ? Appuie sur Entrée : Claude relit tout et comprend les demandes floues.</p>';
  }
  return h;
}

/* ==================================================================
   RECETTES
   ================================================================== */

function vueRecettes() {
  var toutes = recents(tousItems().filter(estRecette));
  var f = ICI.rec.filtres;
  var liste = toutes.filter(function (it) {
    return f.every(function (k) { var d = FILTRES_REC.filter(function (x) { return x[0] === k; })[0]; return d ? d[2](it) : true; });
  });
  var demandes = ingredientsDemandes(ICI.rec.frigo);
  var avecFrigo = demandes.length > 0;
  var lignes = liste.map(function (it) { return { it: it, m: avecFrigo ? correspondanceFrigo(it, demandes) : null }; });
  if (avecFrigo) {
    lignes = lignes.filter(function (l) { return l.m; });
    lignes.sort(function (a, b) { return b.m.nbUtilises - a.m.nbUtilises || a.m.manque.length - b.m.manque.length; });
  }
  var h = '<div class="card"><header><span class="tache t-peche"><span class="illu st-pasteque" aria-hidden="true"></span></span><h2>Qu\'est-ce que je cuisine ?</h2><span class="hint">Parmi mes recettes</span></header><div class="body">' +
    '<form class="frigo" id="formFrigo"><input type="text" id="frigo" autocomplete="off" aria-label="Ingrédients disponibles" placeholder="J\'ai du poulet, des courgettes et du parmesan" value="' + esc(ICI.rec.frigo) + '">' +
    (ICI.rec.frigo ? '<button type="button" class="btn ghost" data-action="effacer-frigo">Effacer</button>' : "") + '</form>' +
    '<p class="aide" style="margin-top:8px">Sel, poivre, huile, sucre, farine et beurre sont comptés comme déjà dans le placard.</p>' +
    '<div class="chips" style="margin-top:14px">' + FILTRES_REC.map(function (x) {
      return '<button type="button" class="chip" data-action="filtre-rec" data-f="' + x[0] + '" aria-pressed="' + (f.indexOf(x[0]) >= 0) + '">' + x[1] + '</button>';
    }).join("") + '</div></div></div>';

  h += '<div class="titre-sec"><h2>' + (avecFrigo ? "Avec ce que tu as" : "Mes recettes") + '</h2><span class="lab">' + pluriel(lignes.length, "recette") + (toutes.length !== lignes.length ? " sur " + toutes.length : "") + '</span></div>';
  if (!toutes.length) return h + vide("fraise", "Aucune recette pour l'instant. Enregistre une vidéo de cuisine, elle arrivera ici avec ses ingrédients.");
  if (!lignes.length) return h + vide("framboise", avecFrigo ? "Aucune de tes recettes n'utilise ces ingrédients." : "Aucune recette ne coche tous ces filtres.");
  return h + '<div class="grille-rec">' + lignes.map(function (l) { return carteRecette(l.it, l.m); }).join("") + '</div>';
}

function carteRecette(it, m) {
  var r = it.recette || {};
  var ingr = (r.ingredients || []).map(function (i) { return i.nom; }).filter(function (n) {
    return !BASIQUES.some(function (b) { return norm(n).indexOf(b) === 0; });
  }).slice(0, 5);
  var h = '<button type="button" class="rec" data-action="fiche" data-id="' + esc(it.id) + '">' + vis(it, "4 / 3") +
    '<span class="corps"><h3>' + esc(r.nom || it.titre) + '</h3><span class="infos">' +
      (r.temps ? '<span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/></svg>' + r.temps + ' min</span>' : "") +
      (r.difficulte ? '<span>' + esc(r.difficulte) + '</span>' : "") +
      (r.portions ? '<span>' + r.portions + ' pers.</span>' : "") +
      '<span>' + esc(nomPlat(it.plateforme)) + '</span>' +
    '</span>' +
    (ingr.length ? '<span class="ingr">' + esc(ingr.join(" · ")) + '</span>' : '<span class="ingr">Ingrédients non détaillés : ouvre la fiche pour les ajouter.</span>');
  if (m) {
    var tot = m.ok.length + m.manque.length;
    h += '<span class="couverture">Tu as ' + m.ok.length + ' ingrédient' + (m.ok.length > 1 ? "s" : "") + ' sur ' + tot + '</span>' +
      '<span class="jauge"><i style="width:' + Math.round(m.ok.length / tot * 100) + '%"></i></span>' +
      (m.manque.length ? '<span class="manque">Il manque : ' + esc(m.manque.slice(0, 4).join(", ")) + (m.manque.length > 4 ? "…" : "") + '</span>' : '<span class="manque">Il ne manque rien.</span>');
  }
  return h + '</span></button>';
}

/* ==================================================================
   TOUT
   ================================================================== */

function filtrerTout() {
  var t = ICI.tout, maint = Date.now();
  var liste = tousItems();
  if (t.plat) liste = liste.filter(function (it) { return it.plateforme === t.plat; });
  if (t.cat === "__non") liste = liste.filter(function (it) { return !catsValides(it).length; });
  else if (t.cat) liste = liste.filter(function (it) { return dansCat(it, t.cat); });
  if (t.createur) liste = liste.filter(function (it) { return (it.createur || "") === t.createur; });
  if (t.type) liste = liste.filter(function (it) { return it.type === t.type; });
  if (t.coll) liste = liste.filter(function (it) { return (it.collections || []).indexOf(t.coll) >= 0; });
  if (t.fav) liste = liste.filter(function (it) { return it.favori; });
  if (t.acompleter) liste = liste.filter(aCompleter);
  if (t.periode) {
    var jours = { "7": 7, "30": 30, "365": 365 }[t.periode];
    liste = liste.filter(function (it) {
      var d = it.ajoute || it.importe || 0;
      return t.periode === "vieux" ? d < maint - 365 * 864e5 : d >= maint - jours * 864e5;
    });
  }
  if (t.doublons) {
    var ids = {};
    groupesDoublons().forEach(function (g) { g.forEach(function (id) { ids[id] = 1; }); });
    liste = liste.filter(function (it) { return ids[it.id]; });
    liste.sort(function (a, b) { return (cleSimilaire(a) || "").localeCompare(cleSimilaire(b) || ""); });
    return liste;
  }
  if (t.texte.trim()) {
    var r = rechercher(t.texte, liste);
    return r.exacts.concat(r.proches);
  }
  if (t.tri === "ancien") liste.sort(function (a, b) { return (a.ajoute || a.importe || 0) - (b.ajoute || b.importe || 0); });
  else if (t.tri === "titre") liste.sort(function (a, b) { return (a.titre || "").localeCompare(b.titre || "", "fr"); });
  else liste = recents(liste);
  return liste;
}

function options(liste, valeur) {
  return liste.map(function (o) {
    return '<option value="' + esc(o[0]) + '"' + (o[0] === valeur ? " selected" : "") + '>' + esc(o[1]) + '</option>';
  }).join("");
}

function optionsCats(valeur, avecNon) {
  var h = avecNon ? '<option value="__non"' + (valeur === "__non" ? " selected" : "") + '>Non classés</option>' : "";
  parents().forEach(function (p) {
    h += '<optgroup label="' + esc(p.nom) + '"><option value="' + esc(p.id) + '"' + (valeur === p.id ? " selected" : "") + '>' + esc(p.nom) + ' (tout)</option>' +
      enfants(p.id).map(function (c) { return '<option value="' + esc(c.id) + '"' + (valeur === c.id ? " selected" : "") + '>' + esc(c.nom) + '</option>'; }).join("") + '</optgroup>';
  });
  return h;
}

function vueTout() {
  var t = ICI.tout, items = tousItems();
  var plats = {}, createurs = {}, types = {};
  items.forEach(function (it) {
    plats[it.plateforme] = 1;
    if (it.createur) createurs[it.createur] = (createurs[it.createur] || 0) + 1;
    types[it.type] = 1;
  });
  var listeCreateurs = Object.keys(createurs).sort(function (a, b) { return createurs[b] - createurs[a] || a.localeCompare(b); }).slice(0, 300);
  var colls = Object.keys(Store.colls).map(function (k) { return Store.colls[k]; }).sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });

  var h = '<div class="filtres">' +
    '<input type="text" id="toutTexte" autocomplete="off" aria-label="Filtrer par mots" placeholder="Filtrer par mots…" value="' + esc(t.texte) + '">' +
    '<select id="fPlat" aria-label="Plateforme"><option value="">Toutes les plateformes</option>' + options(Object.keys(plats).map(function (k) { return [k, nomPlat(k)]; }), t.plat) + '</select>' +
    '<select id="fCat" aria-label="Catégorie"><option value="">Toutes les catégories</option>' + optionsCats(t.cat, true) + '</select>' +
    '<select id="fCreateur" aria-label="Créateur"><option value="">Tous les créateurs</option>' + options(listeCreateurs.map(function (c) { return [c, "@" + c + " (" + createurs[c] + ")"]; }), t.createur) + '</select>' +
    '<select id="fType" aria-label="Type de contenu"><option value="">Tous les types</option>' + options(Object.keys(types).map(function (k) { return [k, TYPES[k] || k]; }), t.type) + '</select>' +
    '<select id="fPeriode" aria-label="Date"><option value="">Toutes les dates</option>' + options([["7", "7 derniers jours"], ["30", "30 derniers jours"], ["365", "Cette année"], ["vieux", "Il y a plus d'un an"]], t.periode) + '</select>' +
    (colls.length ? '<select id="fColl" aria-label="Collection"><option value="">Toutes les collections</option>' + options(colls.map(function (c) { return [c.id, c.nom]; }), t.coll) + '</select>' : "") +
    '<select id="fTri" aria-label="Tri">' + options([["recent", "Plus récents"], ["ancien", "Plus anciens"], ["titre", "Par titre"]], t.tri) + '</select>' +
  '</div>' +
  '<div class="chips" style="margin-bottom:16px">' +
    '<button type="button" class="chip" data-action="toggle-tout" data-k="fav" aria-pressed="' + t.fav + '">Favoris</button>' +
    '<button type="button" class="chip" data-action="toggle-tout" data-k="acompleter" aria-pressed="' + t.acompleter + '">À compléter</button>' +
    '<button type="button" class="chip" data-action="toggle-tout" data-k="doublons" aria-pressed="' + t.doublons + '">Doublons possibles</button>' +
    (filtresActifs() ? '<button type="button" class="chip" data-action="reset-tout"><span class="x">×</span>Effacer les filtres</button>' : "") +
  '</div>';

  var liste = filtrerTout();
  h += '<div class="barre-outils"><span class="compte">' + pluriel(liste.length, "pépite") + (liste.length !== items.length ? " sur " + items.length : "") + '</span>' +
    (ICI.modeSel ? '<button type="button" class="btn ghost sm" data-action="tout-selectionner">Tout sélectionner</button>' : "") +
    '<button type="button" class="btn ' + (ICI.modeSel ? "go" : "ghost") + ' sm" data-action="mode-sel">' + (ICI.modeSel ? "Terminer" : "Sélectionner") + '</button></div>';
  if (t.doublons && liste.length) h += '<p class="aide" style="margin:-6px 0 14px">Contenus au titre ou à la recette très proches. Ouvre-en un pour les fusionner.</p>';
  if (!items.length) return h + vide("hippocampe", "Ta bibliothèque est vide. Ajoute un lien ou importe un export.");
  if (!liste.length) return h + vide("corail", "Rien ne correspond à ces filtres.");
  h += mur(liste.slice(0, ICI.limite));
  if (liste.length > ICI.limite) h += '<div style="text-align:center;margin-top:10px"><button type="button" class="btn ghost" data-action="plus">Afficher ' + Math.min(60, liste.length - ICI.limite) + ' de plus</button></div>';
  return h;
}
function filtresActifs() {
  var t = ICI.tout;
  return !!(t.texte || t.plat || t.cat || t.createur || t.type || t.periode || t.coll || t.fav || t.acompleter || t.doublons);
}

/* ==================================================================
   CATÉGORIES ET COLLECTIONS
   ================================================================== */

function nbDansCat(id) { return tousItems().filter(function (it) { return dansCat(it, id); }).length; }

function blocEditionCat(e) {
  var c = e.id ? Store.cats[e.id] : null;
  if (e.mode === "nouvelle" || e.mode === "nouvelle-sous") {
    return '<form class="edit-bloc" data-form="cat-creer"><div class="field"><label for="catNom">' + (e.mode === "nouvelle" ? "Nouvelle catégorie" : "Nouvelle sous-catégorie de " + esc(c.nom)) + '</label>' +
      '<input type="text" id="catNom" maxlength="40" autocomplete="off" placeholder="' + (e.mode === "nouvelle" ? "Ex. Jardinage" : "Ex. Brunch") + '"></div>' +
      '<button type="submit" class="btn go">Créer</button><button type="button" class="btn ghost" data-action="cat-annuler">Annuler</button></form>';
  }
  if (!c) return "";
  if (e.mode === "menu") {
    return '<div class="edit-bloc"><span style="flex:1 1 auto;font-weight:600">' + esc(c.nom) + ' · ' + pluriel(nbDansCat(c.id), "contenu") + '</span>' +
      '<button type="button" class="btn ghost sm" data-action="voir-cat" data-cat="' + esc(c.id) + '">Voir</button>' +
      '<button type="button" class="btn ghost sm" data-action="cat-mode" data-id="' + esc(c.id) + '" data-mode="renommer">Renommer</button>' +
      '<button type="button" class="btn ghost sm" data-action="cat-mode" data-id="' + esc(c.id) + '" data-mode="fusionner">Fusionner</button>' +
      '<button type="button" class="btn ghost sm" data-action="cat-mode" data-id="' + esc(c.id) + '" data-mode="supprimer">Supprimer</button>' +
      '<button type="button" class="btn ghost sm" data-action="cat-annuler">Fermer</button></div>';
  }
  if (e.mode === "renommer") {
    return '<form class="edit-bloc" data-form="cat-renommer"><div class="field"><label for="catNom">Renommer « ' + esc(c.nom) + ' »</label>' +
      '<input type="text" id="catNom" maxlength="40" autocomplete="off" value="' + esc(c.nom) + '"></div>' +
      '<button type="submit" class="btn go">Enregistrer</button><button type="button" class="btn ghost" data-action="cat-annuler">Annuler</button></form>';
  }
  if (e.mode === "fusionner") {
    var cibles = "";
    parents().forEach(function (p) {
      var opts = (p.id !== c.id ? '<option value="' + esc(p.id) + '">' + esc(p.nom) + '</option>' : "") +
        (c.parent ? enfants(p.id).filter(function (s) { return s.id !== c.id; }).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(p.nom) + ' › ' + esc(s.nom) + '</option>'; }).join("") : "");
      if (opts) cibles += '<optgroup label="' + esc(p.nom) + '">' + opts + '</optgroup>';
    });
    return '<form class="edit-bloc" data-form="cat-fusionner"><div class="field"><label for="catCible">Fusionner « ' + esc(c.nom) + ' » dans</label>' +
      '<select id="catCible">' + cibles + '</select></div>' +
      '<button type="submit" class="btn go">Fusionner</button><button type="button" class="btn ghost" data-action="cat-annuler">Annuler</button>' +
      '<p class="aide" style="flex-basis:100%">Ses ' + pluriel(nbDansCat(c.id), "contenu") + ' passent dans la catégorie choisie' + (c.parent ? "" : ", ses sous-catégories aussi") + '. « ' + esc(c.nom) + ' » disparaît.</p></form>';
  }
  if (e.mode === "supprimer") {
    return '<div class="edit-bloc"><p style="flex:1 1 260px;font-size:.9rem">Supprimer « ' + esc(c.nom) + ' »' + (c.parent ? "" : " et ses sous-catégories") + ' ? Ses ' + pluriel(nbDansCat(c.id), "contenu") + ' restent dans l\'appli ; sans autre catégorie, ils passent en « Non classés ».</p>' +
      '<button type="button" class="btn danger" data-action="cat-supprimer" data-id="' + esc(c.id) + '">Supprimer</button><button type="button" class="btn ghost" data-action="cat-annuler">Annuler</button></div>';
  }
  return "";
}

function vueCategories() {
  var e = ICI.catEdit;
  var h = '<div class="card"><header><span class="tache t-lavande b3"><span class="illu st-coquillage" aria-hidden="true"></span></span><h2>Mes catégories</h2>' +
    '<button type="button" class="btn go sm" data-action="cat-mode" data-mode="nouvelle">Nouvelle catégorie</button></header><div class="body tight">';
  if (e && e.mode === "nouvelle") h += blocEditionCat(e);
  parents().forEach(function (p, i) {
    var subs = enfants(p.id);
    h += '<div class="cat-ligne"><span class="tache t-' + teinteCat(p) + ' b' + (i % 4 + 1) + '"><span class="illu st-' + stickerCat(p) + '" aria-hidden="true"></span></span>' +
      '<div class="nom"><h3>' + esc(p.nom) + '</h3><p>' + pluriel(nbDansCat(p.id), "contenu") + ' · ' + pluriel(subs.length, "sous-catégorie") + (p.auto ? " · créée par l'analyse" : "") + '</p></div>' +
      '<div class="actions"><button type="button" class="btn ghost sm" data-action="voir-cat" data-cat="' + esc(p.id) + '">Voir</button>' +
      '<button type="button" class="btn ghost sm" data-action="cat-mode" data-id="' + esc(p.id) + '" data-mode="renommer">Renommer</button>' +
      '<button type="button" class="btn ghost sm" data-action="cat-mode" data-id="' + esc(p.id) + '" data-mode="fusionner">Fusionner</button>' +
      '<button type="button" class="btn ghost sm" data-action="cat-mode" data-id="' + esc(p.id) + '" data-mode="supprimer">Supprimer</button></div></div>';
    if (e && e.id === p.id && e.mode !== "nouvelle-sous") h += blocEditionCat(e);
    h += '<div class="sous-liste">' + subs.map(function (s) {
      var n = nbDansCat(s.id);
      return '<button type="button" class="chip" data-action="cat-mode" data-id="' + esc(s.id) + '" data-mode="menu" aria-pressed="' + !!(e && e.id === s.id) + '">' + esc(s.nom) + ' <b style="opacity:.6;font-weight:600">' + n + '</b></button>';
    }).join("") + '<button type="button" class="chip" data-action="cat-mode" data-id="' + esc(p.id) + '" data-mode="nouvelle-sous"><span class="x">+</span>Sous-catégorie</button></div>';
    subs.forEach(function (s) { if (e && e.id === s.id) h += blocEditionCat(e); });
    if (e && e.id === p.id && e.mode === "nouvelle-sous") h += blocEditionCat(e);
  });
  h += '</div></div>';

  var colls = Object.keys(Store.colls).map(function (k) { return Store.colls[k]; }).sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });
  var ce = ICI.collEdit;
  h += '<div class="card"><header><span class="tache t-rose b2"><span class="illu st-noeud" aria-hidden="true"></span></span><h2>Mes collections</h2><span class="hint">Tes sélections, à la main</span></header><div class="body tight">';
  colls.forEach(function (c) {
    var n = tousItems().filter(function (it) { return (it.collections || []).indexOf(c.id) >= 0; }).length;
    h += '<div class="cat-ligne"><div class="nom"><h3>' + esc(c.nom) + '</h3><p>' + pluriel(n, "contenu") + '</p></div><div class="actions">' +
      '<button type="button" class="btn ghost sm" data-action="voir-coll" data-id="' + esc(c.id) + '">Voir</button>' +
      '<button type="button" class="btn ghost sm" data-action="coll-mode" data-id="' + esc(c.id) + '" data-mode="renommer">Renommer</button>' +
      '<button type="button" class="btn ghost sm" data-action="coll-mode" data-id="' + esc(c.id) + '" data-mode="supprimer">Supprimer</button></div></div>';
    if (ce && ce.id === c.id && ce.mode === "renommer") {
      h += '<form class="edit-bloc" data-form="coll-renommer"><div class="field"><label for="collNom">Renommer</label><input type="text" id="collNom" maxlength="50" value="' + esc(c.nom) + '"></div>' +
        '<button type="submit" class="btn go">Enregistrer</button><button type="button" class="btn ghost" data-action="coll-annuler">Annuler</button></form>';
    }
    if (ce && ce.id === c.id && ce.mode === "supprimer") {
      h += '<div class="edit-bloc"><p style="flex:1 1 240px;font-size:.9rem">Supprimer la collection « ' + esc(c.nom) + ' » ? Ses contenus restent dans l\'appli.</p>' +
        '<button type="button" class="btn danger" data-action="coll-supprimer" data-id="' + esc(c.id) + '">Supprimer</button><button type="button" class="btn ghost" data-action="coll-annuler">Annuler</button></div>';
    }
  });
  h += '<form class="edit-bloc" data-form="coll-creer" style="border-bottom:0"><div class="field"><label for="collNouveau">Nouvelle collection</label>' +
    '<input type="text" id="collNouveau" maxlength="50" autocomplete="off" placeholder="Ex. Week-end à Lisbonne"></div><button type="submit" class="btn go">Créer</button></form>';
  if (!colls.length) h += '<p class="aide" style="padding:0 18px 16px">Une collection regroupe des pépites de toutes catégories : un voyage, un dîner à préparer, une liste d\'envies. Ajoute-les depuis une fiche ou par sélection dans « Tout ».</p>';
  h += '</div></div>';
  return h;
}

/* ==================================================================
   RÉGLAGES
   ================================================================== */

function blocSource(k, sticker, teinte) {
  var p = PLATEFORMES[k], s = (Store.reg.sources || {})[k];
  var n = tousItems().filter(function (it) { return it.plateforme === k; }).length;
  var conf = ICI.confirm && ICI.confirm.quoi === "source-" + k;
  var h = '<div class="card"><header><span class="tache t-' + teinte + '"><span class="illu st-' + sticker + '" aria-hidden="true"></span></span><h2>' + p.nom + '</h2>' +
    '<span class="hint">' + (s && s.dernier ? "Importé" : "Non importé") + '</span></header><div class="body">' +
    '<p class="etat-src" style="font-size:.92rem;color:var(--ink-soft)">' + (s && s.dernier
      ? 'Dernier import le <b>' + dateCourte(s.dernier) + '</b> · ' + pluriel(s.nombre || 0, "élément") + ' trouvé' + ((s.nombre || 0) > 1 ? "s" : "") + '. <b>' + n + '</b> ' + p.nom + ' dans l\'appli.'
      : (n ? '<b>' + n + '</b> contenu' + (n > 1 ? "s" : "") + ' ' + p.nom + ' ajouté' + (n > 1 ? "s" : "") + ' par lien. ' : "") + 'Aucun export importé.') + '</p>' +
    '<div class="boutons"><button type="button" class="btn go sm" data-action="ouvrir-ajout" data-onglet="export" data-plat="' + k + '">Importer mon export</button>' +
    '<button type="button" class="btn ghost sm" disabled title="Nécessite la version serveur">Connexion directe : indisponible ici</button>' +
    (k === "instagram" && tousItems().some(function (it) { return (it.collectionsOrigine || []).length; }) ? '<button type="button" class="btn ghost sm" data-action="recreer-collections">Recréer mes collections Instagram</button>' : "") +
    (s || n ? '<button type="button" class="btn ghost sm" data-action="confirmer" data-quoi="source-' + k + '">Déconnecter</button>' : "") + '</div>';
  if (conf) {
    h += '<div class="confirm">Déconnecter ' + p.nom + ' oublie l\'historique d\'import. Veux-tu aussi retirer ses ' + pluriel(n, "contenu") + ' de l\'appli ? Les originaux restent sur ' + p.nom + '.' +
      '<div class="boutons"><button type="button" class="btn ghost sm" data-action="deconnecter" data-plat="' + k + '" data-garder="1">Déconnecter, garder les contenus</button>' +
      '<button type="button" class="btn danger sm" data-action="deconnecter" data-plat="' + k + '">Déconnecter et retirer ' + pluriel(n, "contenu") + '</button>' +
      '<button type="button" class="btn ghost sm" data-action="annuler-confirm">Annuler</button></div></div>';
  }
  h += '<h3 style="font-size:1rem;margin:20px 0 4px">Ce que l\'API officielle permet</h3><table class="api-table"><tbody>' +
    p.api.map(function (a) {
      var lab = { ok: "Oui", non: "Non", partiel: "En partie" }[a[0]];
      return '<tr><td><span class="tag ' + a[0] + '">' + lab + '</span></td><td><b>' + esc(a[1]) + '</b><span>' + esc(a[2]) + '</span></td></tr>';
    }).join("") + '</tbody></table>' +
    '</div></div>';
  return h;
}

function vueReglages() {
  var items = tousItems(), reg = Store.reg;
  var nAC = items.filter(aCompleter).length, nDemo = items.filter(function (it) { return it.demo; }).length;
  var nNonIA = items.filter(function (it) { return !(it.analyse && it.analyse.par === "ia") && !it.demo; }).length;
  var h = '<div class="titre-sec" style="margin-top:0"><h2>Comptes et réglages</h2><button type="button" class="lien" data-action="vue" data-vue="accueil">‹ Retour</button></div>';
  h += '<p class="prose" style="margin-bottom:18px">Aucun mot de passe Instagram ou TikTok n\'est demandé ni gardé. Ni Instagram ni TikTok ne laissent aujourd\'hui une appli lire tes enregistrements automatiquement : l\'import passe par l\'export officiel de tes données, et le quotidien par le partage de liens. Les tableaux ci-dessous disent ce que chaque API permet vraiment.</p>';
  h += blocSource("instagram", "hibiscus", "rose") + blocSource("tiktok", "meduse", "lavande");

  h += '<div class="card"><header><span class="tache t-jaune b2"><span class="illu st-ballon" aria-hidden="true"></span></span><h2>Bientôt</h2><span class="hint">Architecture prête</span></header><div class="body">' +
    '<div class="bientot">' + BIENTOT.map(function (b) { return '<div><b>' + esc(b[0]) + '</b>' + esc(b[1]) + '</div>'; }).join("") + '</div></div></div>';

  h += '<div class="card"><header><span class="tache t-lavande b3"><span class="illu st-etoile" aria-hidden="true"></span></span><h2>Analyse et classement</h2><span class="hint">' + (iaDispo() ? "Claude actif" : "Règles locales") + '</span></header><div class="body">' +
    '<p class="prose">' + (iaDispo()
      ? "Claude lit le lien, l'auteur, la légende, ta note et, si tu en ajoutes une, la capture d'écran. Il titre, classe, extrait les recettes et les lieux. Chaque analyse compte sur ton forfait Claude."
      : (EN_ARTIFACT ? "Claude n'est pas disponible dans cette vue. " : "Hors de claude.ai, Claude n'est pas joignable. ") + "Le classement se fait par mots-clés : rapide, mais plus grossier. Les recettes écrites dans la légende sont quand même extraites.") + '</p>' +
    (iaDispo() ? '<label class="interrupteur" style="margin-top:14px"><input type="checkbox" id="iaAuto"' + (reg.iaAuto ? " checked" : "") + '>Analyser automatiquement chaque nouvel ajout</label>' : "") +
    '<div class="boutons">' +
      (iaDispo() && nAC ? '<button type="button" class="btn go sm" data-action="analyser" data-quoi="acompleter">Analyser les ' + pluriel(nAC, "élément") + ' à compléter</button>' : "") +
      (iaDispo() && nNonIA ? '<button type="button" class="btn ghost sm" data-action="analyser" data-quoi="nonia">Repasser ' + pluriel(nNonIA, "élément") + ' classé' + (nNonIA > 1 ? "s" : "") + ' par règles</button>' : "") +
      (items.length ? '<button type="button" class="btn ghost sm" data-action="reclasser-regles">Reclasser par règles</button>' : "") +
    '</div></div></div>';

  var cloud = Store.mode === "cloud";
  h += '<div class="card"><header><span class="tache t-peche b4"><span class="illu st-peche" aria-hidden="true"></span></span><h2>Mon espace</h2></header><div class="body">' +
    '<form class="ajout-ligne" data-form="prenom"><div class="field"><label for="prenom">Prénom</label><input type="text" id="prenom" maxlength="40" autocomplete="given-name" value="' + esc(reg.prenom) + '"></div><button type="submit" class="btn ghost" style="align-self:flex-end">Enregistrer</button></form>' +
    '<p class="sync ' + (cloud ? "cloud" : "local") + '" style="margin-top:14px"><span class="dot"></span>' + (cloud
      ? "Espace privé lié à ton compte claude.ai : tu le retrouves sur tous tes appareils, et personne d'autre ne le voit, même si tu partages cette page."
      : "Enregistré dans ce navigateur uniquement. " + (EN_ARTIFACT ? "Le compte claude.ai n'a pas répondu : tes ajouts seront recopiés dans ton espace dès qu'il répond." : "Ouvre l'appli depuis claude.ai pour la retrouver sur tous tes appareils.")) + '</p>' +
    (Ecritures.erreurs ? '<p class="aide" style="margin-top:6px">' + pluriel(Ecritures.erreurs, "enregistrement") + ' n\'' + (Ecritures.erreurs > 1 ? "ont" : "a") + ' pas abouti pendant cette visite.</p>' : "") +
    '</div></div>';

  var c = ICI.confirm && ICI.confirm.quoi;
  h += '<div class="card"><header><span class="tache t-rose b2"><span class="illu st-grenade" aria-hidden="true"></span></span><h2>Mes données</h2></header><div class="body">' +
    '<p class="prose">Tout ce que l\'appli sait est ici : les liens, ce que tu as écrit et ce que l\'analyse en a tiré. Retirer un élément ne touche jamais à l\'original sur Instagram ou TikTok.</p>' +
    '<div class="boutons">' +
      (items.length ? '<button type="button" class="btn go sm" data-action="exporter">Exporter mes données (JSON)</button>' : "") +
      (nDemo ? '<button type="button" class="btn ghost sm" data-action="retirer-exemples">Retirer les ' + nDemo + ' exemples</button>' : "") +
      (items.length ? '<button type="button" class="btn ghost sm" data-action="confirmer" data-quoi="vider">Supprimer tous les contenus</button>' : "") +
      '<button type="button" class="btn ghost sm" data-action="confirmer" data-quoi="compte">Supprimer mon compte</button>' +
    '</div>' +
    (c === "vider" ? '<div class="confirm">Supprimer les ' + pluriel(items.length, "contenu") + ' de l\'appli ? Les catégories et collections restent. Les originaux restent sur leurs plateformes.<div class="boutons"><button type="button" class="btn danger sm" data-action="vider">Supprimer les contenus</button><button type="button" class="btn ghost sm" data-action="annuler-confirm">Annuler</button></div></div>' : "") +
    (c === "compte" ? '<div class="confirm">Supprimer définitivement ton espace : contenus, catégories, collections, réglages et historique. Rien ne peut être récupéré ensuite. Pense à exporter d\'abord.<div class="boutons"><button type="button" class="btn danger sm" data-action="supprimer-compte">Tout supprimer</button><button type="button" class="btn ghost sm" data-action="annuler-confirm">Annuler</button></div></div>' : "") +
    '<div id="exportSecours"></div>' +
    '</div></div>';

  var histo = reg.historique || [];
  h += '<div class="card"><header><span class="tache t-jaune b4"><span class="illu st-tortue" aria-hidden="true"></span></span><h2>Historique</h2><span class="hint">' + pluriel(histo.length, "événement") + '</span></header><div class="body">' +
    (histo.length ? '<ul class="histo">' + histo.slice(0, 40).map(function (e) { return '<li><time>' + dateHeure(e.t) + '</time><span>' + esc(e.txt) + '</span></li>'; }).join("") + '</ul>' : vide("ourson", "Rien encore.")) +
    '</div></div>';
  return h;
}
