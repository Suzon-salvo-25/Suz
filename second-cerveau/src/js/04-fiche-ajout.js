
/* ==================================================================
   FICHE DÉTAILLÉE
   ================================================================== */

var LIB_REPAS = { "petit-dejeuner": "Petit-déjeuner", dejeuner: "Déjeuner", diner: "Dîner", dessert: "Dessert", aperitif: "Apéritif", gouter: "Goûter" };
var LIB_SOURCE = { "export-instagram": "Export Instagram", "export-tiktok": "Export TikTok", lien: "Lien collé", partage: "Partage", exemple: "Exemple" };

function ficheHTML(it) {
  var r = it.recette, c = catVisuelle(it);
  var h = '<div class="feuille-tete"><h2 id="ficheTitre">' + esc(nomPlat(it.plateforme)) + ' · ' + esc(TYPES[it.type] || "Contenu") + '</h2>' +
    '<button type="button" class="icon-btn" data-action="fermer-fiche" aria-label="Fermer"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>';
  h += '<div class="feuille-corps">';

  // --- en-tête de la fiche
  h += '<div class="fiche-haut">' + vis(it, it.vignette && it.ratio ? String(Math.max(.56, Math.min(1.5, it.ratio)).toFixed(3)) : "4 / 5") +
    '<div class="fiche-titre">' +
    (ICI.ficheTitre
      ? '<form class="ajout-ligne" data-form="titre" style="margin-bottom:10px"><input type="text" id="ficheTitreInput" maxlength="90" aria-label="Titre" value="' + esc(it.titre) + '"><button type="submit" class="btn go sm">OK</button></form>'
      : '<h2>' + esc(it.titre || titreParDefaut(it)) + '</h2>') +
    '<div class="meta">' + badgePlat(it) + (it.createur ? '<span>@' + esc(it.createur.replace(/^@/, "")) + '</span>' : "") +
      (it.ajoute ? '<span>· enregistré le ' + dateCourte(it.ajoute) + '</span>' : '<span>· ajouté le ' + dateCourte(it.importe) + '</span>') + '</div>' +
    (it.resume ? '<p class="resume">' + esc(it.resume) + '</p>' : "") +
    (it.demo ? '<p class="aide" style="margin-top:10px">Exemple de démonstration : il ne correspond à aucune publication réelle.</p>' : "") +
    '<div class="fiche-actions">' +
      (it.url ? '<a class="btn go sm" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">Ouvrir sur ' + esc(nomPlat(it.plateforme)) + ' ↗</a>' : "") +
      '<button type="button" class="btn ghost sm" data-action="favori" data-id="' + esc(it.id) + '" aria-pressed="' + !!it.favori + '">' + (it.favori ? "♥ Favori" : "♡ Favori") + '</button>' +
      (ICI.ficheTitre ? "" : '<button type="button" class="btn ghost sm" data-action="edit-titre">Renommer</button>') +
      (iaDispo() ? '<button type="button" class="btn ghost sm" data-action="reanalyser" data-id="' + esc(it.id) + '">' + (IA.file.indexOf(it.id) >= 0 ? "Analyse en cours…" : "Réanalyser avec Claude") + '</button>' : "") +
    '</div></div></div>';

  // --- la recette
  if (r) {
    h += '<section class="bloc recette"><h3><span class="illu-mini st-fraise" aria-hidden="true" style="margin:0"></span>' + esc(r.nom || "La recette") +
      (r.source === "deduit" ? ' <span class="tag estime">reconstituée</span>' : "") + '</h3>';
    if (r.source === "deduit") h += '<p class="avert">Recette reconstituée par Claude à partir du nom du plat : la vidéo peut différer. Colle la légende pour une version fidèle.</p>';
    var chiffres = [];
    if (r.temps) chiffres.push(["Temps", r.temps + " min"]);
    if (r.difficulte) chiffres.push(["Difficulté", r.difficulte]);
    if (r.portions) chiffres.push(["Portions", r.portions]);
    if (r.repas && r.repas.length) chiffres.push(["Repas", r.repas.map(function (x) { return LIB_REPAS[x] || x; }).join(", ")]);
    if (r.vegetarien === true) chiffres.push(["Régime", "Végétarien"]);
    if (chiffres.length) h += '<div class="rec-chiffres">' + chiffres.map(function (x) { return '<div><span class="lab">' + x[0] + '</span><b>' + esc(x[1]) + '</b></div>'; }).join("") + '</div>';
    if (r.ingredients && r.ingredients.length) {
      h += '<div><p class="lab" style="margin-bottom:6px">Ingrédients</p><ul class="ingr-liste">' + r.ingredients.map(function (i, k) {
        return '<li><label><input type="checkbox" id="ingr-' + k + '"><span>' + esc(i.nom) + '</span>' + (i.qte ? '<span class="q">' + esc(i.qte) + '</span>' : "") + '</label></li>';
      }).join("") + '</ul></div>';
    }
    if (r.etapes && r.etapes.length) {
      h += '<div><p class="lab" style="margin-bottom:6px">Préparation</p><ol class="etapes">' + r.etapes.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join("") + '</ol></div>';
    } else {
      h += '<p class="aide">Les étapes ne figurent pas dans les informations disponibles.</p>';
    }
    if (r.nutrition) {
      var n = r.nutrition;
      h += '<p class="nutri"><span class="tag estime">estimation</span><span><b>' + n.kcal + '</b> kcal</span>' +
        (n.proteines ? '<span><b>' + n.proteines + '</b> g protéines</span>' : "") + (n.glucides ? '<span><b>' + n.glucides + '</b> g glucides</span>' : "") +
        (n.lipides ? '<span><b>' + n.lipides + '</b> g lipides</span>' : "") + '<span class="aide">par portion, ordre de grandeur calculé sans pesée</span></p>';
    }
    h += '</section>';
  }

  // --- le lieu
  if (it.lieu) {
    var q = [it.lieu.nom, it.lieu.ville, it.lieu.pays].filter(Boolean).join(", ");
    h += '<section class="bloc"><h3><span class="illu-mini st-tortue" aria-hidden="true" style="margin:0"></span>' + esc(it.lieu.nom || it.lieu.ville) + '</h3>' +
      '<p style="color:var(--ink-soft);font-size:.92rem">' + esc([it.lieu.ville, it.lieu.pays].filter(Boolean).join(", ")) + '</p>' +
      '<p><a class="lien-orig" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener noreferrer">Voir sur une carte ↗</a></p></section>';
  }

  // --- classement
  var an = it.analyse || {};
  var par = an.par === "ia" ? "Classé par Claude" + (an.conf ? " · confiance " + an.conf : "") : an.par === "manuel" ? "Classé à la main" : an.par === "regles" ? "Classé par mots-clés" : "";
  h += '<section class="bloc"><h3>Rangé dans</h3><div class="chips">' +
    (catsValides(it).length ? catsValides(it).map(function (cid) {
      var x = Store.cats[cid], lib = x.parent ? Store.cats[x.parent].nom + " › " + x.nom : x.nom;
      return '<span class="chip doux">' + esc(lib) + '<button type="button" data-action="retirer-cat" data-id="' + esc(it.id) + '" data-cat="' + esc(cid) + '" aria-label="Retirer de ' + esc(lib) + '">×</button></span>';
    }).join("") : '<span class="aide">Non classé.</span>') + '</div>' +
    '<div class="ajout-ligne"><select id="ficheAjoutCat" aria-label="Ajouter à une catégorie"><option value="">Ajouter à une catégorie…</option>' + optionsCats("", false) + '</select></div>' +
    (par ? '<p class="aide">' + par + (an.date ? " · " + dateCourte(an.date) : "") + '</p>' : "") + '</section>';

  // --- tags
  h += '<section class="bloc"><h3>Tags</h3><div class="chips">' +
    (it.tagsAuto || []).map(function (t) { return '<span class="chip doux" title="Tag automatique">#' + esc(t) + '</span>'; }).join("") +
    (it.tags || []).map(function (t) { return '<span class="chip doux" style="background:var(--panel)">#' + esc(t) + '<button type="button" data-action="retirer-tag" data-id="' + esc(it.id) + '" data-tag="' + esc(t) + '" aria-label="Retirer le tag ' + esc(t) + '">×</button></span>'; }).join("") +
    (!(it.tagsAuto || []).length && !(it.tags || []).length ? '<span class="aide">Aucun tag.</span>' : "") + '</div>' +
    '<form class="ajout-ligne" data-form="tag"><input type="text" id="ficheTag" maxlength="30" autocomplete="off" placeholder="Ajouter un tag (ex. à refaire)" aria-label="Nouveau tag"><button type="submit" class="btn ghost sm">Ajouter</button></form></section>';

  // --- collections
  var colls = Object.keys(Store.colls).map(function (k) { return Store.colls[k]; }).sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });
  h += '<section class="bloc"><h3>Collections</h3><div class="chips">' +
    ((it.collections || []).filter(function (id) { return Store.colls[id]; }).map(function (id) {
      return '<span class="chip doux">' + esc(Store.colls[id].nom) + '<button type="button" data-action="retirer-coll" data-id="' + esc(it.id) + '" data-coll="' + esc(id) + '" aria-label="Retirer de la collection">×</button></span>';
    }).join("") || '<span class="aide">Dans aucune collection.</span>') + '</div>' +
    '<div class="ajout-ligne"><select id="ficheAjoutColl" aria-label="Ajouter à une collection"><option value="">Ajouter à une collection…</option>' +
    colls.filter(function (c) { return (it.collections || []).indexOf(c.id) < 0; }).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nom) + '</option>'; }).join("") +
    '<option value="__nouvelle">＋ Nouvelle collection…</option></select></div>' +
    (ICI.ficheNouvelleColl ? '<form class="ajout-ligne" data-form="fiche-coll"><input type="text" id="ficheCollNom" maxlength="50" placeholder="Nom de la collection" aria-label="Nom de la nouvelle collection"><button type="submit" class="btn go sm">Créer</button></form>' : "") +
    '</section>';

  // --- notes
  h += '<section class="bloc"><h3>Mes notes</h3><textarea id="ficheNote" rows="3" placeholder="Pour quand, avec qui, ce que tu changerais…" aria-label="Notes personnelles">' + esc(it.note) + '</textarea></section>';

  // --- ce que l'appli sait
  var manque = function (v, txt) { return v ? '<dd>' + v + '</dd>' : '<dd class="manque">' + txt + '</dd>'; };
  h += '<section class="bloc"><h3>Ce que l\'appli sait</h3><dl class="dl-meta">' +
    '<div><dt>Lien</dt>' + manque(it.url ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">' + esc(it.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)) + '</a>' : "", "aucun") + '</div>' +
    '<div><dt>Créateur</dt>' + manque(it.createur ? "@" + esc(it.createur) : "", "non fourni par " + (it.source === "export-tiktok" ? "l'export TikTok" : "la source")) + '</div>' +
    '<div><dt>Enregistré sur ' + esc(nomPlat(it.plateforme)) + '</dt>' + manque(it.ajoute ? dateCourte(it.ajoute) : "", "date inconnue") + '</div>' +
    '<div><dt>Arrivé dans l\'appli</dt><dd>' + dateCourte(it.importe) + ' · ' + esc(LIB_SOURCE[it.source] || it.source) + '</dd></div>' +
    ((it.collectionsOrigine || []).length ? '<div><dt>Collection Instagram</dt><dd>' + esc(it.collectionsOrigine.join(", ")) + '</dd></div>' : "") +
    '</dl>' +
    '<div class="field"><label for="ficheLegende">Légende ou description</label>' +
    '<textarea id="ficheLegende" rows="4" placeholder="Colle ici la légende copiée depuis l\'appli ' + esc(nomPlat(it.plateforme)) + '">' + esc(it.legende) + '</textarea>' +
    '<p class="aide">' + (it.source && it.source.indexOf("export") === 0 ? "L'export ne contient pas la légende. " : "") + 'C\'est elle qui permet d\'extraire une recette, une adresse, une liste d\'exercices.</p></div>' +
    '<div class="boutons" style="margin-top:0">' +
      '<label class="btn ghost sm" for="ficheCapture" style="cursor:pointer">' + (it.vignette ? "Changer la capture" : "Ajouter une capture d'écran") + '</label>' +
      '<input type="file" id="ficheCapture" accept="image/*" hidden>' +
      (it.vignette ? '<button type="button" class="btn ghost sm" data-action="retirer-capture" data-id="' + esc(it.id) + '">Retirer la capture</button>' : "") +
      (iaDispo() ? '<button type="button" class="btn go sm" data-action="reanalyser" data-id="' + esc(it.id) + '">Analyser avec ces informations</button>' : '<button type="button" class="btn go sm" data-action="reclasser-un" data-id="' + esc(it.id) + '">Reclasser avec ces informations</button>') +
    '</div></section>';

  // --- doublons
  var sim = similaires(it);
  if (sim.length) {
    h += '<section class="bloc"><h3>Ressemble à</h3>' + sim.map(function (s) {
      return '<div class="ajout-ligne" style="align-items:center"><span style="flex:1 1 200px">' + badgePlat(s) + ' ' + esc(s.titre) + (s.createur ? ' · @' + esc(s.createur) : "") + '</span>' +
        '<button type="button" class="btn ghost sm" data-action="fiche" data-id="' + esc(s.id) + '">Voir</button>' +
        '<button type="button" class="btn ghost sm" data-action="fusionner-items" data-id="' + esc(it.id) + '" data-autre="' + esc(s.id) + '">Fusionner ici</button></div>';
    }).join("") + '<p class="aide">Fusionner réunit catégories, tags, notes et collections sur cette fiche, et retire l\'autre de l\'appli.</p></section>';
  }

  // --- retirer
  h += ICI.ficheConfirm
    ? '<div class="confirm">Retirer « ' + esc(it.titre) + ' » de l\'appli ? ' + (it.url ? "L'original reste sur " + esc(nomPlat(it.plateforme)) + "." : "") +
      '<div class="boutons"><button type="button" class="btn danger sm" data-action="retirer-item" data-id="' + esc(it.id) + '">Retirer</button><button type="button" class="btn ghost sm" data-action="annuler-retrait">Annuler</button></div></div>'
    : '<div><button type="button" class="btn ghost sm" data-action="demander-retrait">Retirer de l\'appli</button></div>';
  return h + '</div>';
}

