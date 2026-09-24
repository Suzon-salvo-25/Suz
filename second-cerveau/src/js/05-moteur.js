
/* ==================================================================
   RENDU
   ================================================================== */

var Telechargement = null;
var rafPrevu = false;

function rendreBientot() {
  if (rafPrevu) return;
  rafPrevu = true;
  requestAnimationFrame(function () { rafPrevu = false; rendre(); });
}

// Reconstruire sans perdre le champ en cours de saisie ni le défilement.
function avecFocus(racineEl, fn) {
  var a = document.activeElement, etat = null;
  if (a && a.id && racineEl.contains(a) && ("value" in a)) {
    etat = { id: a.id, v: a.value, s: a.selectionStart, e: a.selectionEnd };
  } else if (a && a.id && racineEl.contains(a)) {
    etat = { id: a.id };
  }
  var haut = racineEl.scrollTop;
  fn();
  racineEl.scrollTop = haut;
  if (etat) {
    var el = document.getElementById(etat.id);
    if (el) {
      if ("v" in etat && el.type !== "file" && el.type !== "checkbox") el.value = etat.v;
      el.focus({ preventScroll: true });
      try { if (etat.s != null && el.setSelectionRange) el.setSelectionRange(etat.s, etat.e); } catch (e) {}
    }
  }
}

var VUES = { accueil: vueAccueil, recettes: vueRecettes, tout: vueTout, categories: vueCategories, reglages: vueReglages };

function banniereAnalyse() {
  var b = $("#banniere");
  if (IA.enCours || IA.file.length) {
    var pct = IA.total ? Math.round(IA.fait / IA.total * 100) : 0;
    b.innerHTML = '<div class="analyse-banniere"><span class="illu-mini st-meduse" aria-hidden="true" style="margin:0"></span>' +
      '<span>Claude analyse tes pépites · <b>' + IA.fait + ' / ' + IA.total + '</b></span>' +
      '<span class="jauge"><i style="width:' + pct + '%"></i></span>' +
      '<button type="button" class="btn ghost sm" data-action="arreter-analyse">Arrêter</button></div>';
  } else if (IA.erreur) {
    b.innerHTML = '<div class="analyse-banniere" style="background:color-mix(in srgb, var(--rouge) 14%, var(--panel))"><span class="illu-mini st-grenade" aria-hidden="true" style="margin:0"></span>' +
      '<span style="flex:1 1 200px">' + esc(IA.erreur) + (IA.file.length ? " " + pluriel(IA.file.length, "élément") + " en attente, déjà rangé" + (IA.file.length > 1 ? "s" : "") + " par mots-clés." : "") + '</span>' +
      (IA.file.length && iaDispo() ? '<button type="button" class="btn ghost sm" data-action="reprendre-analyse">Reprendre</button>' : "") +
      '<button type="button" class="btn ghost sm" data-action="fermer-erreur">OK</button></div>';
  } else b.innerHTML = "";
}

