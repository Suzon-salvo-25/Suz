/* Import de la table Ciqual de l'Anses.
 *
 *   node outils/importe-ciqual.mjs <waistline_ciqual.json>
 *
 * Ciqual est la table de composition nutritionnelle officielle française.
 * Elle décrit 3 484 aliments génériques, cuissons comprises, ce qu'aucune
 * recherche web ne rassemblerait produit par produit. C'est la bonne source
 * pour tout ce qui se mange sans marque : un œuf au plat, une choucroute,
 * un chewing-gum, un blanc de poulet grillé.
 *
 * Elle ne contient en revanche aucune marque : les produits d'enseigne
 * relèvent d'Open Food Facts, et donc de outils/importe-openfoodfacts.mjs.
 *
 * La sortie repasse par outils/fusionne-marques.mjs : rien n'entre dans la
 * base sans les contrôles habituels.
 */
import fs from 'node:fs';

const source = process.argv[2];
const sortie = process.argv[3] || 'donnees/aliments/ciqual.json';

if (!source || !fs.existsSync(source)) {
  console.error('Usage : node outils/importe-ciqual.mjs <waistline_ciqual.json> [sortie.json]');
  console.error('\nLa table convertie en JSON se récupère par :');
  console.error('  git clone --depth 1 https://github.com/LaurentPortefaix/waistline-ciqual');
  process.exit(1);
}

/* Le groupe Ciqual porte déjà le classement de l'aliment : il est plus sûr
   que de deviner la catégorie depuis le nom. L'ordre compte, le premier
   motif qui correspond gagne. */
const GROUPES = [
  [/boisson.*alcoolis/i, 'boisson'],
  [/boisson|eau /i, 'boisson'],
  [/fromage|produits laitiers|lait et |cr[èe]me|beurre|œuf|oeuf/i, 'laitier'],
  [/pain|biscotte|viennoiserie/i, 'pain'],
  [/biscuit|g[âa]teau|p[âa]tisserie|confiserie|chocolat|glace|dessert|sucre|c[ée]r[ée]ales de petit/i, 'sucre'],
  [/poisson|produits de la mer|mollusque|crustac/i, 'poisson'],
  [/viande|charcuterie|abat|volaille|gibier/i, 'viande'],
  [/l[ée]gumes|salades composées|crudit/i, 'legume'],
  [/fruits [àa] coque|ol[ée]agineu/i, 'noix'],
  [/fruits/i, 'fruit'],
  [/p[âa]tes|riz|c[ée]r[ée]ales|pommes de terre|tubercule|farine/i, 'feculent'],
  [/l[ée]gumineuse|graines/i, 'legumineuse'],
  [/huile|mati[èe]res grasses|sauce|aide culinaire|condiment/i, 'gras'],
  [/plat|sandwich|pizza|tarte|cr[êe]pe|soupe|feuillet[ée]|quiche/i, 'plat']
];

const categorie = (groupe) => {
  for (const [re, cat] of GROUPES) if (re.test(groupe)) return cat;
  return 'plat';
};

/* Ciqual note les valeurs sous le seuil de quantification « < 0,5 » et les
   valeurs absentes par un tiret. Une valeur sous le seuil est prise pour
   zéro, ce qu'elle vaut à l'échelle d'un repas ; une valeur absente
   disqualifie l'aliment, faute de quoi ses macros seraient sous-comptées. */
const nombre = (v) => {
  if (v === undefined || v === null) return NaN;
  const t = String(v).replace(',', '.').trim();
  if (t === '' || t === '-' || /^traces$/i.test(t)) return NaN;
  if (t.startsWith('<')) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const brut = JSON.parse(fs.readFileSync(source, 'utf8'));
const liste = Array.isArray(brut) ? brut : brut.foodList;
if (!Array.isArray(liste)) { console.error('Format inattendu : pas de foodList.'); process.exit(1); }

/* Les noms déjà tenus à la main dans la base priment : ils portent des
   portions réelles (« 1 pomme ») que Ciqual ne donne pas. */
const page = fs.readFileSync('perte-de-poids.html', 'utf8');
const deja = new Set([...page.matchAll(/^\s*\["([^"]+)"/gm)].map((m) => m[1].toLowerCase()));

const sortieListe = [];
const vus = new Set();
let sansMacro = 0, atwaterKo = 0, doublons = 0;

for (const f of liste) {
  const n = f && f.nutrition;
  if (!n) { sansMacro++; continue; }

  const kcal = nombre(n.calories), prot = nombre(n.proteins);
  const gluc = nombre(n.carbohydrates), lip = nombre(n.fat);
  if (![kcal, prot, gluc, lip].every(Number.isFinite)) { sansMacro++; continue; }
  if (kcal <= 0 || kcal > 900 || prot + gluc + lip > 101) { sansMacro++; continue; }

  const groupe = String(f.brand || '').replace(/^CIQUAL\s*-\s*/i, '').trim();
  const alcool = /alcoolis/i.test(groupe);

  const atwater = 4 * prot + 4 * gluc + 9 * lip;
  if (alcool) {
    const eth = (kcal - atwater) / 7;
    if (eth < -1 || eth > 45) { atwaterKo++; continue; }
  } else if (Math.abs(kcal - atwater) > Math.max(kcal * 0.2, 12)) {
    atwaterKo++; continue;
  }

  const nom = String(f.name || '').trim().replace(/\s+/g, ' ');
  if (nom.length < 2 || nom.length > 70 || /[—–"]/.test(nom)) { sansMacro++; continue; }
  const cle = nom.toLowerCase();
  if (deja.has(cle) || vus.has(cle)) { doublons++; continue; }
  vus.add(cle);

  const fiche = {
    nom: nom,
    kcal: Math.round(kcal),
    prot: Math.round(prot * 10) / 10,
    gluc: Math.round(gluc * 10) / 10,
    lip: Math.round(lip * 10) / 10,
    cat: categorie(groupe),
    portion_g: 100,
    portion_lib: '100 g',
    source: 'Table Ciqual de l\'Anses, groupe ' + (groupe || 'non précisé') +
            ', identifiant ' + (f.uniqueId || '?')
  };
  if (alcool) fiche.alcool = true;
  sortieListe.push(fiche);
}

sortieListe.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
fs.writeFileSync(sortie, JSON.stringify(sortieListe, null, 2) + '\n');

console.log(liste.length + ' aliments dans la table Ciqual');
console.log('  ' + sansMacro + ' écartés, macros absentes ou aberrantes');
console.log('  ' + atwaterKo + ' écartés par le contrôle d\'Atwater');
console.log('  ' + doublons + ' écartés, déjà dans la base ou en double');
console.log(sortieListe.length + ' aliments écrits dans ' + sortie);