function ouvrirFiche(id) {
  if (!Store.items[id]) return;
  ICI.fiche = id; ICI.ficheConfirm = false; ICI.ficheTitre = false; ICI.ficheNouvelleColl = false;
  var d = $("#fiche");
  d.innerHTML = ficheHTML(Store.items[id]);
  d.scrollTop = 0;
  if (!d.open) d.showModal();
}
function rendreFiche() {
  var d = $("#fiche");
  if (!d.open || !ICI.fiche) return;
  var it = Store.items[ICI.fiche];
  if (!it) { d.close(); return; }
  avecFocus(d, function () { d.innerHTML = ficheHTML(it); });
}

/* ==================================================================
   AJOUT : liens et exports
   ================================================================== */

function ajoutHTML() {
  var a = ICI.ajout;
  var h = '<div class="feuille-tete"><h2 id="ajoutTitre">Ajouter des pépites</h2>' +
    '<button type="button" class="icon-btn" data-action="fermer-ajout" aria-label="Fermer"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
    '<div class="feuille-corps"><div class="seg" role="tablist">' +
    '<button type="button" data-action="ajout-onglet" data-onglet="liens" aria-pressed="' + (a.onglet === "liens") + '">Coller des liens</button>' +
    '<button type="button" data-action="ajout-onglet" data-onglet="export" aria-pressed="' + (a.onglet === "export") + '">Importer un export</button></div>';

  if (a.onglet === "liens") {
    var liens = extraireLiens(a.liens);
    var deja = liens.filter(function (r) { return Store.items[r.cle]; }).length;
    var parPlat = {};
    liens.forEach(function (r) { parPlat[r.plateforme] = (parPlat[r.plateforme] || 0) + 1; });
    h += '<p class="prose">Dans Instagram ou TikTok : <b>Partager › Copier le lien</b>, puis colle-le ici. Tu peux en coller plusieurs d\'un coup, ou tout un texte qui en contient.</p>' +
      '<div class="field"><label for="ajLiens">Lien ou liens</label><textarea id="ajLiens" rows="4" placeholder="https://www.instagram.com/reel/…&#10;https://www.tiktok.com/@…/video/…">' + esc(a.liens) + '</textarea>' +
      (a.liens.trim() ? '<p class="aide">' + (liens.length
        ? pluriel(liens.length, "lien") + ' reconnu' + (liens.length > 1 ? "s" : "") + ' : ' + Object.keys(parPlat).map(function (k) { return parPlat[k] + " " + nomPlat(k); }).join(", ") + (deja ? " · " + deja + " déjà dans l'appli (non dupliqué" + (deja > 1 ? "s" : "") + ")" : "")
        : "Aucun lien trouvé dans ce texte.") + '</p>' : "") + '</div>';
    if (liens.length <= 1) {
      h += '<div class="field"><label for="ajLegende">Légende ou description (facultatif)</label><textarea id="ajLegende" rows="3" placeholder="Copie la légende depuis l\'appli : c\'est elle qui permet d\'extraire la recette, l\'adresse…">' + esc(a.legende) + '</textarea></div>' +
        '<div class="field"><label for="ajNote">Ma note (facultatif)</label><input type="text" id="ajNote" maxlength="300" autocomplete="off" value="' + esc(a.note) + '" placeholder="Ex. à tester pour le dîner de samedi"></div>' +
        '<div class="ajout-ligne" style="align-items:center"><label class="btn ghost sm" for="ajCapture" style="cursor:pointer;flex:0 0 auto">' + (a.capture ? "Changer la capture" : "Ajouter une capture d'écran") + '</label>' +
        '<input type="file" id="ajCapture" accept="image/*" hidden>' +
        '<span class="aide">' + (a.capture ? "Capture prête." : "Une capture de la vidéo ou de la légende aide beaucoup l'analyse.") + '</span></div>';
    }
    h += '<div class="boutons" style="margin-top:0"><button type="button" class="btn go" data-action="ajouter-liens"' + (liens.length && liens.length > deja ? "" : " disabled") + '>' +
      (liens.length > 1 ? "Ajouter " + (liens.length - deja) + " pépites" : "Ajouter") + (iaDispo() && Store.reg.iaAuto ? " et analyser" : "") + '</button></div>';
    return h + '</div>';
  }

  // --- export
  var p = PLATEFORMES[a.plat];
  h += '<div class="seg" style="align-self:flex-start">' +
    '<button type="button" data-action="ajout-plat" data-plat="instagram" aria-pressed="' + (a.plat === "instagram") + '">Instagram</button>' +
    '<button type="button" data-action="ajout-plat" data-plat="tiktok" aria-pressed="' + (a.plat === "tiktok") + '">TikTok</button></div>' +
    '<div><p class="lab" style="margin-bottom:8px">Obtenir ton export ' + p.nom + '</p><ol class="etapes-guide">' + p.guide.map(function (g) { return '<li>' + g + '</li>'; }).join("") + '</ol></div>' +
    '<label class="depot" id="depot" for="ajFichier"><span class="illu st-' + (a.plat === "instagram" ? "hibiscus" : "meduse") + '" aria-hidden="true"></span>' +
    '<b style="color:var(--ink)">Dépose ton fichier ici</b><span>ou touche pour le choisir · .zip ou .json</span></label>' +
    '<input type="file" id="ajFichier" accept=".zip,.json,application/zip,application/json" multiple hidden>' +
    (a.plat === "tiktok" ? '<label class="interrupteur"><input type="checkbox" id="ajLikes"' + (a.likes ? " checked" : "") + '>Inclure aussi les vidéos likées (en plus des favoris)</label>' : "");
  var L = a.lecture;
  if (L && L.plat === a.plat) {
    if (L.erreur) h += '<div class="apercu-import mauvais">' + L.erreur + '</div>';
    else if (L.enCours) h += '<div class="apercu-import">Lecture du fichier…</div>';
    else {
      var nouveaux = L.liste.filter(function (e) { return !Store.items[e.r.cle]; }).length;
      var appels = Math.ceil(nouveaux / 16);
      h += '<div class="apercu-import"><b>' + pluriel(L.liste.length, a.plat === "tiktok" ? "vidéo trouvée" : "publication enregistrée trouvée", a.plat === "tiktok" ? "vidéos trouvées" : "publications enregistrées trouvées") + '</b>' +
        '<ul><li>Fichiers lus : ' + esc(L.info.fichiers.join(", ") || "aucun") + '</li>' +
        (L.liste.length - nouveaux ? '<li>' + (L.liste.length - nouveaux) + ' déjà dans l\'appli : complétés, jamais dupliqués</li>' : "") +
        (L.nbCollections ? '<li>' + pluriel(L.nbCollections, "collection") + ' Instagram, utilisées comme indice de classement</li>' : "") +
        (L.info.likesIgnores ? '<li>' + pluriel(L.info.likesIgnores, "vidéo likée laissée", "vidéos likées laissées") + ' de côté</li>' : "") +
        '<li>L\'export ne contient ni légende ni image : le classement s\'appuie sur l\'auteur' + (a.plat === "instagram" ? " et tes collections" : "") + '. Complète les fiches importantes avec la légende ou une capture.</li>' +
        (iaDispo() && Store.reg.iaAuto && nouveaux ? '<li>Claude analysera ' + pluriel(nouveaux, "élément") + ', en ' + pluriel(appels, "appel") + ' environ, sur ton forfait.</li>' : "") +
        '</ul><div class="boutons"><button type="button" class="btn go" data-action="importer"' + (L.liste.length ? "" : " disabled") + '>' + (nouveaux ? "Importer " + pluriel(nouveaux, "élément") : "Mettre à jour") + '</button></div></div>';
    }
  }
  return h + '</div>';
}