function barreSelection() {
  var bar = $("#actionBar");
  document.body.classList.toggle("selection", ICI.modeSel);
  if (!ICI.modeSel || ICI.vue !== "tout") { bar.hidden = true; return; }
  var n = ICI.sel.size;
  bar.hidden = false;
  var h;
  if (ICI.barre === "retirer") {
    h = '<span class="conf">Retirer ' + pluriel(n, "élément") + ' de l\'appli ? Les originaux restent en ligne.</span>' +
      '<button type="button" class="btn danger sm" data-action="sel-retirer-ok">Retirer</button><button type="button" class="btn sm" data-action="sel-barre" data-b="">Annuler</button>';
  } else if (ICI.barre === "coll") {
    h = '<form data-form="sel-coll" style="display:flex;gap:8px;align-items:center"><input type="text" id="selCollNom" maxlength="50" placeholder="Nom de la collection" style="height:38px;padding:6px 12px;background:var(--ground);color:var(--ink);border-color:transparent" aria-label="Nom de la nouvelle collection">' +
      '<button type="submit" class="btn go sm">Créer et ajouter</button></form><button type="button" class="btn sm" data-action="sel-barre" data-b="">Annuler</button>';
  } else {
    var colls = Object.keys(Store.colls).map(function (k) { return Store.colls[k]; });
    h = '<span class="n">' + pluriel(n, "choisi") + '</span>' +
      '<select id="selDeplacer" aria-label="Déplacer vers"' + (n ? "" : " disabled") + '><option value="">Déplacer vers…</option>' + optionsCats("", false) + '</select>' +
      '<select id="selColl" aria-label="Ajouter à une collection"' + (n ? "" : " disabled") + '><option value="">Ajouter à une collection…</option>' +
        colls.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nom) + '</option>'; }).join("") + '<option value="__nouvelle">＋ Nouvelle collection…</option></select>' +
      (iaDispo() ? '<button type="button" class="btn go sm" data-action="sel-ia"' + (n ? "" : " disabled") + '>Reclasser avec Claude</button>' : '<button type="button" class="btn sm" data-action="sel-regles"' + (n ? "" : " disabled") + '>Reclasser</button>') +
      '<button type="button" class="btn sm" data-action="sel-barre" data-b="retirer"' + (n ? "" : " disabled") + '>Retirer</button>' +
      '<button type="button" class="btn sm" data-action="mode-sel">Terminer</button>';
  }
  avecFocus(bar, function () { bar.innerHTML = h; });
}

function rendre() {
  var vue = $("#vue");
  var tabs = $("#tabs"), outils = $("#mastTools"), fab = $("#fab");
  if (!Store.pret) {
    tabs.hidden = true; fab.hidden = true; outils.style.visibility = "hidden";
    vue.innerHTML = '<div class="chargement"><span class="illu st-soleil" aria-hidden="true"></span><span>Ouverture de ton espace…</span></div>';
    return;
  }
  outils.style.visibility = "";
  if (!Store.reg.onboarde) {
    tabs.hidden = true; fab.hidden = true;
    $("#ajoutBtn").hidden = true; $("#reglagesBtn").hidden = true;
    $("#banniere").innerHTML = "";
    avecFocus(vue, function () { vue.innerHTML = vueOnboarding(); });
    return;
  }
  tabs.hidden = false; fab.hidden = false;
  $("#ajoutBtn").hidden = false; $("#reglagesBtn").hidden = false;
  $("#brandSub").textContent = Store.reg.prenom ? "Le second cerveau de " + Store.reg.prenom : "Second cerveau · Instagram & TikTok";
  var items = tousItems();
  $("#nbTout").textContent = items.length || "";
  var nr = items.filter(estRecette).length;
  $("#nbRec").textContent = nr || "";
  $$("#tabs .tab").forEach(function (t) { t.setAttribute("aria-selected", String(t.getAttribute("data-vue") === ICI.vue)); });
  $("#reglagesBtn").setAttribute("aria-pressed", String(ICI.vue === "reglages"));
  banniereAnalyse();
  avecFocus(vue, function () { vue.innerHTML = (VUES[ICI.vue] || vueAccueil)(); });
  barreSelection();
  rendreFiche();
  rendreAjout();
}

function allerA(v) {
  if (!VUES[v]) v = "accueil";
  if (ICI.vue !== v) {
    ICI.vue = v;
    ICI.catEdit = null; ICI.collEdit = null; ICI.confirm = null;
    if (v !== "tout") { ICI.modeSel = false; ICI.sel.clear(); ICI.barre = null; }
    window.scrollTo(0, 0);
  }
  try { localStorage.setItem(LS_VUE, v); } catch (e) {}
  if (location.hash !== "#" + v) { try { history.replaceState(null, "", "#" + v); } catch (e) {} }
  rendreBientot();
}

function voirTout(filtres) {
  ICI.tout = Object.assign({ texte: "", plat: "", cat: "", createur: "", type: "", periode: "", coll: "", fav: false, acompleter: false, doublons: false, tri: "recent" }, filtres);
  ICI.limite = 60;
  allerA("tout");
}

/* ==================================================================
   ÉVÉNEMENTS
   ================================================================== */

