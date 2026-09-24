
/* ==================================================================
   CATÉGORIES : lecture
   ================================================================== */

function parents() {
  return Object.keys(Store.cats).map(function (k) { return Store.cats[k]; })
    .filter(function (c) { return !c.parent; })
    .sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0) || a.nom.localeCompare(b.nom, "fr"); });
}
function enfants(pid) {
  return Object.keys(Store.cats).map(function (k) { return Store.cats[k]; })
    .filter(function (c) { return c.parent === pid; })
    .sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0) || a.nom.localeCompare(b.nom, "fr"); });
}
function parentDe(cid) { var c = Store.cats[cid]; return c ? (c.parent || c.id) : null; }
function catsValides(it) { return (it.cats || []).filter(function (c) { return Store.cats[c]; }); }
function parentsItem(it) {
  var s = [];
  catsValides(it).forEach(function (c) { var p = parentDe(c); if (Store.cats[p] && s.indexOf(p) < 0) s.push(p); });
  return s;
}
function dansCat(it, cid) {
  var c = Store.cats[cid];
  if (!c) return false;
  return catsValides(it).some(function (x) { return x === cid || (!c.parent && Store.cats[x].parent === cid); });
}
function libelleCats(it, max) {
  var groupes = {};
  catsValides(it).forEach(function (c) {
    var p = parentDe(c);
    if (!Store.cats[p]) return;
    groupes[p] = groupes[p] || [];
    if (Store.cats[c].parent) groupes[p].push(Store.cats[c].nom);
  });
  var l = Object.keys(groupes).map(function (p) {
    return Store.cats[p].nom + (groupes[p].length ? " › " + groupes[p].join(", ") : "");
  });
  if (max && l.length > max) l = l.slice(0, max).concat("+" + (l.length - max));
  return l.join(" · ");
}
function catVisuelle(it) {
  var p = parentsItem(it)[0];
  return p ? Store.cats[p] : null;
}
function stickerCat(c) { return (c && c.sticker) || "meduse"; }
// Chaque univers pioche dans sa propre famille d'aquarelles, pour que le mur
// ne répète pas dix fois le même dessin.
var FAMILLES = {
  recettes: ["pasteque", "fraise", "framboise", "peche", "orange", "pamplemousse", "grenade", "homard"],
  voyages: ["tortue", "coquillage", "poisson", "hippocampe", "corail", "frangipanier"],
  mode: ["noeud", "hibiscus", "lys"],
  beaute: ["lys", "hibiscus", "frangipanier"],
  maison: ["coquillage", "verre", "ourson"],
  films: ["etoile", "ourson", "ballon"],
  idees: ["soleil", "etoile", "ballon"]
};
function stickerItem(it, c) {
  var f = c && FAMILLES[c.id];
  return f ? f[parseInt(hash(it.id), 36) % f.length] : stickerCat(c);
}
function teinteCat(c) { return (c && c.teinte) || "rose"; }

function trouverCat(nom, parent) {
  var n = norm(nom).trim();
  var liste = parent ? enfants(parent) : parents();
  for (var i = 0; i < liste.length; i++) if (norm(liste[i].nom).trim() === n) return liste[i];
  // « Dessert » retrouve « Desserts », « Hotel » retrouve « Hôtels ».
  var r = mots(nom).map(racine).join(" ");
  for (i = 0; i < liste.length; i++) if (mots(liste[i].nom).map(racine).join(" ") === r) return liste[i];
  return null;
}
function creerCat(nom, parent) {
  nom = sansEmoji(nom).slice(0, 40);
  if (!nom) return null;
  var base = parent ? parent + ":" + slug(nom) : slug(nom), id = base, n = 2;
  while (Store.cats[id]) id = base + "-" + (n++);
  var c = { id: id, nom: nom.charAt(0).toUpperCase() + nom.slice(1), parent: parent || null, ordre: 100 + Object.keys(Store.cats).length, cree: Date.now(), auto: true };
  if (!parent) {
    var pris = parents().map(function (p) { return p.sticker; });
    c.sticker = STICKERS.filter(function (s) { return pris.indexOf(s) < 0; })[0] || STICKERS[Object.keys(Store.cats).length % STICKERS.length];
    c.teinte = TEINTES[parents().length % TEINTES.length];
  }
  sauverCat(c);
  return c;
}

/* ==================================================================
   CLASSEMENT PAR RÈGLES
   Ce qui tourne sans Claude : un lexique par univers. Il range vite et
   grossièrement ; l'analyse par Claude repasse derrière quand elle peut.
   ================================================================== */