function ouvrirAjout(onglet, plat) {
  if (onglet) ICI.ajout.onglet = onglet;
  if (plat) ICI.ajout.plat = plat;
  var d = $("#ajout");
  d.innerHTML = ajoutHTML();
  if (!d.open) d.showModal();
  var champ = ICI.ajout.onglet === "liens" ? $("#ajLiens") : null;
  if (champ) champ.focus();
}
function rendreAjout() {
  var d = $("#ajout");
  if (!d.open) return;
  avecFocus(d, function () { d.innerHTML = ajoutHTML(); });
}

async function lireExport(fichiers) {
  var a = ICI.ajout;
  a.lecture = { plat: a.plat, enCours: true };
  rendreAjout();
  try {
    var docs = await lireFichiers(fichiers);
    if (!docs.length) throw new Error("rien");
    a.lecture = Object.assign({ plat: a.plat, fichiers: docs }, interpreterExport(docs, a.plat, a.likes));
    if (!a.lecture.liste.length) throw new Error("vide");
  } catch (e) {
    var m = e && e.message;
    a.lecture = { plat: a.plat, erreur:
      m === "html" ? "Ce fichier est au format HTML. Refais la demande en choisissant le format <b>JSON</b>." :
      m === "zip" ? "Le .zip ne peut pas être ouvert ici. Décompresse-le et dépose le fichier " + (a.plat === "instagram" ? "<b>saved_posts.json</b>" : "<b>user_data_tiktok.json</b>") + "." :
      m === "vide" ? (a.plat === "instagram"
        ? "Aucune publication enregistrée dans ce fichier. Vérifie que tu as coché « Enregistré » dans la demande, et que tu déposes bien l'export Instagram."
        : "Aucun favori trouvé dans ce fichier. Vérifie qu'il s'agit de l'export TikTok au format JSON" + (a.likes ? "." : ", ou coche « Inclure aussi les vidéos likées ».")) :
      "Ce fichier n'a pas pu être lu. Dépose le .zip de l'export ou un fichier .json." };
  }
  rendreAjout();
}

