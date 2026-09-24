
/* ==================================================================
   APERÇUS : miniature, auteur et légende des vidéos TikTok
   La page ne peut pas appeler TikTok elle-même. Elle passe par le projet
   Supabase « mes-pepites » : une fonction SQL (pepites.apercu) appelle la
   fonction Edge « apercu », qui interroge l'oEmbed public de TikTok et
   rapporte la miniature. Sur claude.ai, l'appel passe par le connecteur
   Supabase de la personne ; en version autonome, directement en HTTPS.
   Instagram suivra le même chemin dès qu'un jeton Meta sera posé côté
   serveur ; d'ici là le serveur répond « instagram_sans_jeton ».
   ================================================================== */

var APERCU = {
  projet: "roxsrrscddkeibiqrxxp",
  serveur: "Supabase",
  outil: "execute_sql",
  // Version autonome : appel direct de la fonction Edge (clé publique « anon »).
  url: "https://roxsrrscddkeibiqrxxp.supabase.co/functions/v1/apercu",
  cle: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJveHNycnNjZGRrZWliaXFyeHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjkzNDcsImV4cCI6MjEwNTg0NTM0N30.I4dCySQo-HdCY750XvQ1DlSnki7HBEsqfYINHV5_RB4"
};

var Apercus = { mcp: null, file: [], enCours: false, fait: 0, total: 0, erreur: "", instagramOff: true, suite: null, ids: [] };

function apercusDispo() { return !!Apercus.mcp || !EN_ARTIFACT; }
function apercuPossible(it) {
  if (!it || !it.url || it.vignette || it.demo) return false;
  if (it.apercu && it.apercu.ok) return false;
  if (it.plateforme === "tiktok") return true;
  return it.plateforme === "instagram" && !Apercus.instagramOff;
}
function aApercuManquant() { return tousItems().filter(apercuPossible); }

var MESSAGES_APERCU = {
  server_not_connected: "Le connecteur Supabase n'est pas branché sur ton compte Claude : ajoute-le dans Réglages › Connecteurs de claude.ai, puis reprends.",
  needs_reauth: "Le connecteur Supabase doit être reconnecté dans les réglages de claude.ai.",
  not_in_manifest: "Cette page n'a pas l'autorisation d'utiliser Supabase.",
  blocked_by_policy: "Ton organisation bloque l'usage de Supabase depuis cette page.",
  approval_required: "L'accès à Supabase attend ton accord : reprends et accepte la demande.",
  tool_error: "Le serveur des aperçus a renvoyé une erreur. Vérifie que le projet Supabase « mes-pepites » n'est pas en pause."
};

// Le connecteur rend le résultat SQL enrobé de texte : on n'en garde que le tableau JSON.
function lignesSql(payload) {
  if (typeof payload === "string" && /^\s*\{/.test(payload)) {
    try { payload = JSON.parse(payload); } catch (e) {}
  }
  if (payload && payload.content && payload.payload == null && Array.isArray(payload.content)) {
    payload = (payload.content.filter(function (c) { return c && c.type === "text"; })[0] || {}).text || "";
    if (/^\s*\{/.test(payload)) { try { payload = JSON.parse(payload); } catch (e) {} }
  }
  var t = typeof payload === "string" ? payload : payload && typeof payload.result === "string" ? payload.result : JSON.stringify(payload || "");
  var m = t.match(/<untrusted-data-[^>]*>\s*([\s\S]*?)\s*<\/untrusted-data/);
  var j = m ? m[1] : t;
  var a = j.indexOf("["), b = j.lastIndexOf("]");
  if (a < 0 || b < a) return [];
  var lignes = JSON.parse(j.slice(a, b + 1));
  return lignes.map(function (l) { return { id: l.id, r: typeof l.r === "string" ? JSON.parse(l.r) : l.r }; });
}

function sqlTexte(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

async function demanderApercus(items) {
  if (Apercus.mcp) {
    var q = "select v.id, pepites.apercu(v.lien) as r from (values " +
      items.map(function (it) { return "(" + sqlTexte(it.id) + ", " + sqlTexte(it.url) + ")"; }).join(", ") +
      ") as v(id, lien);";
    var res = await Apercus.mcp.callTool(APERCU.serveur, APERCU.outil, { project_id: APERCU.projet, query: q });
    return lignesSql(res.payload != null ? res.payload : res);
  }
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var rep = await fetch(APERCU.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + APERCU.cle, apikey: APERCU.cle },
      body: JSON.stringify({ url: items[i].url })
    });
    out.push({ id: items[i].id, r: rep.ok ? await rep.json() : { ok: false, raison: "serveur_" + rep.status } });
  }
  return out;
}