document.addEventListener("click", function (ev) {
  var cible = ev.target.closest("[data-action]");
  if (!cible) return;
  var act = cible.getAttribute("data-action"), d = cible.dataset;
  var it = d.id ? Store.items[d.id] : null;
  switch (act) {
    case "vue": allerA(d.vue); break;
    case "fiche": if (ICI.modeSel && !cible.closest("dialog")) { basculerSel(d.id); } else ouvrirFiche(d.id); break;
    case "cocher": basculerSel(d.id); break;
    case "fermer-fiche": $("#fiche").close(); break;
    case "fermer-ajout": $("#ajout").close(); break;
    case "ouvrir-ajout": ouvrirAjout(d.onglet, d.plat); break;
    case "ajout-onglet": ICI.ajout.onglet = d.onglet; rendreAjout(); break;
    case "ajout-plat": ICI.ajout.plat = d.plat; rendreAjout(); break;
    case "ajouter-liens": ajouterLiens(); break;
    case "importer": importer(); break;
    case "charger-exemples": chargerExemples(); break;

    case "effacer-q": ICI.q = ""; ICI.ia = null; rendreBientot(); setTimeout(function () { var q = $("#q"); if (q) q.focus(); }, 30); break;
    case "exemple-q":
      ICI.q = d.q; ICI.ia = null; rendreBientot();
      break;
    case "voir-cat": voirTout({ cat: d.cat }); break;
    case "voir-coll": voirTout({ coll: d.id }); break;
    case "voir-acompleter": voirTout({ acompleter: true }); break;
    case "voir-favoris": voirTout({ fav: true }); break;

    case "filtre-rec":
      var f = ICI.rec.filtres, i = f.indexOf(d.f);
      if (i >= 0) f.splice(i, 1); else f.push(d.f);
      rendreBientot(); break;
    case "effacer-frigo": ICI.rec.frigo = ""; rendreBientot(); break;

    case "toggle-tout": ICI.tout[d.k] = !ICI.tout[d.k]; ICI.limite = 60; rendreBientot(); break;
    case "reset-tout": voirTout({}); break;
    case "plus": ICI.limite += 60; rendreBientot(); break;
    case "mode-sel":
      ICI.modeSel = !ICI.modeSel; ICI.sel.clear(); ICI.barre = null; rendreBientot(); break;
    case "tout-selectionner":
      var l = filtrerTout();
      if (ICI.sel.size >= l.length) ICI.sel.clear(); else l.forEach(function (x) { ICI.sel.add(x.id); });
      rendreBientot(); break;
    case "sel-barre": ICI.barre = d.b || null; rendreBientot(); break;
    case "sel-retirer-ok":
      var n = ICI.sel.size;
      ICI.sel.forEach(function (id) { supprimerItem(id); });
      journal(pluriel(n, "élément retiré", "éléments retirés") + " de l'appli.");
      ICI.sel.clear(); ICI.barre = null; toast(pluriel(n, "élément retiré", "éléments retirés")); rendreBientot(); break;
    case "sel-ia":
      lancerAnalyse(Array.from(ICI.sel));
      toast("Claude reclasse " + pluriel(ICI.sel.size, "élément") + ".");
      ICI.modeSel = false; ICI.sel.clear(); rendreBientot(); break;
    case "sel-regles":
      ICI.sel.forEach(function (id) { if (Store.items[id]) reclasserUn(Store.items[id]); });
      toast(pluriel(ICI.sel.size, "élément reclassé", "éléments reclassés")); ICI.sel.clear(); rendreBientot(); break;

    case "cat-mode":
      ICI.catEdit = (ICI.catEdit && ICI.catEdit.id === (d.id || null) && ICI.catEdit.mode === d.mode) ? null : { id: d.id || null, mode: d.mode };
      rendreBientot();
      setTimeout(function () { var c = $("#catNom") || $("#catCible"); if (c) { c.focus(); if (c.select) c.select(); } }, 40);
      break;
    case "cat-annuler": ICI.catEdit = null; rendreBientot(); break;
    case "cat-supprimer": supprimerCat(d.id); ICI.catEdit = null; toast("Catégorie supprimée"); break;
    case "coll-mode": ICI.collEdit = { id: d.id, mode: d.mode }; rendreBientot(); break;
    case "coll-annuler": ICI.collEdit = null; rendreBientot(); break;
    case "coll-supprimer":
      var cn = Store.colls[d.id] && Store.colls[d.id].nom;
      tousItems().forEach(function (x) {
        var k = (x.collections || []).indexOf(d.id);
        if (k >= 0) { x.collections.splice(k, 1); sauverItem(x); }
      });
      supprimerCollDoc(d.id); ICI.collEdit = null; journal("Collection « " + cn + " » supprimée."); break;

    case "favori":
      if (!it) break;
      it.favori = !it.favori; sauverItem(it); break;
    case "edit-titre": ICI.ficheTitre = true; rendreFiche(); setTimeout(function () { var x = $("#ficheTitreInput"); if (x) { x.focus(); x.select(); } }, 30); break;
    case "reanalyser":
      if (!it) break;
      lancerAnalyse([it.id]); toast("Claude relit cette pépite…"); break;
    case "reclasser-un":
      if (!it) break;
      reclasserUn(it); toast("Reclassé"); break;
    case "retirer-cat":
      if (!it) break;
      it.cats = (it.cats || []).filter(function (c) { return c !== d.cat; });
      it.catsManuelles = (it.catsManuelles || []).filter(function (c) { return c !== d.cat; });
      it.analyse = Object.assign({}, it.analyse, { par: "manuel", etat: it.cats.length ? "fait" : "vide" });
      sauverItem(it); break;
    case "retirer-tag":
      if (!it) break;
      it.tags = (it.tags || []).filter(function (t) { return t !== d.tag; }); sauverItem(it); break;
    case "retirer-coll":
      if (!it) break;
      it.collections = (it.collections || []).filter(function (c) { return c !== d.coll; }); sauverItem(it); break;
    case "retirer-capture":
      if (!it) break;
      it.vignette = null; it.ratio = null; delete IA.images[it.id]; sauverItem(it); break;
    case "fusionner-items":
      fusionnerItems(d.id, d.autre); toast("Doublon fusionné"); break;
    case "demander-retrait": ICI.ficheConfirm = true; rendreFiche(); break;
    case "annuler-retrait": ICI.ficheConfirm = false; rendreFiche(); break;
    case "retirer-item":
      if (!it) break;
      journal("« " + it.titre + " » retiré de l'appli.");
      supprimerItem(it.id); $("#fiche").close(); toast("Retiré de l'appli. L'original n'a pas bougé."); break;

    case "confirmer": ICI.confirm = { quoi: d.quoi }; rendreBientot(); break;
    case "annuler-confirm": ICI.confirm = null; rendreBientot(); break;
    case "deconnecter":
      var plat = d.plat, garder = d.garder === "1", nb = 0;
      if (!garder) tousItems().forEach(function (x) { if (x.plateforme === plat) { supprimerItem(x.id); nb++; } });
      Store.reg.sources = Object.assign({}, Store.reg.sources);
      delete Store.reg.sources[plat];
      journal(nomPlat(plat) + " déconnecté" + (garder ? ", contenus gardés." : ", " + pluriel(nb, "contenu retiré", "contenus retirés") + "."));
      ICI.confirm = null; toast(nomPlat(plat) + " déconnecté"); break;
    case "recreer-collections":
      var faites = {}, n2 = 0;
      tousItems().forEach(function (x) {
        (x.collectionsOrigine || []).forEach(function (nom) {
          var c = faites[nom] || (faites[nom] = creerCollection(nom));
          if (c && (x.collections || []).indexOf(c.id) < 0) { x.collections = (x.collections || []).concat(c.id); sauverItem(x); n2++; }
        });
      });
      journal(pluriel(Object.keys(faites).length, "collection Instagram recréée", "collections Instagram recréées") + ".");
      toast(pluriel(Object.keys(faites).length, "collection recréée", "collections recréées") + " · " + pluriel(n2, "ajout"));
      break;
    case "analyser":
      var ids = tousItems().filter(function (x) {
        return d.quoi === "acompleter" ? aCompleter(x) && !x.demo : !(x.analyse && x.analyse.par === "ia") && !x.demo;
      }).map(function (x) { return x.id; });
      lancerAnalyse(ids); break;
    case "reclasser-regles":
      tousItems().forEach(function (x) { if (!x.demo) reclasserUn(x); });
      toast("Tout est reclassé par mots-clés"); break;
    case "exporter": exporterDonnees(); break;
    case "retirer-exemples":
      tousItems().forEach(function (x) { if (x.demo) supprimerItem(x.id); });
      journal("Exemples retirés."); toast("Exemples retirés"); break;
    case "vider":
      var nv = 0;
      tousItems().forEach(function (x) { supprimerItem(x.id); nv++; });
      journal(pluriel(nv, "contenu supprimé", "contenus supprimés") + ".");
      ICI.confirm = null; toast("Contenus supprimés"); break;
    case "supprimer-compte": supprimerCompte(); break;

    case "arreter-analyse": arreterAnalyse(); break;
    case "reprendre-analyse": IA.erreur = ""; IA.total = IA.fait + IA.file.length; boucleAnalyse(); break;
    case "fermer-erreur": IA.erreur = ""; IA.file = []; IA.fait = 0; IA.total = 0; rendreBientot(); break;

    case "onb":
      var pr = $("#onbPrenom");
      if (pr) Store.reg.prenom = pr.value.trim().slice(0, 40);
      ICI.onb = +d.e; rendreBientot(); break;
    case "onb-fin": finirOnboarding(d.suite); break;
  }
});