function importer() {
  var L = ICI.ajout.lecture, plat = ICI.ajout.plat;
  if (!L || !L.liste) return;
  var res = integrer(L.liste, "export-" + plat);
  Store.reg.sources = Object.assign({}, Store.reg.sources);
  Store.reg.sources[plat] = { dernier: Date.now(), nombre: L.liste.length };
  journal("Import " + nomPlat(plat) + " : " + pluriel(res.nouveaux.length, "nouvel élément", "nouveaux éléments") + (res.completes ? ", " + res.completes + " complétés" : "") + ".");
  ICI.ajout.lecture = null;
  $("#ajout").close();
  toast(res.nouveaux.length ? pluriel(res.nouveaux.length, "pépite importée", "pépites importées") : "Rien de nouveau : tout était déjà là.");
  if (res.nouveaux.length && iaDispo() && Store.reg.iaAuto) lancerAnalyse(res.nouveaux);
  allerA("tout");
}

async function ajouterLiens() {
  var a = ICI.ajout;
  var liens = extraireLiens(a.liens).filter(function (r) { return !Store.items[r.cle]; });
  if (!liens.length) return;
  var seul = extraireLiens(a.liens).length === 1;
  var entrees = liens.map(function (r) {
    var e = { r: r, createur: r.createur || "" };
    if (seul) {
      e.legende = a.legende.trim();
      e.note = a.note.trim();
      if (a.capture) { e.vignette = a.capture.vignette; e.vignetteIA = a.capture.ia; e.ratio = a.capture.ratio; }
    }
    return e;
  });
  var res = integrer(entrees, "lien");
  journal(pluriel(res.nouveaux.length, "lien ajouté", "liens ajoutés") + ".");
  ICI.ajout.liens = ""; ICI.ajout.legende = ""; ICI.ajout.note = ""; ICI.ajout.capture = null;
  $("#ajout").close();
  toast(res.nouveaux.length > 1 ? pluriel(res.nouveaux.length, "pépite ajoutée", "pépites ajoutées") : "Pépite ajoutée");
  if (iaDispo() && Store.reg.iaAuto) lancerAnalyse(res.nouveaux);
  if (res.nouveaux.length === 1) ouvrirFiche(res.nouveaux[0]);
}

