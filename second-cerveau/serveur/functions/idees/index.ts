// Mes Pépites — idées de recettes pour la rubrique « Conseillées ».
//
// Source : TheMealDB (https://www.themealdb.com), base de recettes ouverte
// avec photo et, souvent, une vidéo YouTube. Clé publique de démonstration
// « 1 », prévue pour un usage personnel ou éducatif.
// La fonction tire des recettes au hasard dans des catégories plutôt légères
// et les renvoie détaillées, avec une petite photo. Claude choisit ensuite,
// côté appli, celles qui sont vraiment healthy et les traduit en français.
//
// Entrée : POST {"n": 8, "exclure": ["52807", ...], "categories": ["Breakfast", ...]}   Sortie : {ok, recettes: [...]}

const API = "https://www.themealdb.com/api/json/v1/1/";
const CATEGORIES = ["Vegetarian", "Vegan", "Seafood", "Chicken", "Breakfast", "Side"];
// Catégories qu'on accepte de l'appli (celles de TheMealDB).
const PERMISES = ["Breakfast", "Dessert", "Vegan", "Vegetarian", "Seafood", "Chicken", "Side", "Starter", "Pasta", "Miscellaneous", "Beef", "Lamb", "Pork", "Goat"];

type Recette = {
  id: string; nom: string; categorie: string | null; origine: string | null;
  ingredients: { nom: string; qte: string }[]; instructions: string;
  video: string | null; source: string | null; image: string | null;
};

async function json(u: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(u, { signal: ctl.signal });
    return r.ok ? await r.json() : null;
  } finally {
    clearTimeout(t);
  }
}

function enBase64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

// La variante « /preview » de TheMealDB fait environ 250 px : assez pour une carte.
async function photo(u: string | null): Promise<string | null> {
  if (!u || !/^https:\/\/www\.themealdb\.com\/images\//.test(u)) return null;
  try {
    const r = await fetch(u + "/preview");
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 200_000) return null;
    return `data:${(r.headers.get("content-type") || "image/jpeg").split(";")[0]};base64,${enBase64(buf)}`;
  } catch {
    return null;
  }
}

function melange<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function detail(id: string): Promise<Recette | null> {
  const d = await json(API + "lookup.php?i=" + encodeURIComponent(id));
  const m = d?.meals?.[0];
  if (!m) return null;
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const nom = (m["strIngredient" + i] || "").trim();
    if (nom) ingredients.push({ nom, qte: (m["strMeasure" + i] || "").trim() });
  }
  return {
    id: String(m.idMeal), nom: m.strMeal, categorie: m.strCategory || null, origine: m.strCountry || m.strArea || null,
    ingredients, instructions: String(m.strInstructions || "").slice(0, 4000),
    video: /^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/.test(m.strYoutube || "") ? m.strYoutube : null,
    source: /^https?:\/\//.test(m.strSource || "") ? m.strSource : null,
    image: await photo(m.strMealThumb || null),
  };
}

Deno.serve(async (req: Request) => {
  const entetes = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: entetes });
  let n = 8, exclure: string[] = [], cats = CATEGORIES;
  try {
    const b = req.method === "POST" ? await req.json() : {};
    n = Math.max(1, Math.min(12, parseInt(b.n, 10) || 8));
    exclure = Array.isArray(b.exclure) ? b.exclure.map(String).slice(0, 500) : [];
    if (Array.isArray(b.categories)) {
      const c = b.categories.map(String).filter((x: string) => PERMISES.indexOf(x) >= 0);
      if (c.length) cats = c;
    }
  } catch { /* valeurs par défaut */ }
  try {
    const listes = await Promise.all(cats.map((c) => json(API + "filter.php?c=" + c)));
    const ids = melange(listes.flatMap((l) => (l?.meals || []).map((m: { idMeal: string }) => String(m.idMeal))))
      .filter((id, i, a) => a.indexOf(id) === i && exclure.indexOf(id) < 0)
      .slice(0, n);
    const recettes = (await Promise.all(ids.map(detail))).filter(Boolean);
    return new Response(JSON.stringify({ ok: true, recettes }), { headers: entetes });
  } catch {
    return new Response(JSON.stringify({ ok: false, raison: "source_injoignable" }), { headers: entetes });
  }
});