function basculerSel(id) {
  if (!ICI.modeSel) { ICI.modeSel = true; ICI.sel.clear(); }
  if (ICI.sel.has(id)) ICI.sel.delete(id); else ICI.sel.add(id);
  rendreBientot();
}

function supprimerCompte() {
  arreterAnalyse();
  tousItems().forEach(function (x) { supprimerItem(x.id); });
  Object.keys(Store.cats).forEach(function (k) { supprimerCatDoc(k); });
  Object.keys(Store.colls).forEach(function (k) { supprimerCollDoc(k); });
  Store.reg = regDefaut();
  clearTimeout(regT);
  if (Store.mode === "cloud") planifier(Store.refs.base, null);
  try { localStorage.removeItem(LS); localStorage.removeItem(LS_VUE); } catch (e) {}
  ICI.confirm = null; ICI.onb = 1; ICI.vue = "accueil";
  toast("Ton espace a été supprimé.");
  rendreBientot();
}

var qT = null;
document.addEventListener("input", function (ev) {
  var t = ev.target, id = t.id;
  if (id === "q") {
    ICI.q = t.value;
    if (ICI.ia && ICI.ia.q !== ICI.q) { if (ICI.iaCtl) ICI.iaCtl.abort(); ICI.iaCtl = null; ICI.ia = null; }
    clearTimeout(qT); qT = setTimeout(rendreBientot, 140);
  } else if (id === "toutTexte") {
    ICI.tout.texte = t.value; ICI.limite = 60;
    clearTimeout(qT); qT = setTimeout(rendreBientot, 160);
  } else if (id === "frigo") {
    ICI.rec.frigo = t.value;
    clearTimeout(qT); qT = setTimeout(rendreBientot, 160);
  } else if (id === "ajLiens") {
    ICI.ajout.liens = t.value;
    clearTimeout(qT); qT = setTimeout(rendreAjout, 250);
  } else if (id === "ajLegende") ICI.ajout.legende = t.value;
  else if (id === "ajNote") ICI.ajout.note = t.value;
  else if (id === "ficheNote" || id === "ficheLegende") {
    var it = Store.items[ICI.fiche];
    if (!it) return;
    var champ = id === "ficheNote" ? "note" : "legende";
    it[champ] = t.value.slice(0, 5000);
    clearTimeout(t._t);
    t._t = setTimeout(function () { sauverItem(it); }, 700);
  }
});