/* ==================================================================
   ACTIONS SUR LES CONTENUS
   ================================================================== */

function reclasserUn(it) {
  var manuelles = (it.catsManuelles || []).filter(function (c) { return Store.cats[c]; });
  var titreManuel = it.analyse && it.analyse.titreManuel;
  var ancienTitre = it.titre;
  if (!titreManuel) it.titre = "";
  classerParRegles(it);
  if (titreManuel) { it.titre = ancienTitre; it.analyse.titreManuel = true; }
  manuelles.forEach(function (c) { if (it.cats.indexOf(c) < 0) it.cats.unshift(c); });
  sauverItem(it);
}

function deplacer(ids, cid) {
  ids.forEach(function (id) {
    var it = Store.items[id];
    if (!it) return;
    it.cats = [cid]; it.catsManuelles = [cid];
    it.analyse = Object.assign({}, it.analyse, { etat: "fait", par: "manuel", date: Date.now() });
    sauverItem(it);
  });
}
function ajouterACollection(ids, collId) {
  ids.forEach(function (id) {
    var it = Store.items[id];
    if (!it) return;
    it.collections = it.collections || [];
    if (it.collections.indexOf(collId) < 0) { it.collections.push(collId); sauverItem(it); }
  });
}
function creerCollection(nom) {
  nom = sansEmoji(nom).slice(0, 50);
  if (!nom) return null;
  var ex = Object.keys(Store.colls).map(function (k) { return Store.colls[k]; }).filter(function (c) { return norm(c.nom) === norm(nom); })[0];
  if (ex) return ex;
  var c = { id: "c-" + uid(), nom: nom, cree: Date.now() };
  sauverColl(c);
  return c;
}

function fusionnerItems(garderId, retirerId) {
  var a = Store.items[garderId], b = Store.items[retirerId];
  if (!a || !b) return;
  var union = function (x, y) { (y || []).forEach(function (v) { if (x.indexOf(v) < 0) x.push(v); }); return x; };
  a.cats = union(a.cats || [], b.cats);
  a.catsManuelles = union(a.catsManuelles || [], b.catsManuelles);
  a.tags = union(a.tags || [], b.tags);
  a.collections = union(a.collections || [], b.collections);
  a.collectionsOrigine = union(a.collectionsOrigine || [], b.collectionsOrigine);
  if (b.note) a.note = a.note ? a.note + "\n" + b.note : b.note;
  if (!a.legende && b.legende) a.legende = b.legende;
  if (!a.vignette && b.vignette) { a.vignette = b.vignette; a.ratio = b.ratio; }
  if (!a.recette && b.recette) a.recette = b.recette;
  if (!a.lieu && b.lieu) a.lieu = b.lieu;
  a.favori = a.favori || b.favori;
  a.autresLiens = union(a.autresLiens || [], b.url ? [b.url] : []);
  sauverItem(a);
  supprimerItem(b.id);
  journal("Doublon fusionné : « " + a.titre + " ».");
}

