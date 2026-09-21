/* Import en masse depuis un export Open Food Facts.
 *
 *   node outils/importe-openfoodfacts.mjs <export.csv.gz> [options]
 *
 *     --marques "Carrefour,Lidl"   ne garder que ces marques
 *     --max 400                    nombre maximum de produits par marque
 *     --sortie donnees/marques/carrefour.json
 *
 * Pourquoi un import et pas des agents : un catalogue d'enseigne, ce sont
 * des milliers de références. Aucune recherche web ne les saisit une par
 * une. L'export d'Open Food Facts les contient déjà, avec les valeurs de
 * l'étiquette ; le travail utile est de le filtrer, pas de le retaper.
 *
 * Le fichier fait plusieurs gigaoctets : il est lu ligne à ligne, jamais
 * chargé en mémoire.
 *
 * La sortie est un JSON au format de donnees/marques, qui repasse ensuite
 * par outils/fusionne-marques.mjs. Les contrôles ne sont donc pas
 * contournés : ce qui vient d'ici est vérifié comme le reste.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';

const args = process.argv.slice(2);
const fichier = args.find((a) => !a.startsWith('--'));
const opt = (nom, def) => {
  const i = args.indexOf('--' + nom);
  return i === -1 ? def : args[i + 1];
};

if (!fichier || !fs.existsSync(fichier)) {
  console.error('Usage : node outils/importe-openfoodfacts.mjs <export.csv.gz> [--marques "Carrefour,Lidl"] [--max 400] [--sortie fichier.json]');
  console.error('\nL\'export se télécharge sur https://world.openfoodfacts.org/data');
  console.error('(fichier en.openfoodfacts.org.products.csv.gz, tabulations).');
  process.exit(1);
}

const marques = String(opt('marques', '')).split(',').map((m) => m.trim().toLowerCase()).filter(Boolean);
const maxParMarque = Number(opt('max', 400));
const sortie = opt('sortie', 'donnees/marques/openfoodfacts.json');

/* Open Food Facts est alimenté par ses contributeurs : on y trouve des
   virgules décimales, des valeurs en kJ rangées dans la colonne kcal, des
   portions en « 1 sachet ». Tout ce qui n'est pas franchement exploitable
   est écarté, il en reste largement assez. */
const nombre = (v) => {
  if (v === undefined || v === null || v === '') return NaN;
  const n = Number(String(v).replace(',', '.').trim());
  return Number.isFinite(n) ? n : NaN;
};

const CATEGORIES = [
  [/boisson|beverage|soda|jus |juice|eau |water|bière|beer|vin |wine|spiritueux/, 'boisson'],
  [/yaourt|yogurt|fromage|cheese|lait|milk|crème|dairy|beurre|butter/, 'laitier'],
  [/pain|bread|viennoiserie|brioche|baguette|biscotte/, 'pain'],
  [/biscuit|chocolat|chocolate|bonbon|candy|confiserie|snack|chips|gâteau|cake|glace|ice cream|dessert|sucre|sugar/, 'sucre'],
  [/poisson|fish|saumon|salmon|thon|tuna|sardine|maquereau|crevette|surimi|fruits de mer|seafood/, 'poisson'],
  [/viande|meat|poulet|chicken|bœuf|beef|porc|pork|jambon|ham|charcuterie|saucisse|sausage|dinde/, 'viande'],
  [/légume|vegetable|salade|tomate|carotte|haricot vert/, 'legume'],
  [/fruit|pomme|banane|orange|fraise|compote/, 'fruit'],
  [/pâtes|pasta|riz|rice|céréale|cereal|semoule|quinoa|pomme de terre|potato|farine|flour/, 'feculent'],
  [/légumineuse|legume|lentille|lentil|pois chiche|chickpea|haricot rouge/, 'legumineuse'],
  [/noix|nut|amande|almond|graine|seed|cacahuète|peanut|pistache/, 'noix'],
  [/huile|oil|sauce|mayonnaise|ketchup|moutarde|mustard|vinaigrette|margarine/, 'gras'],
  [/plat|meal|pizza|sandwich|soupe|soup|quiche|lasagne|préparé|prepared/, 'plat']
];

const categorie = (txt) => {
  const t = (txt || '').toLowerCase();
  for (const [re, cat] of CATEGORIES) if (re.test(t)) return cat;
  return 'plat';
};

/* Une marque écrite « Carrefour Bio,Carrefour » ne doit pas devenir
   « Carrefour Bio,Carrefour » dans le nom : on garde la première. */
const marquePropre = (brands) => {
  const p = String(brands || '').split(',')[0].trim();
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
};