document.addEventListener("change", function (ev) {
  var t = ev.target, id = t.id;
  var filtresTout = { fPlat: "plat", fCat: "cat", fCreateur: "createur", fType: "type", fPeriode: "periode", fColl: "coll", fTri: "tri" };
  if (filtresTout[id]) { ICI.tout[filtresTout[id]] = t.value; ICI.limite = 60; rendreBientot(); return; }
  var it = Store.items[ICI.fiche];
  if (id === "ficheAjoutCat" && it && t.value) {
    if ((it.cats || []).indexOf(t.value) < 0) it.cats = (it.cats || []).concat(t.value);
    it.catsManuelles = (it.catsManuelles || []).concat(t.value);
    it.analyse = Object.assign({}, it.analyse, { par: "manuel", etat: "fait" });
    sauverItem(it);
  } else if (id === "ficheAjoutColl" && it && t.value) {
    if (t.value === "__nouvelle") { ICI.ficheNouvelleColl = true; rendreFiche(); setTimeout(function () { var x = $("#ficheCollNom"); if (x) x.focus(); }, 30); }
    else { ajouterACollection([it.id], t.value); }
  } else if (id === "ficheCapture" && it && t.files && t.files[0]) {
    preparerImage(t.files[0]).then(function (img) {
      if (!img) { toast("Cette image n'a pas pu être lue.", true); return; }
      it.vignette = img.vignette; it.ratio = img.ratio; IA.images[it.id] = img.ia;
      sauverItem(it);
      if (iaDispo()) { lancerAnalyse([it.id]); toast("Capture ajoutée. Claude la lit…"); }
      else toast("Capture ajoutée");
    });
  } else if (id === "ajCapture" && t.files && t.files[0]) {
    preparerImage(t.files[0]).then(function (img) {
      if (!img) { toast("Cette image n'a pas pu être lue.", true); return; }
      ICI.ajout.capture = img; rendreAjout();
    });
  } else if (id === "ajFichier" && t.files && t.files.length) {
    lireExport(Array.from(t.files));
  } else if (id === "ajLikes") {
    ICI.ajout.likes = t.checked;
    if (ICI.ajout.lecture && ICI.ajout.lecture.fichiers) {
      var L = ICI.ajout.lecture;
      ICI.ajout.lecture = Object.assign({ plat: L.plat, fichiers: L.fichiers }, interpreterExport(L.fichiers, L.plat, t.checked));
      rendreAjout();
    }
  } else if (id === "iaAuto") {
    Store.reg.iaAuto = t.checked; sauverReg();
  } else if (id === "selDeplacer" && t.value) {
    var cid = t.value, nb = ICI.sel.size;
    deplacer(Array.from(ICI.sel), cid);
    var c = Store.cats[cid];
    toast(pluriel(nb, "élément déplacé", "éléments déplacés") + " vers " + (c.parent ? Store.cats[c.parent].nom + " › " : "") + c.nom);
    ICI.sel.clear(); rendreBientot();
  } else if (id === "selColl" && t.value) {
    if (t.value === "__nouvelle") { ICI.barre = "coll"; rendreBientot(); setTimeout(function () { var x = $("#selCollNom"); if (x) x.focus(); }, 30); return; }
    ajouterACollection(Array.from(ICI.sel), t.value);
    toast("Ajouté à « " + Store.colls[t.value].nom + " »");
    ICI.sel.clear(); rendreBientot();
  }
});