function remplacerCat(it, map) {
  var change = false;
  ["cats", "catsManuelles"].forEach(function (k) {
    var out = [];
    (it[k] || []).forEach(function (c) {
      var n = Object.prototype.hasOwnProperty.call(map, c) ? map[c] : c;
      if (n !== c) change = true;
      if (n && out.indexOf(n) < 0) out.push(n);
    });
    it[k] = out;
  });
  return change;
}

function fusionnerCats(srcId, cibleId) {
  var src = Store.cats[srcId], cible = Store.cats[cibleId];
  if (!src || !cible || srcId === cibleId) return;
  var map = {};
  map[srcId] = cibleId;
  if (!src.parent) {
    enfants(srcId).forEach(function (s) {
      if (cible.parent) { map[s.id] = cibleId; supprimerCatDoc(s.id); return; }
      var jumelle = trouverCat(s.nom, cibleId);
      if (jumelle) { map[s.id] = jumelle.id; supprimerCatDoc(s.id); }
      else { var d = Object.assign({}, s, { parent: cibleId }); sauverCat(d); }
    });
  }
  tousItems().forEach(function (it) { if (remplacerCat(it, map)) sauverItem(it); });
  supprimerCatDoc(srcId);
  journal("Catégorie « " + src.nom + " » fusionnée dans « " + cible.nom + " ».");
}
function supprimerCat(id) {
  var c = Store.cats[id];
  if (!c) return;
  var map = {};
  map[id] = null;
  if (!c.parent) enfants(id).forEach(function (s) { map[s.id] = null; supprimerCatDoc(s.id); });
  tousItems().forEach(function (it) { if (remplacerCat(it, map)) sauverItem(it); });
  supprimerCatDoc(id);
  journal("Catégorie « " + c.nom + " » supprimée.");
}

async function exporterDonnees() {
  var donnees = {
    application: "Mes Pépites", format: 1, exporte_le: new Date().toISOString(),
    categories: Object.keys(Store.cats).map(function (k) { return Store.cats[k]; }),
    collections: Object.keys(Store.colls).map(function (k) { return Store.colls[k]; }),
    contenus: tousItems(),
    reglages: { prenom: Store.reg.prenom, sources: Store.reg.sources, historique: Store.reg.historique }
  };
  var txt = JSON.stringify(donnees, null, 2);
  var nom = "mes-pepites-" + new Date().toISOString().slice(0, 10) + ".json";
  if (Telechargement) {
    try { await Telechargement.save({ filename: nom, data: txt }); toast("Export enregistré"); }
    catch (e) { if (!(e && e.code === "declined")) toast("L'export n'a pas pu être enregistré.", true); }
    return;
  }
  if (!EN_ARTIFACT) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" }));
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    return;
  }
  // Sans la permission de téléchargement : le texte, à copier.
  var z = $("#exportSecours");
  if (z) z.innerHTML = '<div class="field" style="margin-top:14px"><label for="exportTexte">Copie ce texte dans un fichier .json</label><textarea id="exportTexte" rows="6" readonly>' + esc(txt) + '</textarea></div>';
}

/* ==================================================================
   EXEMPLES
   Marqués comme tels partout, sans lien vers une publication : ils
   montrent l'appli remplie, jamais comme si c'étaient tes contenus.
   ================================================================== */