const flux = fichier.endsWith('.gz')
  ? fs.createReadStream(fichier).pipe(zlib.createGunzip())
  : fs.createReadStream(fichier);

const rl = readline.createInterface({ input: flux, crlfDelay: Infinity });

let entete = null, col = {};
const gardes = new Map();
let lues = 0, retenues = 0;

const COLONNES = ['product_name_fr', 'product_name', 'brands', 'countries_en', 'categories_en',
  'serving_quantity', 'serving_size', 'energy-kcal_100g', 'proteins_100g',
  'carbohydrates_100g', 'fat_100g', 'unique_scans_n'];

rl.on('line', (ligne) => {
  const champs = ligne.split('\t');
  if (!entete) {
    entete = champs;
    COLONNES.forEach((c) => { col[c] = entete.indexOf(c); });
    if (col['energy-kcal_100g'] === -1) {
      console.error('Colonnes inattendues : ce fichier n\'a pas l\'entête d\'un export Open Food Facts.');
      process.exit(1);
    }
    return;
  }
  lues++;
  if (lues % 500000 === 0) process.stderr.write('  ' + lues + ' lignes lues, ' + retenues + ' retenues\n');

  const v = (c) => (col[c] === -1 ? '' : champs[col[c]]);

  const pays = (v('countries_en') || '').toLowerCase();
  if (!pays.includes('france')) return;

  const marque = marquePropre(v('brands'));
  if (!marque) return;
  if (marques.length && !marques.includes(marque.toLowerCase())) return;

  const nomBrut = (v('product_name_fr') || v('product_name') || '').trim();
  if (nomBrut.length < 3 || nomBrut.length > 60) return;
  /* Un nom déjà suffixé par sa marque donnerait « Beurre (Lidl) (Lidl) ». */
  const nom = nomBrut.replace(new RegExp('\\s*' + marque.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i'), '').trim();
  if (!nom) return;
  if (/[—–"\t]/.test(nom)) return;

  const kcal = nombre(v('energy-kcal_100g'));
  const prot = nombre(v('proteins_100g'));
  const gluc = nombre(v('carbohydrates_100g'));
  const lip = nombre(v('fat_100g'));
  if (![kcal, prot, gluc, lip].every(Number.isFinite)) return;
  if (kcal <= 0 || kcal > 900) return;
  if (prot < 0 || gluc < 0 || lip < 0) return;
  if (prot + gluc + lip > 101) return;

  /* Même contrôle d'Atwater que la fusion, appliqué tôt : inutile de
     charger le fichier de sortie de lignes qui seront refusées ensuite. */
  const atwater = 4 * prot + 4 * gluc + 9 * lip;
  if (Math.abs(kcal - atwater) > Math.max(kcal * 0.2, 12)) return;

  let portion = nombre(v('serving_quantity'));
  if (!Number.isFinite(portion) || portion <= 0 || portion > 1200) portion = 100;

  const popularite = nombre(v('unique_scans_n')) || 0;
  const cle = marque.toLowerCase();
  if (!gardes.has(cle)) gardes.set(cle, []);
  gardes.get(cle).push({
    nom: nom + ' (' + marque + ')',
    kcal: Math.round(kcal), prot: Math.round(prot * 10) / 10,
    gluc: Math.round(gluc * 10) / 10, lip: Math.round(lip * 10) / 10,
    cat: categorie(v('categories_en') + ' ' + nomBrut),
    portion_g: Math.round(portion),
    portion_lib: portion === 100 ? '100 g' : '1 portion',
    source: 'Open Food Facts, export ' + new Date().toISOString().slice(0, 10),
    _pop: popularite
  });
  retenues++;
});

rl.on('close', () => {
  const tout = [];
  const vus = new Set();
  for (const [, liste] of gardes) {
    /* Les plus scannés d'abord : un catalogue d'enseigne compte des
       milliers de références, mais on ne mange pas les milliers. */
    liste.sort((a, b) => b._pop - a._pop);
    let pris = 0;
    for (const p of liste) {
      if (pris >= maxParMarque) break;
      const k = p.nom.toLowerCase();
      if (vus.has(k)) continue;
      vus.add(k);
      delete p._pop;
      tout.push(p);
      pris++;
    }
  }
  tout.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  fs.writeFileSync(sortie, JSON.stringify(tout, null, 2) + '\n');
  console.log(lues + ' lignes lues, ' + retenues + ' candidates, ' + tout.length + ' écrites dans ' + sortie);
  console.log('Passe maintenant par : node outils/fusionne-marques.mjs');
});
