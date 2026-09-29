
/* ==================================================================
   RECETTES CONSEILLÉES
   Le serveur (fonction « idees ») tire de vraies recettes de TheMealDB,
   avec photo et vidéo quand il y en a. Claude garde les plus healthy,
   les traduit et les détaille en français, en tenant compte des goûts
   que révèlent les recettes déjà enregistrées.
   ================================================================== */

var Conseils = { enCours: false, erreur: "" };

var CATS_IDEES = ["Breakfast", "Dessert", "Vegan", "Vegetarian", "Seafood", "Chicken", "Side", "Starter", "Pasta", "Miscellaneous"];

async function demanderIdees(n, exclure, categories) {
  if (EN_ARTIFACT && !Apercus.mcp) throw { code: "server_not_connected" };
  categories = (categories || []).filter(function (c) { return CATS_IDEES.indexOf(c) >= 0; });
  if (Apercus.mcp) {
    var q = "select 'idees' as id, pepites.idees(" + (n | 0) + ", array[" +
      exclure.filter(function (x) { return /^\d+$/.test(x); }).map(function (x) { return "'" + x + "'"; }).join(",") + "]::text[], " +
      (categories.length ? "array[" + categories.map(function (c) { return "'" + c + "'"; }).join(",") + "]::text[]" : "null") + ") as r;";
    var res = await Apercus.mcp.callTool(APERCU.serveur, APERCU.outil, { project_id: APERCU.projet, query: q });
    var lignes = lignesSql(res.payload != null ? res.payload : res);
    return lignes[0] && lignes[0].r;
  }
  var rep = await fetch(APERCU.url.replace(/apercu$/, "idees"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + APERCU.cle, apikey: APERCU.cle },
    body: JSON.stringify({ n: n, exclure: exclure, categories: categories })
  });
  return rep.ok ? await rep.json() : { ok: false, raison: "serveur_" + rep.status };
}

// Ce que la personne n'aime pas : aucune recette conseillée ne doit en contenir.
function pasAime() { return (Store.reg.pasAime || []).filter(Boolean); }
function contientPasAime(r) {
  var liste = pasAime().map(function (x) { return mots(x).map(racine); }).filter(function (m) { return m.length; });
  if (!liste.length || !r) return false;
  var texte = mots([r.nom, (r.ingredients || []).map(function (i) { return i.nom; }).join(" ")].join(" ")).map(racine);
  return liste.some(function (m) { return m.every(function (w) { return motCorrespond(texte, w); }); });
}

function gouts() {
  var rec = recents(tousItems().filter(estRecette)).slice(0, 30);
  return rec.map(function (it) { return (it.recette && it.recette.nom) || it.titre; }).filter(Boolean);
}

