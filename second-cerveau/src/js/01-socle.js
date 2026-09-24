"use strict";
(function () {

/* ==================================================================
   OUTILS
   ================================================================== */

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var EN_ARTIFACT = !!(window.claude && typeof window.claude.use === "function");

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
// Minuscules, sans accents ni apostrophes : la base de toute comparaison.
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, " ").replace(/œ/g, "oe").replace(/æ/g, "ae");
}
function mots(s) { return norm(s).split(/[^a-z0-9]+/).filter(Boolean); }
// Pluriels et féminins simples : « courgettes » retrouve « courgette ».
function racine(w) {
  if (w.length > 4) w = w.replace(/(es|s|x)$/, "");
  return w;
}
function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "cat"; }
function sansEmoji(s) {
  return String(s || "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s+/g, " ").trim();
}
function hash(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function attendre(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function copie(o) { return JSON.parse(JSON.stringify(o)); }

var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function dateCourte(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  if (isNaN(d)) return "";
  var auj = new Date();
  var s = d.getDate() + " " + MOIS[d.getMonth()];
  if (d.getFullYear() !== auj.getFullYear()) s += " " + d.getFullYear();
  return s;
}
function dateHeure(ts) {
  var d = new Date(ts);
  return dateCourte(ts) + " · " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function pluriel(n, un, plusieurs) { return n + " " + (n > 1 ? (plusieurs || un + "s") : un); }

var toastT = null;
function toast(msg, mauvais) {
  var t = $("#toast");
  t.textContent = msg;
  t.className = "toast on" + (mauvais ? " bad" : "");
  clearTimeout(toastT);
  toastT = setTimeout(function () { t.className = "toast" + (mauvais ? " bad" : ""); }, mauvais ? 5200 : 2800);
}

/* ==================================================================
   PLATEFORMES
   Chaque plateforme sait reconnaître ses liens et dit, sans l'enjoliver,
   ce que son API officielle permet. Ajouter Pinterest, YouTube, X,
   Reddit ou Facebook, c'est ajouter une entrée ici : les liens sont déjà
   reconnus, il manque seulement l'import de leurs favoris.
   ================================================================== */

var TYPES = {
  reel: "Reel", publication: "Publication", carrousel: "Carrousel", video: "Vidéo",
  short: "Short", epingle: "Épingle", post: "Post", lien: "Lien", note: "Note"
};

var PLATEFORMES = {
  instagram: {
    nom: "Instagram", classe: "instagram", importable: true,
    reconnaitre: function (u) {
      var m = u.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/i);
      if (!m) return null;
      var t = m[1].toLowerCase();
      return { cle: "ig-" + m[2], type: t === "p" ? "publication" : t === "tv" ? "video" : "reel",
        url: "https://www.instagram.com/" + (t === "reels" ? "reel" : t) + "/" + m[2] + "/" };
    },
    // État connu de la documentation publique de Meta. À revérifier avant
    // d'écrire la version serveur : ces règles changent.
    api: [
      ["partiel", "Connexion officielle (OAuth)", "L'API Instagram n'accepte que les comptes professionnels (Business ou Créateur). Les comptes personnels ne peuvent plus se connecter depuis la fin de l'API Basic Display, le 4 décembre 2024."],
      ["non", "Publications enregistrées et collections", "Aucun point d'accès de l'API ne les expose, même pour un compte professionnel. Aucune appli ne peut les synchroniser automatiquement aujourd'hui."],
      ["partiel", "Légende et miniature d'un post", "Possibles via oEmbed avec une appli Meta validée et un serveur. Cette page ne peut pas appeler Instagram elle-même."],
      ["ok", "Export « Télécharger vos informations »", "Donne le lien de chaque publication enregistrée, son auteur, la date et tes collections. Pas de légende ni d'image."],
      ["ok", "Partage d'un lien", "Partager › Copier le lien, puis coller ici. Tu peux ajouter la légende ou une capture pour une analyse complète."]
    ],
    guide: [
      "Dans Instagram, ouvre ton profil puis le menu <b>☰</b>.",
      "Va dans <b>Espace Comptes</b> › <b>Vos informations et autorisations</b> › <b>Télécharger vos informations</b>.",
      "Choisis <b>Certaines de vos informations</b> et coche <b>Enregistré</b> (Saved).",
      "Choisis <b>Télécharger sur l'appareil</b>, format <b>JSON</b>, période <b>Depuis le début</b>.",
      "Meta t'envoie un e-mail quand le fichier est prêt (de quelques minutes à quelques jours). Dépose ici le .zip tel quel, ou le fichier saved_posts.json."
    ]
  },
  tiktok: {
    nom: "TikTok", classe: "tiktok", importable: true,
    reconnaitre: function (u) {
      var m = u.match(/tiktok\.com\/@([\w.-]+)\/(video|photo)\/(\d+)/i);
      if (m) return { cle: "tt-" + m[3], type: m[2].toLowerCase() === "photo" ? "carrousel" : "video", createur: m[1],
        url: "https://www.tiktok.com/@" + m[1] + "/" + m[2].toLowerCase() + "/" + m[3] };
      m = u.match(/tiktokv?\.com\/share\/video\/(\d+)/i) || u.match(/tiktok\.com\/(?:v|embed(?:\/v2)?)\/(\d+)/i);
      if (m) return { cle: "tt-" + m[1], type: "video", url: "https://www.tiktok.com/@/video/" + m[1] };
      // Les liens courts ne se résolvent qu'en suivant la redirection, ce
      // que la page ne peut pas faire : ils gardent leur propre clé.
      m = u.match(/(?:vm|vt)\.tiktok\.com\/([\w-]+)/i) || u.match(/tiktok\.com\/t\/([\w-]+)/i);
      if (m) return { cle: "tts-" + m[1], type: "video", url: u };
      return null;
    },
    api: [
      ["ok", "Connexion officielle (Login Kit)", "OAuth fonctionne pour tous les comptes, avec une appli déclarée chez TikTok et un serveur pour garder les jetons."],
      ["partiel", "Display API", "Donne ton profil et tes propres vidéos publiques. Pas tes favoris ni tes likes."],
      ["partiel", "Data Portability API", "Peut transmettre ton activité, favoris compris, mais seulement pour les comptes de l'Espace économique européen et du Royaume-Uni, avec une appli approuvée par TikTok. Prévue pour la version serveur."],
      ["partiel", "Titre, auteur, miniature (oEmbed)", "Service public, mais cette page ne peut pas l'appeler (le navigateur bloque les requêtes externes). Possible depuis un serveur."],
      ["ok", "Export « Télécharger tes données »", "Donne le lien et la date de chaque favori, et de chaque like si tu veux. Pas de légende ni d'auteur."],
      ["ok", "Partage d'un lien", "Partager › Copier le lien, puis coller ici."]
    ],
    guide: [
      "Dans TikTok, ouvre ton profil puis le menu <b>☰</b> › <b>Paramètres et confidentialité</b>.",
      "Va dans <b>Compte</b> › <b>Télécharger tes données</b>.",
      "Choisis le format <b>JSON</b> et les données d'<b>activité</b> (ou toutes), puis <b>Demander les données</b>.",
      "Quand la demande est prête (souvent sous quelques jours), récupère-la dans l'onglet <b>Télécharger les données</b>.",
      "Dépose ici le .zip tel quel, ou le fichier user_data_tiktok.json."
    ]
  },
  youtube: {
    nom: "YouTube", classe: "youtube",
    reconnaitre: function (u) {
      var m = u.match(/youtube\.com\/shorts\/([\w-]{6,})/i);
      if (m) return { cle: "yt-" + m[1], type: "short", url: "https://www.youtube.com/shorts/" + m[1] };
      m = u.match(/youtu\.be\/([\w-]{6,})/i) || u.match(/youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i);
      if (m) return { cle: "yt-" + m[1], type: "video", url: "https://www.youtube.com/watch?v=" + m[1] };
      return null;
    }
  },
  pinterest: {
    nom: "Pinterest", classe: "autre",
    reconnaitre: function (u) {
      var m = u.match(/pinterest\.[a-z.]+\/pin\/([\w-]+)/i);
      if (m) return { cle: "pin-" + m[1], type: "epingle", url: "https://www.pinterest.com/pin/" + m[1] + "/" };
      m = u.match(/pin\.it\/([\w-]+)/i);
      if (m) return { cle: "pins-" + m[1], type: "epingle", url: u };
      return null;
    }
  },
  x: {
    nom: "X", classe: "autre",
    reconnaitre: function (u) {
      var m = u.match(/(?:twitter|x)\.com\/([\w]+)\/status\/(\d+)/i);
      return m ? { cle: "x-" + m[2], type: "post", createur: m[1], url: "https://x.com/" + m[1] + "/status/" + m[2] } : null;
    }
  },
  reddit: {
    nom: "Reddit", classe: "autre",
    reconnaitre: function (u) {
      var m = u.match(/reddit\.com\/r\/([\w]+)\/comments\/([\w]+)/i);
      return m ? { cle: "rd-" + m[2], type: "post", createur: "r/" + m[1], url: "https://www.reddit.com/r/" + m[1] + "/comments/" + m[2] + "/" } : null;
    }
  },
  facebook: {
    nom: "Facebook", classe: "autre",
    reconnaitre: function (u) {
      var m = u.match(/facebook\.com\/.*?(?:posts|videos|reel|permalink)\/([\w]+)/i) || u.match(/fb\.watch\/([\w-]+)/i);
      return m ? { cle: "fb-" + m[1], type: /reel/i.test(u) ? "reel" : "post", url: u } : null;
    }
  },
  web: { nom: "Web", classe: "autre", reconnaitre: function () { return null; } }
};
var BIENTOT = [
  ["Pinterest", "Les liens d'épingles sont reconnus. L'API officielle donne les tableaux de l'utilisateur : import prévu côté serveur."],
  ["YouTube", "Vidéos et liens reconnus. L'API Data expose les playlists, dont « À regarder plus tard » n'est plus accessible."],
  ["YouTube Shorts", "Reconnus comme des Shorts, classés comme les autres vidéos."],
  ["X", "Liens de posts reconnus. Les signets demandent l'API payante de X."],
  ["Reddit", "Liens reconnus. L'API officielle donne les éléments enregistrés : import prévu côté serveur."],
  ["Facebook", "Liens reconnus. Les éléments enregistrés ne sont pas exposés par l'API Graph."]
];

// Analyse d'une URL : plateforme, clé unique (anti-doublon), type et créateur.
function reconnaitre(url) {
  var u = String(url || "").trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  for (var k in PLATEFORMES) {
    var r = PLATEFORMES[k].reconnaitre(u);
    if (r) { r.plateforme = k; return r; }
  }
  try {
    var p = new URL(u);
    return { plateforme: "web", cle: "w-" + hash(p.host + p.pathname + p.search), type: "lien", url: u };
  } catch (e) { return null; }
}
function extraireLiens(txt) {
  var vus = {}, out = [];
  (String(txt || "").match(/https?:\/\/[^\s<>"')\]]+/gi) || []).forEach(function (u) {
    u = u.replace(/[.,;!?]+$/, "");
    var r = reconnaitre(u);
    if (r && !vus[r.cle]) { vus[r.cle] = 1; out.push(r); }
  });
  return out;
}
function nomPlat(k) { return (PLATEFORMES[k] || PLATEFORMES.web).nom; }

/* ==================================================================
   CATÉGORIES PAR DÉFAUT
   ================================================================== */

var STICKERS = ["fraise", "homard", "orange", "corail", "meduse", "poisson", "hippocampe", "frangipanier",
  "hibiscus", "ourson", "peche", "framboise", "pamplemousse", "grenade", "verre"];
var TEINTES = ["peche", "rose", "lavande", "jaune"];

var CATS_DEFAUT = [
  ["recettes", "Recettes", "pasteque", "peche", ["Petit-déjeuner", "Déjeuner", "Dîner", "Desserts", "Apéritifs", "Healthy", "Pâtes", "Poulet", "Recettes rapides"]],
  ["voyages", "Voyages", "tortue", "lavande", ["Destinations", "Hôtels", "Restaurants", "Activités", "Bons plans"]],
  ["mode", "Mode", "noeud", "rose", ["Tenues", "Chaussures", "Sacs", "Bijoux", "Inspirations"]],
  ["sport", "Sport", "ballon", "jaune", ["Salle", "Running", "Exercices", "Programmes"]],
  ["beaute", "Beauté", "lys", "rose", ["Maquillage", "Soins", "Cheveux", "Ongles"]],
  ["maison", "Maison", "coquillage", "lavande", ["Décoration", "Rangement", "DIY", "Plantes"]],
  ["films", "Films & séries", "etoile", "peche", ["Films", "Séries", "Documentaires"]],
  ["idees", "Idées", "soleil", "jaune", ["Astuces", "Cadeaux", "Lectures", "À tester"]]
];

function catsParDefaut() {
  var out = {}, t = Date.now();
  CATS_DEFAUT.forEach(function (c, i) {
    out[c[0]] = { id: c[0], nom: c[1], parent: null, sticker: c[2], teinte: c[3], ordre: i, cree: t };
    c[4].forEach(function (s, j) {
      var id = c[0] + ":" + slug(s);
      out[id] = { id: id, nom: s, parent: c[0], ordre: j, cree: t };
    });
  });
  return out;
}

/* ==================================================================
   STOCKAGE
   Dans claude.ai : un espace privé par personne (data/users/<id>/…),
   que même le propriétaire de la page ne lit pas. Hors de claude.ai, ou
   tant que le compte ne répond pas : ce navigateur.
   ================================================================== */

var LS = "pepites.v1", LS_THEME = "pepites.theme", LS_VUE = "pepites.vue";

function regDefaut() {
  return { prenom: "", onboarde: false, iaAuto: true, sources: {}, historique: [], cree: Date.now() };
}

var Store = {
  mode: "local",           // "local" | "cloud"
  pret: false,
  items: {}, cats: {}, colls: {}, reg: regDefaut(),
  db: null, refs: null,
  recus: {}                // premières images reçues du serveur
};

function lsLire() {
  try { var s = localStorage.getItem(LS); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
var lsT = null;
function lsPlanifier() {
  clearTimeout(lsT);
  lsT = setTimeout(function () {
    try {
      localStorage.setItem(LS, JSON.stringify({ items: Store.items, cats: Store.cats, colls: Store.colls, reg: Store.reg }));
    } catch (e) {
      // Plein : on garde au moins l'essentiel, sans les vignettes.
      try {
        var legers = {};
        Object.keys(Store.items).forEach(function (k) { var c = Object.assign({}, Store.items[k]); delete c.vignette; legers[k] = c; });
        localStorage.setItem(LS, JSON.stringify({ items: legers, cats: Store.cats, colls: Store.colls, reg: Store.reg }));
      } catch (e2) {}
    }
  }, 400);
}

/* --- file d'écriture : une écriture à la fois par document, quatre en tout --- */
var Ecritures = { attente: new Map(), enVol: new Set(), actifs: 0, max: 4, erreurs: 0 };

function planifier(ref, data) {
  Ecritures.attente.set(ref.path, { ref: ref, data: data });
  pomper();
}
function pomper() {
  Ecritures.attente.forEach(function (w, k) {
    if (Ecritures.actifs >= Ecritures.max || Ecritures.enVol.has(k)) return;
    Ecritures.attente.delete(k);
    Ecritures.enVol.add(k);
    Ecritures.actifs++;
    ecrire(w, 0).then(function () {
      Ecritures.enVol.delete(k);
      Ecritures.actifs--;
      pomper();
      if (!Ecritures.actifs && !Ecritures.attente.size) rendreBientot();
    });
  });
}
function ecrire(w, essai) {
  var p = w.data ? w.ref.set(w.data) : w.ref.delete();
  return p.catch(function (e) {
    var c = e && e.code;
    if ((c === "resource_exhausted" || c === "unavailable") && essai < 3) {
      return attendre(1400 * (essai + 1) + Math.random() * 600).then(function () { return ecrire(w, essai + 1); });
    }
    Ecritures.erreurs++;
    if (c === "quota_exceeded") toast("Ton espace est plein : retire quelques éléments pour en ajouter d'autres.", true);
    else if (c !== "revoked") toast("Un enregistrement n'est pas passé. Il reste gardé dans ce navigateur.", true);
  });
}
function enCours(path) { return Ecritures.attente.has(path) || Ecritures.enVol.has(path); }

function propre(o) { return JSON.parse(JSON.stringify(o)); }

function sauverItem(it) {
  it.modifie = Date.now();
  Store.items[it.id] = it;
  if (Store.mode === "cloud") planifier(Store.refs.items.doc(it.id), propre(it));
  lsPlanifier(); rendreBientot();
}
function supprimerItem(id) {
  delete Store.items[id];
  if (Store.mode === "cloud") planifier(Store.refs.items.doc(id), null);
  lsPlanifier(); rendreBientot();
}
function sauverCat(c) {
  Store.cats[c.id] = c;
  if (Store.mode === "cloud") planifier(Store.refs.cats.doc(c.id), propre(c));
  lsPlanifier(); rendreBientot();
}
function supprimerCatDoc(id) {
  delete Store.cats[id];
  if (Store.mode === "cloud") planifier(Store.refs.cats.doc(id), null);
  lsPlanifier(); rendreBientot();
}
function sauverColl(c) {
  Store.colls[c.id] = c;
  if (Store.mode === "cloud") planifier(Store.refs.colls.doc(c.id), propre(c));
  lsPlanifier(); rendreBientot();
}
function supprimerCollDoc(id) {
  delete Store.colls[id];
  if (Store.mode === "cloud") planifier(Store.refs.colls.doc(id), null);
  lsPlanifier(); rendreBientot();
}
var regT = null;
function sauverReg() {
  lsPlanifier(); rendreBientot();
  if (Store.mode !== "cloud") return;
  // Les réglages changent souvent d'un coup (historique, sources) : une écriture par pause.
  clearTimeout(regT);
  regT = setTimeout(function () { planifier(Store.refs.base, propre(Store.reg)); }, 500);
}
function journal(txt) {
  Store.reg.historique = [{ t: Date.now(), txt: txt }].concat(Store.reg.historique || []).slice(0, 80);
  sauverReg();
}

function brancherCloud(db, id) {
  var base = db.doc("data/users/" + id + "/espace");
  Store.db = db;
  Store.refs = { base: base, items: base.collection("items"), cats: base.collection("categories"), colls: base.collection("collections") };
  var local = { items: Store.items, cats: Store.cats, colls: Store.colls, reg: Store.reg };
  var attendus = ["base", "items", "cats", "colls"];

  function recu(nom) {
    if (Store.recus[nom]) return;
    Store.recus[nom] = true;
    if (attendus.every(function (n) { return Store.recus[n]; })) premiereSynchro(local);
  }
  function perdu(e) {
    if (e && e.code === "revoked") { Store.mode = "local"; rendreBientot(); }
  }

  base.onSnapshot(function (snap) {
    if (snap.metadata && snap.metadata.fromCache) return;
    if (snap.exists && !enCours(base.path) && !regT) {
      // Les instantanés sont gelés : on travaille toujours sur une copie.
      Store.reg = Object.assign(regDefaut(), copie(snap.data()));
      lsPlanifier(); rendreBientot();
    }
    Store.distantBase = snap.exists;
    recu("base");
  }, perdu);

  [["items", "items"], ["cats", "cats"], ["colls", "colls"]].forEach(function (p) {
    var cle = p[0], ref = Store.refs[p[1]];
    ref.onSnapshot(function (snap) {
      if (snap.metadata && snap.metadata.fromCache) return;
      if (!Store.recus[cle]) { Store["distant_" + cle] = snap.size; }
      // Tant que la première synchro n'a pas tranché, on ne touche pas au local.
      if (Store.mode === "cloud") {
        var vus = {};
        snap.docs.forEach(function (d) {
          vus[d.id] = true;
          var path = ref.doc(d.id).path;
          if (enCours(path)) return;
          Store[cle][d.id] = copie(d.data());
        });
        Object.keys(Store[cle]).forEach(function (k) {
          if (!vus[k] && !enCours(ref.doc(k).path)) delete Store[cle][k];
        });
        lsPlanifier(); rendreBientot();
      } else {
        Store["premier_" + cle] = snap.docs.map(function (d) { return [d.id, copie(d.data())]; });
      }
      recu(cle);
    }, perdu);
  });
}

// Premier contact avec le serveur : s'il est vide et que ce navigateur a
// déjà des pépites, on les y range. Sinon, le serveur fait foi.
function premiereSynchro(local) {
  var distantVide = !Store.distantBase && !(Store.premier_items || []).length;
  Store.mode = "cloud";
  if (distantVide) {
    var aDesDonnees = Object.keys(local.items).length || local.reg.onboarde;
    if (aDesDonnees) {
      Object.keys(local.items).forEach(function (k) { planifier(Store.refs.items.doc(k), propre(local.items[k])); });
      Object.keys(local.cats).forEach(function (k) { planifier(Store.refs.cats.doc(k), propre(local.cats[k])); });
      Object.keys(local.colls).forEach(function (k) { planifier(Store.refs.colls.doc(k), propre(local.colls[k])); });
      planifier(Store.refs.base, propre(local.reg));
    }
  } else {
    ["items", "cats", "colls"].forEach(function (c) {
      var o = {};
      (Store["premier_" + c] || []).forEach(function (p) { o[p[0]] = p[1]; });
      Store[c] = o;
    });
  }
  if (Store.reg.onboarde && !Object.keys(Store.cats).length) {
    var d = catsParDefaut();
    Object.keys(d).forEach(function (k) { sauverCat(d[k]); });
  }
  Store.pret = true;
  lsPlanifier();
  rendreBientot();
}