function exemples() {
  var j = 864e5, t = Date.now();
  var E = function (id, plat, type, createur, jours, titre, cats, extra) {
    return Object.assign({
      id: "demo-" + id, url: null, plateforme: plat, type: type, createur: createur, ajoute: t - jours * j, importe: t - jours * j,
      source: "exemple", demo: true, legende: "", note: "", vignette: null, titre: titre, resume: "",
      cats: cats, catsManuelles: [], tagsAuto: [], tags: [], favori: false, collections: [], collectionsOrigine: [],
      recette: null, lieu: null, analyse: { etat: "fait", par: "ia", conf: "haute", date: t - jours * j }, modifie: t
    }, extra);
  };
  var R = function (nom, ingr, etapes, temps, diff, repas, portions, o) {
    return Object.assign({ nom: nom, ingredients: ingr.map(function (x) { return { nom: x[0], qte: x[1] || "" }; }), etapes: etapes, temps: temps,
      difficulte: diff, repas: repas, portions: portions, vegetarien: false, healthy: false, nutrition: null, source: "legende" }, o);
  };
  return [
    E("pates-poulet", "tiktok", "video", "exemple.cuisine", 1, "Pâtes crémeuses au poulet", ["recettes:diner", "recettes:pates", "recettes:poulet", "recettes:recettes-rapides"], {
      resume: "Un plat du soir en 20 minutes : poulet doré, sauce crème-parmesan à l'ail, pâtes enrobées.",
      tagsAuto: ["pates", "poulet", "creme", "parmesan", "ail"], favori: true,
      recette: R("Pâtes crémeuses au poulet", [["pâtes", "250 g"], ["blanc de poulet", "2"], ["crème liquide", "20 cl"], ["parmesan râpé", "50 g"], ["ail", "2 gousses"], ["huile d'olive", "1 c. à s."], ["sel, poivre", ""]],
        ["Faire cuire les pâtes.", "Faire revenir le poulet en dés avec l'ail.", "Ajouter la crème et le parmesan, laisser épaissir 2 minutes.", "Mélanger avec les pâtes égouttées."],
        20, "Facile", ["diner"], 2, { nutrition: { kcal: 780, proteines: 48, glucides: 88, lipides: 26 } })
    }),
    E("granola", "instagram", "reel", "exemple.brunch", 3, "Granola maison noisettes et miel", ["recettes:petit-dejeuner", "recettes:healthy"], {
      resume: "Flocons d'avoine, noisettes concassées et miel, cuits 25 minutes : un bocal pour la semaine.",
      tagsAuto: ["granola", "noisettes", "avoine", "miel"],
      recette: R("Granola noisettes et miel", [["flocons d'avoine", "300 g"], ["noisettes", "100 g"], ["miel", "4 c. à s."], ["huile de coco", "3 c. à s."], ["cannelle", "1 pincée"]],
        ["Préchauffer le four à 160 °C.", "Mélanger tous les ingrédients.", "Étaler sur une plaque et cuire 25 minutes en remuant à mi-cuisson.", "Laisser refroidir avant de mettre en bocal."],
        35, "Facile", ["petit-dejeuner"], 8, { vegetarien: true, healthy: true })
    }),
    E("toast-avocat", "tiktok", "video", "exemple.healthy", 6, "Toast avocat et œuf mollet", ["recettes:petit-dejeuner", "recettes:healthy", "recettes:recettes-rapides"], {
      resume: "Pain grillé, avocat écrasé au citron, œuf mollet de 6 minutes et piment d'Espelette.",
      tagsAuto: ["avocat", "oeuf", "toast", "brunch"],
      recette: R("Toast avocat et œuf mollet", [["pain de campagne", "2 tranches"], ["avocat", "1"], ["œufs", "2"], ["citron", "½"], ["piment d'Espelette", ""]],
        ["Cuire les œufs 6 minutes dans l'eau bouillante, puis les écaler.", "Écraser l'avocat avec le citron.", "Tartiner le pain grillé et poser l'œuf dessus."],
        12, "Facile", ["petit-dejeuner", "dejeuner"], 2, { vegetarien: true, healthy: true })
    }),
    E("gratin-courgettes", "instagram", "carrousel", "exemple.cuisine", 9, "Gratin de courgettes au poulet et parmesan", ["recettes:diner"], {
      tagsAuto: ["courgettes", "poulet", "parmesan", "gratin"],
      recette: R("Gratin de courgettes au poulet", [["courgettes", "3"], ["poulet", "300 g"], ["parmesan", "60 g"], ["crème fraîche", "15 cl"], ["œuf", "1"]],
        ["Couper les courgettes en rondelles et les faire revenir.", "Ajouter le poulet en morceaux.", "Mélanger crème, œuf et moitié du parmesan, verser dessus.", "Parsemer du reste de parmesan et gratiner 25 minutes à 200 °C."],
        45, "Facile", ["diner"], 4)
    }),
    E("tiramisu", "tiktok", "video", "exemple.dessert", 14, "Tiramisu express au spéculoos", ["recettes:desserts", "recettes:recettes-rapides"], {
      tagsAuto: ["tiramisu", "speculoos", "mascarpone"],
      recette: R("Tiramisu au spéculoos", [["mascarpone", "250 g"], ["spéculoos", "12"], ["œufs", "2"], ["sucre", "50 g"], ["café", "1 tasse"]],
        ["Fouetter les jaunes avec le sucre, ajouter le mascarpone.", "Monter les blancs et les incorporer.", "Tremper les spéculoos dans le café et alterner avec la crème.", "Réserver au frais au moins 2 heures."],
        15, "Facile", ["dessert"], 4, { vegetarien: true })
    }),
    E("trattoria-chicago", "instagram", "reel", "exemple.voyages", 5, "Trattoria italienne à Chicago", ["voyages:restaurants"], {
      resume: "Pâtes fraîches faites à la minute et tiramisu maison, dans le West Loop. Réservation conseillée.",
      tagsAuto: ["italien", "restaurant", "chicago", "pates fraiches"], lieu: { nom: "Trattoria (exemple)", ville: "Chicago", pays: "États-Unis" }
    }),
    E("hotel-piscine", "instagram", "publication", "exemple.voyages", 20, "Hôtel avec piscine à débordement à Majorque", ["voyages:hotels", "voyages:destinations"], {
      resume: "Petit hôtel dans les collines, piscine face à la mer, à 20 minutes de Palma.",
      tagsAuto: ["hotel", "piscine", "majorque", "espagne"], lieu: { nom: null, ville: "Majorque", pays: "Espagne" }
    }),
    E("robe-noire", "tiktok", "video", "exemple.mode", 2, "Une robe noire, trois façons de la porter", ["mode:tenues", "mode:inspirations"], {
      resume: "Robe noire en satin : avec baskets le jour, blazer au bureau, sandales à talons le soir.", tagsAuto: ["robe noire", "satin", "capsule"]
    }),
    E("abdos", "tiktok", "video", "exemple.sport", 4, "10 minutes d'abdos sans matériel", ["sport:exercices", "sport:programmes"], {
      resume: "Gainage, crunchs, relevés de jambes et mountain climbers : 40 secondes d'effort, 20 de repos.", tagsAuto: ["abdos", "gainage", "sans materiel", "maison"]
    }),
    E("boucles", "instagram", "reel", "exemple.beaute", 11, "Routine pour cheveux bouclés", ["beaute:cheveux"], {
      tagsAuto: ["boucles", "cheveux", "routine"]
    }),
    E("placard", "tiktok", "video", "exemple.maison", 16, "Ranger un placard d'entrée étroit", ["maison:rangement"], {
      tagsAuto: ["rangement", "entree", "placard"]
    }),
    E("series", "instagram", "carrousel", "exemple.series", 8, "Cinq séries à regarder cet automne", ["films:series"], {
      tagsAuto: ["series", "automne", "a regarder"]
    })
  ];
}