document.addEventListener("submit", function (ev) {
  ev.preventDefault();
  var f = ev.target, quoi = f.getAttribute("data-form") || f.id;
  var it = Store.items[ICI.fiche];
  var val = function (id) { var x = document.getElementById(id); return x ? x.value.trim() : ""; };
  switch (quoi) {
    case "formRecherche":
      if (ICI.q.trim()) { if (iaDispo()) rechercheIA(ICI.q); else rendreBientot(); }
      var q = $("#q"); if (q) q.blur();
      break;
    case "formFrigo": var fr = $("#frigo"); if (fr) fr.blur(); break;
    case "titre":
      if (it && val("ficheTitreInput")) {
        it.titre = val("ficheTitreInput").slice(0, 90);
        it.analyse = Object.assign({}, it.analyse, { titreManuel: true });
        sauverItem(it);
      }
      ICI.ficheTitre = false; rendreFiche(); break;
    case "tag":
      var tg = norm(val("ficheTag")).replace(/^#/, "").replace(/[^a-z0-9 -]/g, "").trim();
      if (it && tg && (it.tags || []).indexOf(tg) < 0) { it.tags = (it.tags || []).concat(tg); sauverItem(it); }
      var x = $("#ficheTag"); if (x) x.value = "";
      break;
    case "fiche-coll":
      var c = creerCollection(val("ficheCollNom"));
      if (it && c) ajouterACollection([it.id], c.id);
      ICI.ficheNouvelleColl = false; rendreFiche(); break;
    case "sel-coll":
      var c2 = creerCollection(val("selCollNom"));
      if (c2) { ajouterACollection(Array.from(ICI.sel), c2.id); toast("Ajouté à « " + c2.nom + " »"); }
      ICI.barre = null; ICI.sel.clear(); rendreBientot(); break;
    case "cat-creer":
      var nom = val("catNom");
      if (!nom) break;
      var e = ICI.catEdit, parent = e.mode === "nouvelle-sous" ? e.id : null;
      if (trouverCat(nom, parent)) { toast("« " + nom + " » existe déjà.", true); break; }
      var cc = creerCat(nom, parent);
      if (cc) { cc.auto = false; sauverCat(cc); journal("Catégorie « " + cc.nom + " » créée."); }
      ICI.catEdit = null; break;
    case "cat-renommer":
      var cat = Store.cats[ICI.catEdit.id], nn = sansEmoji(val("catNom")).slice(0, 40);
      if (cat && nn && nn !== cat.nom) {
        var ancien = cat.nom;
        cat = Object.assign({}, cat, { nom: nn, auto: false }); sauverCat(cat);
        journal("« " + ancien + " » renommée en « " + nn + " ».");
      }
      ICI.catEdit = null; rendreBientot(); break;
    case "cat-fusionner":
      fusionnerCats(ICI.catEdit.id, val("catCible")); ICI.catEdit = null; toast("Catégories fusionnées"); break;
    case "coll-creer":
      var nc = creerCollection(val("collNouveau"));
      if (nc) { journal("Collection « " + nc.nom + " » créée."); var y = $("#collNouveau"); if (y) y.value = ""; }
      break;
    case "coll-renommer":
      var co = Store.colls[ICI.collEdit.id], cn = sansEmoji(val("collNom")).slice(0, 50);
      if (co && cn) sauverColl(Object.assign({}, co, { nom: cn }));
      ICI.collEdit = null; rendreBientot(); break;
    case "prenom":
      Store.reg.prenom = val("prenom").slice(0, 40); sauverReg(); toast("Enregistré"); break;
    case "onb-prenom":
      Store.reg.prenom = val("onbPrenom").slice(0, 40); ICI.onb = 3; rendreBientot(); break;
  }
});

document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape" && ICI.modeSel && !$("#fiche").open && !$("#ajout").open) { ICI.modeSel = false; ICI.sel.clear(); ICI.barre = null; rendreBientot(); }
});

