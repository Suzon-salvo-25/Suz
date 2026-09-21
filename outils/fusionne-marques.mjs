/* Fusion des fiches de marques dans la base ALIMENTS.
 *
 *   node outils/fusionne-marques.mjs            vérifie et affiche le rapport
 *   node outils/fusionne-marques.mjs --injecte  vérifie puis réécrit la base
 *
 * Les recherches sont faites un domaine à la fois et déposées dans
 * donnees/marques/*.json. Ce script les relit toutes, les contrôle, puis
 * régénère le bloc délimité par les deux marqueurs dans perte-de-poids.html.
 *
 * Rien n'entre dans la base sans passer les contrôles : une valeur inventée
 * coûte plus cher qu'un aliment manquant, puisqu'elle fausse le bilan du jour
 * sans que rien ne le signale.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = path.join(RACINE, 'donnees', 'marques');
const PAGE = path.join(RACINE, 'perte-de-poids.html');
const DEBUT = '  // --- Marques — complément de recherche (généré) ---';
const FIN = '  // --- fin du complément de recherche ---';

const CATEGORIES = new Set(['fruit', 'legume', 'feculent', 'pain', 'viande', 'poisson',
  'laitier', 'legumineuse', 'noix', 'gras', 'plat', 'sucre', 'boisson', 'fastfood']);

/* Les marqueurs portent le nom du domaine, pour que le rapport dise
   d'où vient une fiche refusée sans avoir à fouiller les fichiers. */
const TITRES = {
  'bieres-spiritueux': 'bières et spiritueux',
  'confiseries': 'confiseries et chocolats',
  'traiteur-mer': 'traiteur de la mer',
  'fastfood': 'restauration rapide',
  'pain-viennoiserie': 'pain et viennoiserie industrielle',
  'aperitif-sale': 'apéritif salé',
  'sauces': 'sauces et condiments',
  'oeufs': 'œufs'
};

const nf = (n) => (Math.round(n * 10) / 10);
const estNombre = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/* Noms déjà dans la base, marqueur compris : une fiche en double masquerait
   l'autre dans la recherche sans que rien ne le dise. */