async function proposerRecettes() {
  if (Conseils.enCours || !iaDispo()) return;
  Conseils.enCours = true; Conseils.erreur = "";
  rendreBientot();
  try {
    var deja = Object.keys(Store.items).filter(function (k) { return /^conseil-\d+$/.test(k); }).map(function (k) { return k.slice(8); });
    // Trois tirages, pour couvrir la journée : petits-déjeuners, plats, desserts et collations.
    var tirages = await Promise.all([
      demanderIdees(7, deja, ["Breakfast"]),
      demanderIdees(12, deja, ["Vegetarian", "Vegan", "Seafood", "Chicken", "Side", "Starter", "Pasta"]),
      demanderIdees(5, deja, ["Dessert"])
    ]);
    var idees = { ok: true, recettes: [] };
    tirages.forEach(function (t) { if (t && t.ok) idees.recettes = idees.recettes.concat(t.recettes || []); });
    if (!idees.recettes.length) throw { code: "source", message: (tirages[0] && tirages[0].raison) || "vide" };
    var candidates = idees.recettes.map(function (r) {
      return { id: r.id, nom: r.nom, categorie: r.categorie, ingredients: r.ingredients.map(function (i) { return i.nom; }), instructions: String(r.instructions || "").slice(0, 900) };
    });
    var interdits = pasAime();
    var prompt = [
      "Tu conseilles des recettes healthy à une personne francophone, pour toute sa journée.",
      "Ses recettes enregistrées (pour deviner ses goûts) : " + (gouts().join(" ; ") || "aucune pour l'instant") + ".",
      interdits.length ? "ELLE N'AIME PAS : " + interdits.join(", ") + ". Écarte toute recette qui en contient, même en petite quantité, sous n'importe quelle forme ou traduction (ex. « coriander » = coriandre)." : "",
      "Voici des recettes candidates (en anglais) :",
      JSON.stringify(candidates),
      "",
      "Choisis 10 à 12 recettes saines ou faciles à rendre saines, réparties sur la journée : 2 ou 3 petits-déjeuners, 3 ou 4 déjeuners, 3 ou 4 dîners, 1 ou 2 collations ou desserts légers. Donne à chacune un « repas_principal » parmi \"petit-dejeuner\", \"dejeuner\", \"diner\", \"collation\".",
      "Pour chacune, écris tout en français : traduis le nom et les ingrédients, donne les quantités en unités françaises (g, ml, c. à s., c. à c.), réécris les étapes en phrases courtes à l'impératif.",
      "Tu peux alléger un ingrédient (crème → yaourt grec, friture → four…) : dis-le dans « astuce ».",
      "Réponds uniquement en JSON : {\"recettes\": [{\"id\", \"nom\", \"repas_principal\", \"pourquoi\": une phrase sur ce qui la rend healthy, \"astuce\": phrase ou null, \"temps\": minutes ou null, \"difficulte\": \"Facile\"|\"Moyen\"|\"Difficile\", \"portions\": nombre ou null, \"vegetarien\": bool, \"ingredients\": [{\"nom\", \"qte\"}], \"etapes\": [\"…\"], \"nutrition\": {\"kcal\",\"proteines\",\"glucides\",\"lipides\"} par portion, estimation grossière}]}."
    ].filter(Boolean).join("\n");
    var rep = await IA.sample.json(prompt, { modelTier: "default" });
    var parId = {};
    idees.recettes.forEach(function (r) { parId[String(r.id)] = r; });
    var ajoutees = 0;
    for (var i = 0; i < ((rep && rep.recettes) || []).length; i++) {
      var c = rep.recettes[i], src = parId[String(c.id)];
      if (!src) continue;
      var img = null;
      if (src.image) { var b = await dataUrlVersBlob(src.image); img = b ? await preparerImage(b) : null; }
      var principal = ["petit-dejeuner", "dejeuner", "diner", "collation"].indexOf(c.repas_principal) >= 0 ? c.repas_principal : "dejeuner";
      var r = nettoyerRecette(Object.assign({}, c, { repas: [principal], source: "conseil" }));
      r.source = "conseil";
      r.repasPrincipal = principal;
      // Double contrôle : rien de ce qu'elle n'aime pas, même si Claude l'a laissé passer.
      if (contientPasAime(r)) continue;
      r.healthy = true;
      var cat = trouverCat("Healthy", "recettes");
      var it = nouvelItem({ cle: "conseil-" + src.id, url: src.video || src.source || "https://www.themealdb.com/meal/" + src.id,
        plateforme: src.video ? "youtube" : "web", type: src.video ? "video" : "lien" }, {
        conseil: true, source: "conseil", createur: "", titre: r.nom || src.nom, resume: String(c.pourquoi || "").slice(0, 300),
        astuce: c.astuce ? String(c.astuce).slice(0, 300) : null, origine: src.origine || null,
        vignette: img ? img.vignette : null, ratio: img ? img.ratio : null,
        recette: r, cats: cat ? [cat.id] : ["recettes"], tagsAuto: ["healthy"].concat(src.origine ? [norm(src.origine)] : []),
        analyse: { etat: "fait", par: "ia", conf: "haute", date: Date.now() }
      });
      sauverItem(it);
      ajoutees++;
    }
    if (!ajoutees) Conseils.erreur = "Claude n'a retenu aucune recette cette fois. Réessaie pour en tirer d'autres.";
    else journal(pluriel(ajoutees, "recette conseillée", "recettes conseillées") + " par Claude.");
  } catch (e) {
    if (e && e.code === "source") Diag.erreurSupabase = "source: " + (e.message || "?");
    else if (e && MESSAGES_APERCU[e.code]) Diag.erreurSupabase = e.code;
    else Diag.erreurClaude = (e && e.code) || String(e && e.message || e);
    if (e && e.code === "source") Conseils.erreur = "La base de recettes n'a pas répondu. Réessaie dans un instant.";
    else if (e && MESSAGES_APERCU[e.code]) Conseils.erreur = MESSAGES_APERCU[e.code];
    else { iaFatal(e); Conseils.erreur = messageIA(e); }
  }
  Conseils.enCours = false;
  rendreBientot();
}

function garderConseil(it) {
  it.conseil = false;
  it.importe = Date.now();
  sauverItem(it);
  journal("« " + it.titre + " » ajoutée à mes recettes.");
}

/* --- déclenchements à l'ouverture des onglets --- */

// Recettes : photos manquantes (dont celles ratées avant la correction des
// images Instagram) et traduction des recettes en anglais, une fois chacune.
var CORRECTION_IMAGES = 1790633028429;
function autoRecettes() {
  var rec = tousItems().filter(estRecette);
  if (apercusDispo()) {
    var ids = rec.filter(function (it) { return apercuPossible(it) && (!it.apercu || (it.apercu.date || 0) < CORRECTION_IMAGES); })
      .map(function (it) { return it.id; });
    if (ids.length) lancerApercus(ids);
  }
  if (iaDispo()) {
    // Recettes jamais lues par Claude (titre = légende brute) : une analyse, une fois.
    var aLire = rec.filter(function (it) { return !(it.analyse && (it.analyse.par === "ia" || it.analyse.par === "manuel")) && !it.demo && !it.iaTentee; });
    aLire.forEach(function (it) { it.iaTentee = true; sauverItem(it); });
    if (aLire.length) lancerAnalyse(aLire.map(function (it) { return it.id; }));
    var ang = rec.filter(function (it) { return estAnglais(it) && !it.tradTentee; });
    ang.forEach(function (it) { it.tradTentee = true; sauverItem(it); });
    if (ang.length) lancerAnalyse(ang.map(function (it) { return it.id; }));
  }
}