var LEXIQUE = {
  recettes: {
    mots: ["recette", "recipe", "ingredient", "cuisine", "cuisin", "four", "poele", "cuisson", "cuill", "gramme", "pate", "pasta", "poulet", "chicken", "gateau", "cake", "cookie", "dessert", "salade", "soupe", "sauce", "tarte", "brunch", "food", "foodie", "miam", "yummy", "healthy", "fait maison", "homemade", "airfryer", "batch cooking", "risotto", "curry", "pancake", "tiramisu", "brownie", "granola", "smoothie", "bowl", "quiche", "lasagne", "gratin"],
    sous: {
      "Petit-déjeuner": ["petit dej", "petit-dej", "breakfast", "pancake", "granola", "porridge", "overnight", "brunch", "tartine", "toast", "crepe"],
      "Déjeuner": ["dejeuner", "lunch", "lunchbox", "salade composee", "wrap", "sandwich"],
      "Dîner": ["diner", "dinner", "souper", "plat du soir"],
      "Desserts": ["dessert", "gateau", "cake", "cookie", "tarte", "chocolat", "brownie", "tiramisu", "mousse", "cheesecake", "crumble", "patisserie"],
      "Apéritifs": ["apero", "aperitif", "tapas", "dip", "houmous", "planche", "amuse"],
      "Healthy": ["healthy", "leger", "proteine", "protein", "sain", "equilibre", "vegan", "detox", "low carb"],
      "Pâtes": ["pate", "pasta", "spaghetti", "tagliatelle", "penne", "linguine", "lasagne", "gnocchi", "rigatoni", "orzo"],
      "Poulet": ["poulet", "chicken", "volaille"],
      "Recettes rapides": ["rapide", "express", "10 min", "15 min", "20 min", "facile", "en 5", "quick", "easy"]
    }
  },
  voyages: {
    mots: ["voyage", "travel", "trip", "vacances", "destination", "hotel", "plage", "beach", "road trip", "itineraire", "week-end a", "visiter", "city guide", "airbnb", "vol ", "aeroport", "ile", "island", "restaurant", "resto", "trattoria", "rooftop", "adresse"],
    sous: {
      "Destinations": ["destination", "visiter", "city guide", "ile", "island", "pays", "ville"],
      "Hôtels": ["hotel", "airbnb", "hebergement", "resort", "chambre d hote", "logement", "piscine"],
      "Restaurants": ["restaurant", "resto", "trattoria", "brasserie", "bistrot", "rooftop", "ou manger", "food spot", "adresse"],
      "Activités": ["activite", "randonnee", "hike", "musee", "excursion", "plongee", "que faire"],
      "Bons plans": ["bon plan", "pas cher", "astuce voyage", "gratuit", "budget", "cheap"]
    }
  },
  mode: {
    mots: ["outfit", "ootd", "tenue", "look", "robe", "dress", "jean", "mode", "fashion", "style", "sneaker", "chaussure", "sac", "bijou", "collier", "bague", "manteau", "veste", "haul", "zara", "vinted", "capsule"],
    sous: {
      "Tenues": ["outfit", "ootd", "tenue", "look", "robe", "jean", "manteau", "veste", "capsule"],
      "Chaussures": ["chaussure", "sneaker", "basket", "boots", "bottine", "escarpin", "sandale", "mocassin"],
      "Sacs": ["sac", "bag", "tote", "pochette"],
      "Bijoux": ["bijou", "collier", "bague", "boucle d oreille", "bracelet", "jewel"],
      "Inspirations": ["inspiration", "inspo", "moodboard", "style"]
    }
  },
  sport: {
    mots: ["workout", "entrainement", "exercice", "abdo", "abs", "gainage", "squat", "fessier", "glute", "salle", "gym", "musculation", "running", "course a pied", "courir", "run ", "pilates", "yoga", "hiit", "cardio", "sport", "fitness", "stretching", "etirement", "marathon"],
    sous: {
      "Salle": ["salle", "gym", "musculation", "machine", "halteres"],
      "Running": ["running", "course a pied", "courir", "run ", "marathon", "semi", "fractionne"],
      "Exercices": ["exercice", "abdo", "abs", "gainage", "squat", "fessier", "glute", "pompes", "stretching", "etirement", "pilates", "yoga"],
      "Programmes": ["programme", "plan", "semaines", "routine", "challenge", "jours"]
    }
  },
  beaute: {
    mots: ["makeup", "maquillage", "skincare", "soin", "peau", "cheveux", "hair", "ongle", "nail", "serum", "creme", "routine beaute", "parfum", "mascara", "fond de teint", "blush", "rouge a levre", "boucle", "coiffure"],
    sous: {
      "Maquillage": ["makeup", "maquillage", "mascara", "fond de teint", "blush", "rouge a levre", "eyeliner", "contouring"],
      "Soins": ["skincare", "soin", "peau", "serum", "creme", "spf", "acne", "masque"],
      "Cheveux": ["cheveux", "hair", "boucle", "coiffure", "brushing", "tresse", "shampo"],
      "Ongles": ["ongle", "nail", "manucure", "vernis"]
    }
  },
  maison: {
    mots: ["deco", "decoration", "interior", "interieur", "salon", "chambre", "appartement", "ikea", "rangement", "organisation maison", "diy", "plante", "jardin", "home", "meuble", "renovation", "peinture murale"],
    sous: {
      "Décoration": ["deco", "decoration", "interior", "interieur", "salon", "chambre", "meuble"],
      "Rangement": ["rangement", "organisation", "placard", "dressing", "tri"],
      "DIY": ["diy", "fait main", "tuto", "bricolage", "upcycling", "renovation"],
      "Plantes": ["plante", "jardin", "bouture", "monstera", "potager"]
    }
  },
  films: {
    mots: ["film", "movie", "serie", "netflix", "prime video", "disney+", "cinema", "saison", "episode", "a regarder", "watchlist", "documentaire", "anime", "hbo", "canal+"],
    sous: {
      "Films": ["film", "movie", "cinema"],
      "Séries": ["serie", "saison", "episode", "netflix", "hbo"],
      "Documentaires": ["documentaire", "docu"]
    }
  },
  idees: {
    mots: ["astuce", "idee", "tips", "hack", "cadeau", "gift", "livre", "book", "lecture", "a tester", "organisation", "productivite", "life hack"],
    sous: {
      "Astuces": ["astuce", "tips", "hack", "life hack", "conseil"],
      "Cadeaux": ["cadeau", "gift", "noel", "anniversaire"],
      "Lectures": ["livre", "book", "lecture", "roman", "booktok"],
      "À tester": ["a tester", "a essayer", "to try"]
    }
  }
};