async function appliquerApercu(id, r) {
  var it = Store.items[id];
  if (!it || !r) return;
  it.apercu = { ok: !!r.ok, raison: r.raison || null, date: Date.now() };
  if (r.raison === "instagram_sans_jeton") Apercus.instagramOff = true;
  if (r.ok) {
    if (r.auteur && !it.createur) it.createur = String(r.auteur).replace(/^@/, "");
    // Sur TikTok, le « titre » oEmbed est la légende complète de la vidéo.
    if (r.titre && !it.legende) it.legende = String(r.titre).slice(0, 2500);
    if (r.miniature && !it.vignette) {
      var blob = await dataUrlVersBlob(r.miniature);
      var img = blob ? await preparerImage(blob) : null;
      if (img) { it.vignette = img.vignette; it.ratio = img.ratio; IA.images[id] = img.ia; }
    }
    if (!(it.analyse && it.analyse.par === "ia")) reclasserUn(it);
  }
  sauverItem(it);
}

function lancerApercus(ids, suite) {
  var nouveaux = ids.filter(function (id) { return apercuPossible(Store.items[id]) && Apercus.file.indexOf(id) < 0; });
  if (!apercusDispo() || !nouveaux.length) { if (suite) suite(ids); return; }
  Apercus.file = Apercus.file.concat(nouveaux);
  Apercus.ids = Apercus.ids.concat(ids);
  if (suite) Apercus.suite = suite;
  Apercus.total = Apercus.fait + Apercus.file.length;
  Apercus.erreur = "";
  rendreBientot();
  if (!Apercus.enCours) boucleApercus();
}

async function boucleApercus() {
  Apercus.enCours = true;
  rendreBientot();
  while (Apercus.file.length) {
    var lot = Apercus.file.splice(0, 3).map(function (id) { return Store.items[id]; }).filter(Boolean);
    if (!lot.length) continue;
    try {
      var lignes = await demanderApercus(lot);
      for (var i = 0; i < lignes.length; i++) await appliquerApercu(lignes[i].id, lignes[i].r);
    } catch (e) {
      Apercus.file = lot.map(function (it) { return it.id; }).concat(Apercus.file);
      Apercus.erreur = MESSAGES_APERCU[e && e.code] || "Les aperçus n'ont pas pu être récupérés pour le moment.";
      break;
    }
    Apercus.fait += lot.length;
    rendreBientot();
  }
  Apercus.enCours = false;
  if (!Apercus.file.length) {
    var n = Apercus.fait, suite = Apercus.suite, ids = Apercus.ids;
    Apercus.fait = 0; Apercus.total = 0; Apercus.suite = null; Apercus.ids = [];
    if (n) journal(pluriel(n, "aperçu récupéré", "aperçus récupérés") + " (miniature, auteur, légende).");
    if (suite) suite(ids);
  }
  rendreBientot();
}

// Après un ajout : d'abord les aperçus (ils apportent la légende), puis Claude.
function traiterNouveaux(ids) {
  lancerApercus(ids, function (tous) {
    if (iaDispo() && Store.reg.iaAuto) lancerAnalyse(tous.filter(function (id) { return Store.items[id]; }));
  });
}
