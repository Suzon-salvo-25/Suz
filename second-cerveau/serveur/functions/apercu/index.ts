// Mes Pépites — aperçu d'une publication : titre, auteur, miniature.
//
// TikTok : oEmbed public (https://www.tiktok.com/oembed), sans clé.
// Instagram : oEmbed de Meta, seulement si le secret META_OEMBED_TOKEN est
// posé (jeton « id-app|jeton-client » d'une appli Meta validée pour
// « oEmbed Read »). Sans lui, la fonction le dit au lieu de deviner.
//
// Entrée : POST {"url": "..."}   Sortie : JSON (voir `Apercu`).
// Les liens et les images sont limités à une liste d'hôtes connus, pour que
// cette fonction ne puisse pas servir à interroger n'importe quel site.

type Apercu = {
  ok: boolean;
  plateforme?: "tiktok" | "instagram";
  url_finale?: string;
  titre?: string | null;
  auteur?: string | null;
  miniature?: string | null; // data:image/...;base64,...
  raison?: string;
};

const HOTES_LIENS = [/(^|\.)tiktok\.com$/i, /(^|\.)tiktokv\.com$/i, /(^|\.)instagram\.com$/i];
const HOTES_IMAGES = [/(^|\.)tiktokcdn\.com$/i, /(^|\.)tiktokcdn-us\.com$/i, /(^|\.)tiktokcdn-eu\.com$/i, /(^|\.)ibyteimg\.com$/i,
  /(^|\.)cdninstagram\.com$/i, /(^|\.)fbcdn\.net$/i];
const MINIATURE_MAX = 450_000; // octets

const UA = "Mozilla/5.0 (compatible; MesPepites/1.0; +https://github.com/Suzon-salvo-25/Suz)";

function hoteAutorise(u: string, liste: RegExp[]): boolean {
  try {
    const p = new URL(u);
    return p.protocol === "https:" && liste.some((r) => r.test(p.hostname));
  } catch {
    return false;
  }
}

async function avecDelai(u: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(u, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, ...(init.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

function enBase64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function miniature(u: string | undefined | null): Promise<string | null> {
  if (!u || !hoteAutorise(u, HOTES_IMAGES)) return null;
  try {
    const r = await avecDelai(u);
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!type.startsWith("image/")) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > MINIATURE_MAX) return null;
    return `data:${type};base64,${enBase64(buf)}`;
  } catch {
    return null;
  }
}

// Les liens courts (vm.tiktok.com, tiktok.com/t/…) et les liens de l'export
// (tiktokv.com/share/video/…) sont ramenés à la forme que connaît oEmbed.
async function lienTikTok(u: string): Promise<string> {
  const id = u.match(/\/(?:video|photo)\/(\d{8,})/)?.[1];
  if (/tiktokv\.com\/share\/video\/(\d+)/i.test(u) && id) return `https://www.tiktok.com/@/video/${id}`;
  if (/(vm|vt)\.tiktok\.com\/|tiktok\.com\/t\//i.test(u)) {
    try {
      const r = await avecDelai(u, { redirect: "follow", method: "GET" });
      if (hoteAutorise(r.url, HOTES_LIENS)) return r.url.split("?")[0];
    } catch { /* on garde le lien d'origine */ }
  }
  return u.split("?")[0];
}

async function tiktok(u: string): Promise<Apercu> {
  const cible = await lienTikTok(u);
  const r = await avecDelai("https://www.tiktok.com/oembed?url=" + encodeURIComponent(cible));
  if (!r.ok) return { ok: false, plateforme: "tiktok", url_finale: cible, raison: `oembed_${r.status}` };
  const d = await r.json();
  return {
    ok: true,
    plateforme: "tiktok",
    url_finale: cible,
    titre: d.title || null,
    auteur: d.author_unique_id || (typeof d.author_url === "string" ? d.author_url.split("@")[1] : null) || d.author_name || null,
    miniature: await miniature(d.thumbnail_url),
  };
}

async function instagram(u: string): Promise<Apercu> {
  const jeton = Deno.env.get("META_OEMBED_TOKEN");
  if (!jeton) return { ok: false, plateforme: "instagram", raison: "instagram_sans_jeton" };
  const api = "https://graph.facebook.com/v23.0/instagram_oembed?omitscript=true&url=" + encodeURIComponent(u.split("?")[0]) +
    "&access_token=" + encodeURIComponent(jeton);
  const r = await avecDelai(api);
  if (!r.ok) return { ok: false, plateforme: "instagram", raison: `oembed_${r.status}` };
  const d = await r.json();
  // Meta a retiré certains champs d'oEmbed selon les versions : on prend ce qui vient.
  return {
    ok: true,
    plateforme: "instagram",
    url_finale: u.split("?")[0],
    titre: d.title || null,
    auteur: d.author_name || null,
    miniature: await miniature(d.thumbnail_url),
  };
}

// La version autonome de l'appli appelle la fonction depuis le navigateur.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const entetes = { "Content-Type": "application/json", ...CORS };
  let url = "";
  try {
    url = req.method === "POST" ? String((await req.json()).url || "") : (new URL(req.url).searchParams.get("url") || "");
  } catch {
    return new Response(JSON.stringify({ ok: false, raison: "requete_illisible" }), { status: 400, headers: entetes });
  }
  if (!hoteAutorise(url, HOTES_LIENS)) {
    return new Response(JSON.stringify({ ok: false, raison: "lien_refuse" }), { status: 400, headers: entetes });
  }
  let res: Apercu;
  try {
    res = /instagram\.com/i.test(url) ? await instagram(url) : await tiktok(url);
  } catch (e) {
    res = { ok: false, raison: e instanceof DOMException && e.name === "AbortError" ? "delai_depasse" : "erreur_reseau" };
  }
  return new Response(JSON.stringify(res), { headers: entetes });
});