function texteItem(it) {
  return " " + norm([it.legende, it.note, (it.collectionsOrigine || []).join(" "), it.createur, it.titre].join(" "))
    .replace(/[^a-z0-9+]+/g, " ") + " ";
}
function compte(texte, liste) {
  var n = 0;
  liste.forEach(function (m) { if (texte.indexOf(" " + m) >= 0) n++; });
  return n;
}

function classerParRegles(it) {
  var t = texteItem(it), scores = [];
  Object.keys(LEXIQUE).forEach(function (pid) {
    if (!Store.cats[pid]) return;
    var s = compte(t, LEXIQUE[pid].mots);
    if (s) scores.push([pid, s]);
  });
  scores.sort(function (a, b) { return b[1] - a[1]; });
  var cats = [];
  scores.slice(0, 2).forEach(function (p, i) {
    if (i === 1 && p[1] < scores[0][1] / 2) return;
    var sous = LEXIQUE[p[0]].sous, trouve = false;
    Object.keys(sous).forEach(function (nom) {
      if (compte(t, sous[nom])) {
        var c = trouverCat(nom, p[0]);
        if (c) { cats.push(c.id); trouve = true; }
      }
    });
    if (!trouve) cats.push(p[0]);
  });
  // Une collection Instagram qui porte le nom d'une catégorie vaut indice.
  (it.collectionsOrigine || []).forEach(function (nomColl) {
    parents().forEach(function (p) {
      if (norm(nomColl).indexOf(racine(norm(p.nom))) >= 0 && !cats.some(function (c) { return parentDe(c) === p.id; })) cats.push(p.id);
    });
  });
  it.cats = cats;
  it.tagsAuto = motsCles(t);
  if (!it.titre) it.titre = titreParDefaut(it);
  if (cats.some(function (c) { return parentDe(c) === "recettes"; })) {
    var r = recetteDepuisLegende(it.legende);
    if (r) it.recette = r;
  }
  it.analyse = { etat: cats.length ? "fait" : "vide", par: "regles", date: Date.now() };
  return it;
}