function chargerExemples() {
  if (!Object.keys(Store.cats).length) { var d = catsParDefaut(); Object.keys(d).forEach(function (k) { sauverCat(d[k]); }); }
  exemples().forEach(function (it) { if (!Store.items[it.id]) sauverItem(it); });
  journal("Exemples ajoutés.");
  toast("Exemples ajoutés. Tu peux les retirer depuis les réglages.");
}

/* ==================================================================
   PREMIER LANCEMENT
   ================================================================== */

function vueOnboarding() {
  var e = ICI.onb, cloud = Store.mode === "cloud";
  var points = '<div class="onb-points" aria-hidden="true">' + [1, 2, 3].map(function (i) { return '<i class="' + (i === e ? "on" : "") + '"></i>'; }).join("") + '</div>';
  var h = '<div class="onb"><div class="onb-carte">';
  if (e === 1) {
    h += '<h2>Tout ce que tu enregistres, enfin rangé.</h2>' +
      '<p class="intro">Recettes, adresses, tenues, exercices : les pépites que tu mets de côté sur Instagram et TikTok arrivent ici, se rangent seules, et se retrouvent en une phrase.</p>' +
      '<div class="cycle">' +
        '<div><span class="tache t-peche"><span class="illu st-fraise"></span></span><b>Je sauvegarde</b><span>un export, un lien partagé</span></div>' +
        '<div><span class="tache t-lavande b2"><span class="illu st-meduse"></span></span><b>L\'appli analyse</b><span>légende, auteur, image</span></div>' +
        '<div><span class="tache t-rose b3"><span class="illu st-coquillage"></span></span><b>Elle classe</b><span>catégories, recettes, lieux</span></div>' +
        '<div><span class="tache t-jaune b4"><span class="illu st-etoile"></span></span><b>Je retrouve</b><span>« pâtes au poulet »</span></div>' +
      '</div>' +
      '<div class="onb-bas">' + points + '<button type="button" class="btn go" data-action="onb" data-e="2">Commencer</button></div>';
  } else if (e === 2) {
    h += '<h2>Ton espace</h2>' +
      '<form data-form="onb-prenom" class="field"><label for="onbPrenom">Ton prénom (facultatif)</label><input type="text" id="onbPrenom" maxlength="40" autocomplete="given-name" value="' + esc(Store.reg.prenom) + '" placeholder="Pour personnaliser l\'accueil"></form>' +
      '<p class="sync ' + (cloud ? "cloud" : "local") + '"><span class="dot"></span>' + (cloud
        ? "Ton compte, c'est ton compte claude.ai : ton espace y est privé, tu le retrouves sur ton téléphone comme sur ton ordinateur, et personne d'autre ne le voit, même si tu partages cette page."
        : EN_ARTIFACT ? "Ton compte claude.ai n'a pas encore répondu : tes pépites sont gardées dans ce navigateur et y seront recopiées dès qu'il répond."
        : "Tes pépites sont enregistrées dans ce navigateur.") + '</p>' +
      '<p class="prose">Aucun mot de passe Instagram ou TikTok ne te sera demandé. Tu pourras exporter tes données ou supprimer ton espace à tout moment depuis les réglages.</p>' +
      '<div class="onb-bas">' + points + '<div class="boutons" style="margin:0"><button type="button" class="btn ghost" data-action="onb" data-e="1">Retour</button><button type="button" class="btn go" data-action="onb" data-e="3">Continuer</button></div></div>';
  } else {
    h += '<h2>D\'où viennent tes pépites ?</h2>' +
      '<p class="intro">Ni Instagram ni TikTok ne laissent une appli lire tes enregistrements automatiquement. Voici ce qui marche vraiment aujourd\'hui.</p>' +
      '<div class="onb-sources">' +
        '<div class="onb-src"><h3><span class="tache t-rose" style="width:44px;height:44px"><span class="illu st-hibiscus"></span></span>Instagram</h3>' +
          '<span>Tes publications enregistrées et tes collections, via l\'export officiel « Exporter vos informations ».</span>' +
          '<button type="button" class="btn go sm" data-action="onb-fin" data-suite="export-instagram">Importer mon export</button></div>' +
        '<div class="onb-src"><h3><span class="tache t-lavande b2" style="width:44px;height:44px"><span class="illu st-meduse"></span></span>TikTok</h3>' +
          '<span>Tes favoris (et tes likes si tu veux), via l\'export officiel « Télécharger tes données ».</span>' +
          '<button type="button" class="btn go sm" data-action="onb-fin" data-suite="export-tiktok">Importer mon export</button></div>' +
        '<div class="onb-src"><h3><span class="tache t-peche b3" style="width:44px;height:44px"><span class="illu st-framboise"></span></span>Au quotidien</h3>' +
          '<span>Partager › Copier le lien, puis colle-le ici. Plusieurs liens d\'un coup, c\'est possible.</span>' +
          '<button type="button" class="btn go sm" data-action="onb-fin" data-suite="liens">Coller un lien</button></div>' +
      '</div>' +
      '<div class="onb-bas">' + points + '<div class="boutons" style="margin:0"><button type="button" class="btn ghost" data-action="onb-fin" data-suite="exemples">Explorer avec des exemples</button>' +
      '<button type="button" class="btn ghost" data-action="onb-fin">Plus tard</button></div></div>';
  }
  return h + '</div></div>';
}

function finirOnboarding(suite) {
  var p = $("#onbPrenom");
  if (p) Store.reg.prenom = p.value.trim().slice(0, 40);
  Store.reg.onboarde = true;
  if (!Object.keys(Store.cats).length) {
    var d = catsParDefaut();
    Object.keys(d).forEach(function (k) { sauverCat(d[k]); });
  }
  journal("Espace créé.");
  allerA("accueil");
  if (suite === "exemples") chargerExemples();
  else if (suite === "liens") ouvrirAjout("liens");
  else if (suite && suite.indexOf("export-") === 0) ouvrirAjout("export", suite.slice(7));
}