// Glisser-déposer un export sur la zone prévue.
document.addEventListener("dragover", function (ev) {
  var z = ev.target.closest && ev.target.closest("#depot");
  if (z) { ev.preventDefault(); z.classList.add("survol"); }
});
document.addEventListener("dragleave", function (ev) {
  var z = ev.target.closest && ev.target.closest("#depot");
  if (z) z.classList.remove("survol");
});
document.addEventListener("drop", function (ev) {
  var z = ev.target.closest && ev.target.closest("#depot");
  if (!z) return;
  ev.preventDefault();
  z.classList.remove("survol");
  if (ev.dataTransfer && ev.dataTransfer.files.length) lireExport(Array.from(ev.dataTransfer.files));
});
// Coller directement un lien n'importe où ouvre l'ajout.
document.addEventListener("paste", function (ev) {
  var cible = ev.target;
  if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA")) return;
  if (!Store.reg.onboarde || $("#ajout").open) return;
  var txt = ev.clipboardData && ev.clipboardData.getData("text");
  if (!txt || !extraireLiens(txt).length) return;
  ev.preventDefault();
  ICI.ajout.liens = txt;
  ouvrirAjout("liens");
});

$$("#tabs .tab").forEach(function (t) { t.addEventListener("click", function () { allerA(t.getAttribute("data-vue")); }); });
$("#reglagesBtn").addEventListener("click", function () { allerA(ICI.vue === "reglages" ? "accueil" : "reglages"); });
$("#ajoutBtn").addEventListener("click", function () { ouvrirAjout("liens"); });
$("#fab").addEventListener("click", function () { ouvrirAjout("liens"); });
$("#fiche").addEventListener("close", function () { ICI.fiche = null; ICI.ficheConfirm = false; ICI.ficheTitre = false; });
["fiche", "ajout"].forEach(function (id) {
  // Un clic sur le voile ferme la feuille.
  $("#" + id).addEventListener("click", function (ev) { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });
});
window.addEventListener("hashchange", function () {
  var v = location.hash.slice(1);
  if (VUES[v] && v !== ICI.vue) allerA(v);
});