// Sport : détail des exercices pour les séances qui ne l'ont pas, une fois chacune.
function autoSport() {
  if (!iaDispo()) return;
  var s = tousItems().filter(function (it) { return estSport(it) && !it.seance && !it.seanceTentee; });
  s.forEach(function (it) { it.seanceTentee = true; sauverItem(it); });
  if (s.length) detaillerSeances(s.map(function (it) { return it.id; }));
}

/* ==================================================================
   DÉTAIL DES SÉANCES
   Claude ne voit pas la vidéo : il lit le titre, la légende et l'image de
   couverture. Une séance à la fois, avec son image, et une consigne qui
   lui demande de reconstituer une séance faisable quand la légende ne
   détaille rien, au lieu d'abandonner.
   ================================================================== */

var Seances = { file: [], enCours: false, fait: 0, total: 0, erreur: "" };

function detaillerSeances(ids) {
  ids.forEach(function (id) { if (Seances.file.indexOf(id) < 0) Seances.file.push(id); });
  Seances.total = Seances.fait + Seances.file.length;
  Seances.erreur = "";
  rendreBientot();
  if (!Seances.enCours) boucleSeances();
}

async function boucleSeances() {
  Seances.enCours = true;
  while (Seances.file.length && iaDispo()) {
    var it = Store.items[Seances.file[0]];
    if (!it) { Seances.file.shift(); continue; }
    try {
      await detaillerSeance(it);
      Seances.file.shift();
      Seances.fait++;
    } catch (e) {
      if (e && e.code === "cancelled") break;
      Diag.erreurClaude = (e && e.code) || String(e && e.message || e);
      iaFatal(e);
      Seances.erreur = messageIA(e);
      break;
    }
    rendreBientot();
  }
  Seances.enCours = false;
  if (!Seances.file.length) { Seances.fait = 0; Seances.total = 0; }
  rendreBientot();
}

async function detaillerSeance(it) {
  var d = descriptionPourIA(it);
  if (it.titre) d.titre = it.titre;
  if (it.resume) d.resume = it.resume;
  var prompt = [
    "Voici un contenu de sport qu'une personne francophone a enregistré sur les réseaux sociaux. Tu ne vois pas la vidéo : seulement ces informations" +
      (it.vignette ? " et l'image de couverture jointe (lis le texte écrit dessus)." : "."),
    JSON.stringify(d),
    "",
    "Écris la séance pour qu'elle puisse la faire sans revoir la vidéo.",
    "- Si la légende ou l'image liste les exercices, reprends-les fidèlement (source \"legende\").",
    "- Sinon, reconstitue une séance cohérente, sûre et réaliste qui tient la promesse du titre et de la légende (zone travaillée, durée, niveau, matériel visible) : 4 à 8 exercices classiques, avec séries, répétitions ou durée, repos et un conseil de placement quand c'est utile (source \"deduit\"). Ne réponds jamais par une séance vide.",
    "- Tout en français.",
    "Réponds uniquement en JSON : {\"seance\": {\"nom\", \"type\": \"Renforcement\"|\"Cardio\"|\"HIIT\"|\"Yoga\"|\"Pilates\"|\"Mobilité\"|\"Course\"|\"Autre\", \"duree\": minutes, \"niveau\": \"Débutant\"|\"Intermédiaire\"|\"Avancé\", \"materiel\": [], \"muscles\": [], \"echauffement\": phrase, \"tours\": nombre ou null, \"exercices\": [{\"nom\", \"series\", \"reps\", \"repos\", \"conseil\"}], \"source\": \"legende\"|\"deduit\"}}."
  ].join("\n");
  var opts = { modelTier: "default" };
  if (it.vignette && IA.limites && IA.limites.images) {
    var b = await dataUrlVersBlob(IA.images[it.id] || it.vignette);
    if (b) opts.images = [b];
  }
  var rep = await IA.sample.json(prompt, opts);
  var s = rep && rep.seance;
  if (s && s.exercices && s.exercices.length) {
    it.seance = nettoyerSeance(s);
    if (!catsValides(it).some(function (c) { return parentDe(c) === "sport"; }) && Store.cats.sport) it.cats = (it.cats || []).concat("sport");
    sauverItem(it);
  } else {
    it.seanceTentee = true;
    sauverItem(it);
  }
}