function motsCles(t) {
  var tags = [];
  (t.match(/#[a-z0-9_]+/g) || []).forEach(function (h) { if (tags.length < 6) tags.push(h.slice(1)); });
  return tags;
}

function titreParDefaut(it) {
  var l = sansEmoji(it.legende || "").replace(/#[\wÀ-ſ]+/g, "").trim();
  if (l) {
    var phrase = l.split(/[\n.!?]/)[0].trim();
    if (phrase.length > 3) return phrase.length > 64 ? phrase.slice(0, 61).replace(/\s+\S*$/, "") + "…" : phrase;
  }
  var type = TYPES[it.type] || "Contenu";
  if (it.createur) return type + " de @" + it.createur.replace(/^@/, "");
  return type + " " + nomPlat(it.plateforme) + (it.ajoute ? " du " + dateCourte(it.ajoute) : "");
}

// Recette écrite dans la légende : « Ingrédients : … Préparation : … ».
function recetteDepuisLegende(leg) {
  if (!leg) return null;
  var l = String(leg).replace(/\r/g, "");
  var iI = l.search(/ingr[ée]dients?\s*:?/i);
  if (iI < 0) return null;
  var reste = l.slice(iI).replace(/^ingr[ée]dients?\s*:?/i, "");
  var iP = reste.search(/(pr[ée]paration|[ée]tapes?|instructions?|recette|m[ée]thode)\s*:?/i);
  var partI = iP >= 0 ? reste.slice(0, iP) : reste;
  var partP = iP >= 0 ? reste.slice(iP).replace(/^\S+\s*:?/, "") : "";
  var ingredients = partI.split(/\n|•|·|;|,(?![^(]*\))/).map(function (s) { return sansEmoji(s.replace(/^[-*–\d.)\s]+/, "")).trim(); })
    .filter(function (s) { return s && s.length < 80 && !/^#/.test(s); })
    .map(function (s) {
      var m = s.match(/^([\d.,/½¼¾]+\s*(?:g|kg|ml|cl|l|c\.? ?à ?s\.?|c\.? ?à ?c\.?|cs|cc|cuill[eè]res?(?: à (?:soupe|café))?|tasses?|pincées?|gousses?|tranches?|boîtes?)?\s*(?:de |d')?)(.+)$/i);
      return m ? { nom: m[2].trim(), qte: m[1].trim().replace(/\s*(de|d')$/i, "") } : { nom: s, qte: "" };
    }).slice(0, 25);
  var etapes = partP ? partP.split(/\n|(?:^|\s)\d+[.)]\s+/).map(function (s) { return sansEmoji(s.replace(/^[-*–\s]+/, "")).trim(); })
    .filter(function (s) { return s.length > 3 && !/^#/.test(s); }).slice(0, 15) : [];
  if (!ingredients.length) return null;
  var temps = (l.match(/(\d{1,3})\s*(?:min|minutes)\b/i) || [])[1];
  return { nom: "", ingredients: ingredients, etapes: etapes, temps: temps ? +temps : null, difficulte: null, repas: [], portions: null,
    vegetarien: null, healthy: null, nutrition: null, source: "legende" };
}

/* ==================================================================
   ANALYSE PAR CLAUDE (capacité « sample »)
   ================================================================== */

var IA = { images: {}, sample: null, limites: null, indispo: false, file: [], enCours: false, fait: 0, total: 0, ctl: null, erreur: "" };

function iaDispo() { return !!IA.sample && !IA.indispo; }

var MESSAGES_IA = {
  not_granted: "Claude n'est pas autorisé pour cette page. Tu peux l'activer depuis la fenêtre d'autorisation au prochain essai.",
  sampling_disabled: "Claude n'est pas disponible pour ce compte.",
  rate_limited: "Trop d'analyses d'un coup. Reprends dans quelques minutes.",
  session_expired: "Ta session claude.ai a expiré : reconnecte-toi puis reprends.",
  prompt_too_large: "Trop de texte d'un coup pour Claude.",
  refused: "Claude n'a pas voulu analyser ce contenu.",
  invalid_json: "La réponse de Claude était illisible. Réessaie.",
  upstream_error: "Claude n'a pas répondu. Réessaie dans un instant."
};
function messageIA(e) { return MESSAGES_IA[e && e.code] || MESSAGES_IA.upstream_error; }
function iaFatal(e) {
  var c = e && e.code;
  if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].indexOf(c) >= 0) {
    IA.indispo = true;
    return true;
  }
  return false;
}

function taxonomieTexte() {
  return parents().map(function (p) {
    var s = enfants(p.id).map(function (c) { return c.nom; });
    return "- " + p.nom + (s.length ? " > " + s.join(" | ") : "");
  }).join("\n");
}

var CONSIGNE_ANALYSE = [
  "Tu ranges les contenus qu'une personne francophone a enregistrés sur les réseaux sociaux (Instagram, TikTok…), pour qu'elle les retrouve sans les revoir.",
  "Pour chaque élément, déduis de quoi il parle à partir des seules informations fournies : lien, plateforme, type, créateur, légende, note personnelle, collection d'origine, image éventuelle.",
  "N'invente aucun fait. Si l'information manque (souvent : seul le lien et le créateur sont connus), reste général, laisse les champs incertains à null et baisse la confiance.",
  "",
  "Catégories existantes (Parent > sous-catégories) :",
  "@@TAXO@@",
  "",
  "Règles :",
  "- categories : 1 à 4 entrées {\"parent\": \"…\", \"sous\": \"…\" ou null}. Un contenu peut aller dans plusieurs catégories (ex. Recettes/Dîner, Recettes/Pâtes, Recettes/Poulet).",
  "- Reprends les noms existants à l'identique. Crée une sous-catégorie seulement si aucune ne convient (nom court, en français, majuscule initiale). Crée un parent seulement si aucun ne convient vraiment.",
  "- Si tu ne peux rien déduire, categories = [] et confiance = \"basse\".",
  "- titre : court (60 caractères max), descriptif, en français, sans emoji. Ex. « Pâtes crémeuses au poulet ».",
  "- resume : une ou deux phrases utiles (ce qu'on y apprend), ou null.",
  "- tags : 3 à 8 mots-clés en minuscules (ingrédients, lieux, styles, marques citées…).",
  "- recette : seulement si c'est une recette, sinon null. {\"nom\", \"ingredients\": [{\"nom\", \"qte\"}], \"etapes\": [phrases courtes à l'impératif], \"temps\": minutes au total ou null, \"difficulte\": \"Facile\"|\"Moyen\"|\"Difficile\"|null, \"repas\": sous-ensemble de [\"petit-dejeuner\",\"dejeuner\",\"diner\",\"dessert\",\"aperitif\",\"gouter\"], \"portions\": nombre ou null, \"vegetarien\": bool ou null, \"healthy\": bool ou null, \"nutrition\": {\"kcal\",\"proteines\",\"glucides\",\"lipides\"} par portion en estimation grossière ou null si trop incertain, \"source\": \"legende\" si la recette est écrite dans la légende ou visible sur l'image, \"deduit\" si tu la reconstitues à partir du nom du plat}.",
  "- lieu : pour un restaurant, un hôtel, une adresse : {\"nom\", \"ville\", \"pays\"} (champs inconnus à null), sinon null.",
  "- type : garde celui fourni sauf si l'image montre clairement autre chose (\"reel\", \"publication\", \"carrousel\", \"video\", \"short\").",
  "- confiance : \"haute\", \"moyenne\" ou \"basse\".",
  "",
  "Réponds uniquement en JSON : {\"resultats\": [{\"id\", \"titre\", \"resume\", \"type\", \"categories\", \"tags\", \"recette\", \"lieu\", \"confiance\"}]}, un résultat par élément, avec l'id reçu.",
  "",
  "Éléments :"
].join("\n");

function descriptionPourIA(it) {
  var d = { id: it.id, plateforme: nomPlat(it.plateforme), type: it.type };
  if (it.url) d.lien = it.url;
  if (it.createur) d.createur = "@" + String(it.createur).replace(/^@/, "");
  if (it.legende) d.legende = String(it.legende).slice(0, 2500);
  if (it.note) d.note = String(it.note).slice(0, 600);
  if (it.collectionsOrigine && it.collectionsOrigine.length) d.collection_origine = it.collectionsOrigine.join(", ");
  if (it.titre && it.analyse && it.analyse.par === "manuel") d.titre_actuel = it.titre;
  return d;
}

function lancerAnalyse(ids, opts) {
  opts = opts || {};
  ids.forEach(function (id) {
    var it = Store.items[id];
    if (!it) return;
    if (IA.file.indexOf(id) < 0) IA.file.push(id);
    it.analyse = Object.assign({}, it.analyse || {}, { etat: "attente" });
  });
  IA.total = IA.fait + IA.file.length;
  IA.erreur = "";
  rendreBientot();
  if (!IA.enCours) boucleAnalyse();
}

function prochainLot() {
  // Un élément avec capture d'écran part seul, avec son image.
  var premier = Store.items[IA.file[0]];
  if (premier && premier.vignette && IA.limites && IA.limites.images) return IA.file.splice(0, 1);
  var lot = [], octets = 0;
  while (IA.file.length && lot.length < 16) {
    var it = Store.items[IA.file[0]];
    if (!it) { IA.file.shift(); continue; }
    if (it.vignette && IA.limites && IA.limites.images && lot.length) break;
    var n = JSON.stringify(descriptionPourIA(it)).length;
    if (lot.length && octets + n > 14000) break;
    octets += n;
    lot.push(IA.file.shift());
  }
  return lot;
}

async function boucleAnalyse() {
  IA.enCours = true;
  rendreBientot();
  while (IA.file.length) {
    if (!iaDispo()) break;
    var lot = prochainLot();
    if (!lot.length) continue;
    try {
      await analyserLot(lot);
    } catch (e) {
      if (e && e.code === "cancelled") break;
      // Le lot revient en tête de file : rien n'est perdu.
      IA.file = lot.concat(IA.file);
      IA.erreur = messageIA(e);
      iaFatal(e);
      lot.forEach(function (id) { var it = Store.items[id]; if (it) { it.analyse = Object.assign({}, it.analyse, { etat: it.cats && it.cats.length ? "fait" : "vide" }); } });
      break;
    }
    IA.fait += lot.length;
    rendreBientot();
  }
  IA.enCours = false;
  IA.ctl = null;
  if (!IA.file.length) { IA.fait = 0; IA.total = 0; }
  rendreBientot();
}

function arreterAnalyse() {
  if (IA.ctl) IA.ctl.abort();
  IA.file.forEach(function (id) {
    var it = Store.items[id];
    if (it && it.analyse && it.analyse.etat === "attente") it.analyse.etat = it.cats && it.cats.length ? "fait" : "vide";
  });
  IA.file = []; IA.fait = 0; IA.total = 0;
  rendreBientot();
}

async function analyserLot(ids) {
  var items = ids.map(function (id) { return Store.items[id]; }).filter(Boolean);
  if (!items.length) return;
  var prompt = CONSIGNE_ANALYSE.replace("@@TAXO@@", taxonomieTexte()) + "\n" + JSON.stringify(items.map(descriptionPourIA));
  var opts = { modelTier: "default" };
  IA.ctl = new AbortController();
  opts.signal = IA.ctl.signal;
  if (items.length === 1 && items[0].vignette && IA.limites && IA.limites.images) {
    var b = await dataUrlVersBlob(IA.images[items[0].id] || items[0].vignette);
    if (b) {
      opts.images = [b];
      prompt += "\n\nL'image jointe est une capture d'écran de cet élément (miniature, légende ou texte à l'écran) : lis-la.";
    }
  }
  var rep = await IA.sample.json(prompt, opts);
  var res = (rep && rep.resultats) || [];
  res.forEach(function (r) { appliquerAnalyse(r); });
  // Ceux que Claude a oubliés retombent sur les règles.
  items.forEach(function (it) {
    if (it.analyse && it.analyse.etat === "attente") {
      it.analyse = { etat: it.cats && it.cats.length ? "fait" : "vide", par: it.analyse.par || "regles", date: Date.now() };
      sauverItem(it);
    }
  });
}

function appliquerAnalyse(r) {
  var it = r && Store.items[r.id];
  if (!it) return;
  var cats = [];
  (r.categories || []).slice(0, 5).forEach(function (c) {
    if (!c || !c.parent) return;
    var p = trouverCat(c.parent, null) || creerCat(c.parent, null);
    if (!p) return;
    var cible = p;
    if (c.sous) cible = trouverCat(c.sous, p.id) || creerCat(c.sous, p.id) || p;
    if (cats.indexOf(cible.id) < 0) cats.push(cible.id);
  });
  // Les catégories posées à la main restent.
  var manuelles = (it.catsManuelles || []).filter(function (c) { return Store.cats[c]; });
  it.cats = manuelles.concat(cats.filter(function (c) { return manuelles.indexOf(c) < 0; }));
  if (r.titre && !(it.analyse && it.analyse.titreManuel)) it.titre = sansEmoji(r.titre).slice(0, 80);
  if (r.resume) it.resume = String(r.resume).slice(0, 400);
  if (r.type && TYPES[r.type]) it.type = r.type;
  it.tagsAuto = (r.tags || []).map(function (t) { return norm(t).replace(/[^a-z0-9 -]/g, "").trim(); }).filter(Boolean).slice(0, 8);
  it.recette = r.recette && r.recette.ingredients ? nettoyerRecette(r.recette) : (cats.some(function (c) { return parentDe(c) === "recettes"; }) ? it.recette || null : null);
  it.lieu = r.lieu && (r.lieu.nom || r.lieu.ville) ? { nom: r.lieu.nom || null, ville: r.lieu.ville || null, pays: r.lieu.pays || null } : null;
  it.analyse = { etat: it.cats.length ? "fait" : "vide", par: "ia", conf: r.confiance || "moyenne", date: Date.now(), titreManuel: it.analyse && it.analyse.titreManuel };
  sauverItem(it);
}

function nettoyerRecette(r) {
  var num = function (x) { var n = parseFloat(x); return isFinite(n) && n > 0 ? Math.round(n) : null; };
  return {
    nom: sansEmoji(r.nom || "").slice(0, 80),
    ingredients: (r.ingredients || []).slice(0, 30).map(function (i) {
      return typeof i === "string" ? { nom: i, qte: "" } : { nom: String(i.nom || ""), qte: String(i.qte || "") };
    }).filter(function (i) { return i.nom; }),
    etapes: (r.etapes || []).slice(0, 20).map(String),
    temps: num(r.temps),
    difficulte: ["Facile", "Moyen", "Difficile"].indexOf(r.difficulte) >= 0 ? r.difficulte : null,
    repas: (r.repas || []).filter(function (x) { return typeof x === "string"; }),
    portions: num(r.portions),
    vegetarien: typeof r.vegetarien === "boolean" ? r.vegetarien : null,
    healthy: typeof r.healthy === "boolean" ? r.healthy : null,
    nutrition: r.nutrition && num(r.nutrition.kcal) ? {
      kcal: num(r.nutrition.kcal), proteines: num(r.nutrition.proteines), glucides: num(r.nutrition.glucides), lipides: num(r.nutrition.lipides)
    } : null,
    source: r.source === "legende" ? "legende" : "deduit"
  };
}

// Sans fetch : la page n'a pas le droit de requêter, même une URL data:.
function dataUrlVersBlob(d) {
  try {
    var m = String(d).match(/^data:([^;,]+);base64,(.*)$/);
    if (!m) return Promise.resolve(null);
    var bin = atob(m[2]), buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return Promise.resolve(new Blob([buf], { type: m[1] }));
  } catch (e) { return Promise.resolve(null); }
}

// Capture d'écran : une vignette légère pour l'affichage, une plus nette pour Claude.
async function preparerImage(fichier) {
  var bmp;
  try { bmp = await createImageBitmap(fichier); } catch (e) { return null; }
  function rendu(largeur, qualite) {
    var r = Math.min(1, largeur / bmp.width);
    var c = document.createElement("canvas");
    c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    var u = c.toDataURL("image/webp", qualite);
    if (u.indexOf("data:image/webp") !== 0) u = c.toDataURL("image/jpeg", qualite);
    return u;
  }
  return { vignette: rendu(360, .72), ia: rendu(900, .8), ratio: bmp.width / bmp.height };
}

/* ==================================================================
   CRÉATION D'ÉLÉMENTS
   ================================================================== */

function nouvelItem(r, extra) {
  var it = Object.assign({
    id: r.cle, url: r.url, plateforme: r.plateforme, type: r.type || "lien", createur: r.createur || "",
    ajoute: null, importe: Date.now(), source: "lien",
    legende: "", note: "", vignette: null,
    titre: "", resume: "", cats: [], catsManuelles: [], tagsAuto: [], tags: [], favori: false, collections: [], collectionsOrigine: [],
    recette: null, lieu: null, analyse: { etat: "attente" }
  }, extra || {});
  return it;
}

// Ajoute ou complète : un lien déjà connu n'est jamais dupliqué.
function integrer(liste, source) {
  var nouveaux = [], completes = 0;
  liste.forEach(function (e) {
    var ex = Store.items[e.r.cle];
    if (ex) {
      var change = false;
      (e.collectionsOrigine || []).forEach(function (c) {
        ex.collectionsOrigine = ex.collectionsOrigine || [];
        if (ex.collectionsOrigine.indexOf(c) < 0) { ex.collectionsOrigine.push(c); change = true; }
      });
      if (e.createur && !ex.createur) { ex.createur = e.createur; change = true; }
      if (e.legende && !ex.legende) { ex.legende = e.legende; change = true; }
      if (e.ajoute && !ex.ajoute) { ex.ajoute = e.ajoute; change = true; }
      if (change) { sauverItem(ex); completes++; }
      return;
    }
    var it = nouvelItem(e.r, {
      source: source, ajoute: e.ajoute || null,
      createur: e.createur || e.r.createur || "", legende: e.legende || "", note: e.note || "",
      collectionsOrigine: e.collectionsOrigine || [], vignette: e.vignette || null, ratio: e.ratio || null
    });
    classerParRegles(it);
    it.analyse.etat = iaDispo() && Store.reg.iaAuto ? "attente" : it.analyse.etat;
    sauverItem(it);
    // La version nette de la capture ne sert qu'à Claude : elle reste en mémoire.
    if (e.vignetteIA) IA.images[it.id] = e.vignetteIA;
    nouveaux.push(it.id);
  });
  return { nouveaux: nouveaux, completes: completes };
}

/* ==================================================================
   LECTURE DES EXPORTS
   ================================================================== */

// Parcourt tout le JSON et garde chaque lien de publication, avec la date,
// l'auteur le plus proche et le chemin des clés (pour trier favoris, likes…).
function collecterLiens(json) {
  var out = [];
  function tsDe(o) {
    if (!o || typeof o !== "object") return null;
    var t = o.timestamp || o.Date || o.date || o.creation_timestamp;
    if (typeof t === "number") return t < 1e12 ? t * 1000 : t;
    if (typeof t === "string") { var d = Date.parse(t.replace(" ", "T")); return isNaN(d) ? null : d; }
    return null;
  }
  function visite(n, chemin, titre, tsParent) {
    if (Array.isArray(n)) { n.forEach(function (x) { visite(x, chemin, titre, tsParent); }); return; }
    if (!n || typeof n !== "object") {
      return;
    }
    if (typeof n.title === "string" && n.title && !/^https?:/.test(n.title)) titre = n.title;
    var ts = tsDe(n) || tsParent;
    // Le format « string_map_data » range la date dans une valeur sœur.
    if (n.string_map_data) {
      Object.keys(n.string_map_data).forEach(function (k) { ts = tsDe(n.string_map_data[k]) || ts; });
    }
    var url = n.href || n.Link || n.link || n.url || (typeof n.value === "string" && /^https?:\/\//.test(n.value) ? n.value : null);
    if (typeof url === "string") {
      var r = reconnaitre(url);
      if (r && (r.plateforme === "instagram" || r.plateforme === "tiktok")) {
        var auteur = (typeof n.value === "string" && !/^https?:/.test(n.value)) ? n.value : titre;
        out.push({ r: r, ajoute: ts, createur: r.createur || auteur || "", chemin: chemin });
      }
    }
    Object.keys(n).forEach(function (k) {
      var v = n[k];
      if (v && typeof v === "object") visite(v, chemin + "/" + k, titre, ts);
    });
  }
  visite(json, "", "", null);
  return out;
}

// Collections Instagram : un en-tête (le nom), puis ses publications.
function collectionsInstagram(json) {
  var liste = json.saved_saved_collections || [], courante = "", map = {};
  liste.forEach(function (e) {
    var vals = Object.keys(e.string_map_data || {}).map(function (k) { return e.string_map_data[k]; });
    var avecLien = vals.filter(function (v) { return v && v.href; })[0];
    if (avecLien) {
      var r = reconnaitre(avecLien.href);
      if (r && courante) (map[r.cle] = map[r.cle] || []).push(courante);
    } else {
      var nom = vals.filter(function (v) { return v && typeof v.value === "string"; })[0];
      if (nom) courante = nom.value;
      else if (e.title) courante = e.title;
    }
  });
  return map;
}

async function lireFichiers(fichiers) {
  var docs = [];
  for (var i = 0; i < fichiers.length; i++) {
    var f = fichiers[i];
    if (/\.zip$/i.test(f.name) || f.type === "application/zip" || f.type === "application/x-zip-compressed") {
      if (!window.JSZip) throw new Error("zip");
      var zip = await window.JSZip.loadAsync(f);
      var noms = Object.keys(zip.files).filter(function (n) {
        return /\.json$/i.test(n) && /(saved_posts|saved_collections|user_data|favorite|liked|likes)/i.test(n);
      });
      for (var j = 0; j < noms.length; j++) docs.push({ nom: noms[j], texte: await zip.files[noms[j]].async("string") });
      if (!noms.length && Object.keys(zip.files).some(function (n) { return /\.html$/i.test(n); })) throw new Error("html");
    } else if (/\.json$/i.test(f.name) || f.type === "application/json") {
      docs.push({ nom: f.name, texte: await f.text() });
    } else if (/\.html?$/i.test(f.name)) {
      throw new Error("html");
    }
  }
  return docs;
}

// Transforme les fichiers d'export en liste prête à intégrer.
function interpreterExport(docs, plateforme, avecLikes) {
  var parCle = {}, collections = {}, info = { fichiers: [], likesIgnores: 0, autres: 0 };
  docs.forEach(function (d) {
    var json;
    try { json = JSON.parse(d.texte); } catch (e) { return; }
    var nom = d.nom.split("/").pop();
    if (plateforme === "instagram") {
      if (/saved_collections/i.test(nom) || json.saved_saved_collections) {
        Object.assign(collections, collectionsInstagram(json));
        info.fichiers.push(nom);
      }
      if (/saved_posts/i.test(nom) || json.saved_saved_media || json.saved_saved_collections) {
        collecterLiens(json).forEach(function (e) {
          if (e.r.plateforme === "instagram" && !parCle[e.r.cle]) parCle[e.r.cle] = e;
        });
        if (info.fichiers.indexOf(nom) < 0) info.fichiers.push(nom);
      }
    } else {
      var trouves = collecterLiens(json).filter(function (e) { return e.r.plateforme === "tiktok"; });
      if (!trouves.length) return;
      info.fichiers.push(nom);
      trouves.forEach(function (e) {
        var c = e.chemin.toLowerCase();
        // « Like List » range ses vidéos sous « ItemFavoriteList » : le like se teste d'abord.
        var like = /like/.test(c);
        var favori = !like && /favorite|favori/.test(c) && !/sound|effect|hashtag|music/.test(c);
        if (like && !avecLikes) { info.likesIgnores++; return; }
        if (!favori && !like) { info.autres++; return; }
        if (!parCle[e.r.cle]) { e.likee = like; parCle[e.r.cle] = e; }
      });
    }
  });
  var liste = Object.keys(parCle).map(function (k) {
    var e = parCle[k];
    e.collectionsOrigine = collections[k] || [];
    return e;
  });
  return { liste: liste, info: info, nbCollections: Object.keys(collections).reduce(function (s, k) {
    collections[k].forEach(function (n) { s.indexOf(n) < 0 && s.push(n); }); return s; }, []).length };
}