$("#themeBtn").addEventListener("click", function () {
  var r = document.documentElement;
  var actuel = r.getAttribute("data-theme");
  var sombre = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var suivant = actuel ? (actuel === "dark" ? "light" : "dark") : (sombre ? "light" : "dark");
  r.setAttribute("data-theme", suivant);
  try { localStorage.setItem(LS_THEME, suivant); } catch (e) {}
});

/* ==================================================================
   DÉMARRAGE
   ================================================================== */

try {
  var th = localStorage.getItem(LS_THEME);
  if (th === "dark" || th === "light") document.documentElement.setAttribute("data-theme", th);
} catch (e) {}

(function demarrer() {
  var local = lsLire();
  if (local) {
    Store.items = local.items || {};
    Store.cats = local.cats || {};
    Store.colls = local.colls || {};
    Store.reg = Object.assign(regDefaut(), local.reg || {});
  }
  var h = location.hash.slice(1), v = null;
  try { v = localStorage.getItem(LS_VUE); } catch (e) {}
  ICI.vue = VUES[h] ? h : VUES[v] ? v : "accueil";

  // Version installée (hors claude.ai) : un lien partagé depuis Instagram
  // ou TikTok arrive dans l'adresse (?url=… ou ?text=…).
  if (!EN_ARTIFACT) {
    try {
      var p = new URLSearchParams(location.search);
      var partage = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
      if (partage && extraireLiens(partage).length) {
        ICI.ajout.liens = partage;
        ICI.ouvrirPartage = true;
        history.replaceState(null, "", location.pathname + location.hash);
      }
    } catch (e) {}
  }

  if (!EN_ARTIFACT || local) {
    Store.pret = true;
  } else {
    // Rien dans ce navigateur : on laisse au compte le temps de répondre.
    setTimeout(function () { if (!Store.pret) { Store.pret = true; rendreBientot(); } }, 5000);
  }
  if (Store.pret && Store.reg.onboarde && !Object.keys(Store.cats).length) {
    var d = catsParDefaut(); Object.keys(d).forEach(function (k) { sauverCat(d[k]); });
  }
  rendre();
  if (ICI.ouvrirPartage && Store.reg.onboarde) ouvrirAjout("liens");

  if (!EN_ARTIFACT) {
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
    return;
  }

  window.claude.use("sample").then(function (sp) {
    if (!sp) return;
    IA.sample = sp;
    sp.limits().then(function (l) { IA.limites = l; }).catch(function () {});
    rendreBientot();
  }).catch(function () {});

  window.claude.use("downloads").then(function (dl) { Telechargement = dl; }).catch(function () {});

  Promise.all([window.claude.use("user"), window.claude.use("db")]).then(function (r) {
    var u = r[0], db = r[1];
    if (!u || !db) { Store.pret = true; rendreBientot(); return; }
    return u.id().then(function (id) {
      if (!id) { Store.pret = true; rendreBientot(); return; }
      brancherCloud(db, id);
    });
  }).catch(function () { Store.pret = true; rendreBientot(); });
})();

})();