function nomsExistants(src) {
  const a = src.indexOf('var ALIMENTS = [');
  const b = src.indexOf('\n];', a);
  const corps = src.slice(a, b);
  const d = corps.indexOf(DEBUT.trim());
  const avant = d === -1 ? corps : corps.slice(0, d);
  return new Set([...avant.matchAll(/^\s*\["([^"]+)"/gm)].map((m) => m[1].toLowerCase()));
}

function controle(fiche, domaine, deja, vus) {
  const p = [];
  const { nom, kcal, prot, gluc, lip, cat, portion_g, portion_lib, source } = fiche;

  if (typeof nom !== 'string' || !nom.trim()) return ['nom manquant'];
  for (const [cle, v] of [['kcal', kcal], ['prot', prot], ['gluc', gluc], ['lip', lip]])
    if (!estNombre(v)) p.push(cle + ' absent ou non numérique');
  if (!estNombre(portion_g) || portion_g <= 0) p.push('portion_g absente ou nulle');
  if (typeof portion_lib !== 'string' || !portion_lib.trim()) p.push('portion_lib manquante');
  if (!CATEGORIES.has(cat)) p.push('catégorie inconnue : ' + cat);
  if (typeof source !== 'string' || source.trim().length < 4) p.push('source absente');
  if (p.length) return p;

  if (/[—–]/.test(nom + portion_lib)) p.push('tiret cadratin dans le nom ou la portion');
  if (kcal > 900) p.push('kcal > 900, impossible pour 100 g');
  if (prot + gluc + lip > 101) p.push('les macros dépassent 100 g pour 100 g de produit');
  if (portion_g > 1200) p.push('portion_g invraisemblable');

  /* Contrôle d'Atwater. L'éthanol apporte 7 kcal/g et n'apparaît pas dans les
     macros : les boissons alcoolisées sont jugées sur l'alcool que l'écart
     implique, pas sur l'écart lui-même. */
  const atwater = 4 * prot + 4 * gluc + 9 * lip;
  const alcool = fiche.alcool === true;
  if (alcool) {
    const gEthanol = (kcal - atwater) / 7;
    if (gEthanol < -1 || gEthanol > 45)
      p.push('alcool implicite hors du possible : ' + nf(gEthanol) + ' g/100 ml');
  } else {
    const ecart = Math.abs(kcal - atwater);
    /* En dessous de 50 kcal, 20 % ne fait que quelques kcal : un écart absolu
       de 12 kcal reste plus juste que la règle proportionnelle. */
    const tolere = Math.max(kcal * 0.2, 12);
    if (ecart > tolere)
      p.push('Atwater : ' + kcal + ' kcal annoncées contre ' + nf(atwater) + ' calculées');
  }

  const cle = nom.toLowerCase();
  if (deja.has(cle)) p.push('déjà présent dans la base');
  if (vus.has(cle)) p.push('doublon avec ' + TITRES[vus.get(cle)]);
  else vus.set(cle, domaine);

  return p;
}

function ligne(f) {
  const n = (v) => String(nf(v));
  return '  ["' + f.nom.replace(/"/g, '\\"') + '", ' + n(f.kcal) + ', ' + n(f.prot) + ', ' +
    n(f.gluc) + ', ' + n(f.lip) + ', "' + f.cat + '", ' + Math.round(f.portion_g) +
    ', "' + f.portion_lib.replace(/"/g, '\\"') + '"],';
}

const src = fs.readFileSync(PAGE, 'utf8');
const deja = nomsExistants(src);
const vus = new Map();
const fichiers = fs.existsSync(DOSSIER)
  ? fs.readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).sort() : [];

if (!fichiers.length) {
  console.error('Aucun fichier dans ' + DOSSIER + ' : rien à fusionner.');
  process.exit(1);
}

const blocs = [];
let retenus = 0, refuses = 0;

for (const fichier of fichiers) {
  const domaine = fichier.replace(/\.json$/, '');
  let fiches;
  try {
    fiches = JSON.parse(fs.readFileSync(path.join(DOSSIER, fichier), 'utf8'));
  } catch (err) {
    console.log('\n' + fichier + ' — illisible : ' + err.message);
    refuses++;
    continue;
  }
  if (!Array.isArray(fiches)) { console.log('\n' + fichier + ' — ce n\'est pas un tableau'); refuses++; continue; }

  const titre = TITRES[domaine] || domaine;
  console.log('\n' + titre + ' (' + fiches.length + ' fiches proposées)');
  const gardees = [];
  for (const f of fiches) {
    const p = controle(f, domaine, deja, vus);
    if (p.length) { refuses++; console.log('  refusé  ' + (f && f.nom ? f.nom : '?') + ' — ' + p.join(' ; ')); }
    else { gardees.push(f); retenus++; }
  }
  if (gardees.length) {
    gardees.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    blocs.push('  // --- ' + titre.charAt(0).toUpperCase() + titre.slice(1) + ' ---\n' +
      gardees.map(ligne).join('\n'));
  }
  console.log('  ' + gardees.length + ' retenues');
}

console.log('\nTotal : ' + retenus + ' fiches retenues, ' + refuses + ' refusées.');

if (!process.argv.includes('--injecte')) {
  console.log('Relance avec --injecte pour réécrire perte-de-poids.html.');
  process.exit(refuses > 0 ? 1 : 0);
}

const bloc = DEBUT + '\n' + blocs.join('\n\n') + '\n' + FIN;
let sortie;
if (src.includes(DEBUT)) {
  const a = src.indexOf(DEBUT);
  const b = src.indexOf(FIN, a) + FIN.length;
  sortie = src.slice(0, a) + bloc + src.slice(b);
} else {
  /* Le complément se pose juste avant les ingrédients des recettes maison,
     qui doivent rester en fin de base : les plats maison les référencent. */
  const ancre = '  // --- Ingrédients de base pour les recettes maison ---';
  const i = src.indexOf(ancre);
  if (i === -1) { console.error('Point d\'insertion introuvable dans la base.'); process.exit(1); }
  sortie = src.slice(0, i) + bloc + '\n\n' + src.slice(i);
}
fs.writeFileSync(PAGE, sortie);
console.log('Base réécrite : ' + retenus + ' aliments dans le complément.');
