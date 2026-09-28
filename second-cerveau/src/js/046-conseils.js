
/* ==================================================================
   RECETTES CONSEILLÉES
   Le serveur (fonction « idees ») tire de vraies recettes de TheMealDB,
   avec photo et vidéo quand il y en a. Claude garde les plus healthy,
   les traduit et les détaille en français, en tenant compte des goûts
   que révèlent les recettes déjà enregistrées.
   ================================================================== */

var Conseils = { enCours: false, erreur: "" };

async function demanderIdees(n, exclure) {
  if (Apercus.mcp) {
    var q = "select 'idees' as id, pepites.idees(" + (n | 0) + ", array[" +
      exclure.filter(function (x) { return /^\d+$/.test(x); }).map(function (x) { return "'" + x + "'"; }).join(",") + "]::text[]) as r;";
    var res = await Apercus.mcp.callTool(APERCU.serveur, APERCU.outil, { project_id: APERCU.projet, query: q });
    var lignes = lignesSql(res.payload != null ? res.payload : res);
    return lignes[0] && lignes[0].r;
  }
  var rep = await fetch(APERCU.url.replace(/apercu$/, "idees"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + APERCU.cle, apikey: APERCU.cle },
    body: JSON.stringify({ n: n, exclure: exclure })
  });
  return rep.ok ? await rep.json() : { ok: false, raison: "serveur_" + rep.status };
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
    var idees = await demanderIdees(10, deja);
    if (!idees || !idees.ok || !(idees.recettes || []).length) throw { code: "source", message: idees && idees.raison };
    var candidates = idees.recettes.map(function (r) {
      return { id: r.id, nom: r.nom, categorie: r.categorie, origine: r.origine, ingredients: r.ingredients, instructions: String(r.instructions || "").slice(0, 1800) };
    });
    var prompt = [
      "Tu conseilles des recettes healthy à une personne francophone.",
      "Ses recettes enregistrées (pour deviner ses goûts) : " + (gouts().join(" ; ") || "aucune pour l'instant") + ".",
      "Voici des recettes candidates (en anglais) :",
      JSON.stringify(candidates),
      "",
      "Garde les 4 à 6 plus saines, ou faciles à rendre saines, en privilégiant celles qui correspondent à ses goûts.",
      "Pour chacune, écris tout en français : traduis le nom et les ingrédients, convertis les quantités en unités françaises (g, ml, c. à s., c. à c.), réécris les étapes en phrases courtes à l'impératif.",
      "Tu peux alléger un ingrédient (crème → yaourt grec, friture → four…) : dis-le dans « astuce ».",
      "Réponds uniquement en JSON : {\"recettes\": [{\"id\", \"nom\", \"pourquoi\": une phrase sur ce qui la rend healthy, \"astuce\": phrase ou null, \"temps\": minutes ou null, \"difficulte\": \"Facile\"|\"Moyen\"|\"Difficile\", \"portions\": nombre ou null, \"repas\": sous-ensemble de [\"petit-dejeuner\",\"dejeuner\",\"diner\",\"dessert\",\"aperitif\",\"gouter\"], \"vegetarien\": bool, \"ingredients\": [{\"nom\", \"qte\"}], \"etapes\": [\"…\"], \"nutrition\": {\"kcal\",\"proteines\",\"glucides\",\"lipides\"} par portion, estimation grossière}]}."
    ].join("\n");
    var rep = await IA.sample.json(prompt, { modelTier: "default" });
    var parId = {};
    idees.recettes.forEach(function (r) { parId[String(r.id)] = r; });
    var ajoutees = 0;
    for (var i = 0; i < ((rep && rep.recettes) || []).length; i++) {
      var c = rep.recettes[i], src = parId[String(c.id)];
      if (!src) continue;
      var img = null;
      if (src.image) { var b = await dataUrlVersBlob(src.image); img = b ? await preparerImage(b) : null; }
      var r = nettoyerRecette(Object.assign({}, c, { source: "conseil" }));
      r.source = "conseil";
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
  if (s.length) lancerAnalyse(s.map(function (it) { return it.id; }));
}
