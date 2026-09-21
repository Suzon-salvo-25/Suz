/* Harnais de vérification du Carnet de Forme.
 *
 *   node outils/verifie.mjs
 *
 * Il ouvre la page dans Chromium avec un FAUX SERVEUR qui imite le vrai sur
 * les trois points qui ont causé les bugs les plus coûteux :
 *   - ses documents sont GELÉS, comme ceux que renvoie la capacité db ;
 *   - ses écritures sont LENTES, ce qui ouvre la fenêtre de course ;
 *   - il REDIFFUSE son état en boucle, ce qui écrasait les saisies.
 *
 * Un test qui passe sans ce faux serveur ne prouve rien : les trois défauts
 * n'apparaissaient que sur la version publiée.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'file://' + path.join(RACINE, 'perte-de-poids.html');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                   '-' + String(d.getDate()).padStart(2, '0');
const AUJ = ymd(new Date());

let reussis = 0, echecs = 0;
const verifie = (nom, ok, detail) => {
  if (ok) { reussis++; console.log('  ok   ' + nom); }
  else { echecs++; console.log('  ÉCHEC ' + nom + (detail ? ' — ' + detail : '')); }
};

const fauxServeur = (jour) => {
  localStorage.setItem('suz-forme-onglet', 'alim');
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const CLE = 'faux-serveur';
  const base = JSON.parse(sessionStorage.getItem(CLE) || 'null') || {
    'profil/moi': { prenom: 'Suzon', sexe: 'f', age: 29, taille: 168, depart: 77,
                    objectif: 66, debut: jour, activite: 1.375, rythme: 0.5, seances: 3,
                    freq: { 'Blanc de poulet': 12 }, perso: {} },
    ['jours/' + jour]: { date: jour, poids: 77, heure: '07:30', tour: null, eau: 0,
      repas: { petitdej: [], dejeuner: [], diner: [], collation: [] }, sport: [] }
  };
  const sauve = () => sessionStorage.setItem(CLE, JSON.stringify(base));
  sauve();
  const aboP = [], aboJ = [];
  const copie = (p) => gel(JSON.parse(JSON.stringify(base[p])));
  const jours = () => Object.keys(base).filter((p) => p.startsWith('jours/'))
                        .map((p) => ({ id: p.slice(6), data: () => copie(p) }));
  const diffP = () => aboP.forEach((n) => n({ exists: true, data: () => copie('profil/moi') }));
  const diffJ = () => aboJ.forEach((n) => n({ docs: jours() }));
  const db = {
    doc: (p) => ({
      set: (v) => new Promise((r) => setTimeout(() => {
        base[p] = JSON.parse(JSON.stringify(v)); sauve();
        p === 'profil/moi' ? diffP() : diffJ(); r();
      }, 600)),
      delete: () => Promise.resolve(),
      onSnapshot: (n) => {
        if (p === 'profil/moi') { aboP.push(n); setTimeout(diffP, 60); setInterval(diffP, 300); }
        return () => {};
      }
    }),
    collection: () => ({
      onSnapshot: (n) => { aboJ.push(n); setTimeout(diffJ, 70); setInterval(diffJ, 300); return () => {}; }
    })
  };
  const sample = () => {};
  sample.json = () => new Promise((r) => setTimeout(() => r({
    nom: 'Galette de sarrasin (artisanale)', kcal: 172, proteines: 5.1, glucides: 31.4,
    lipides: 3.2, portion_g: 120, portion_nom: '1 galette', confiance: 'moyenne',
    note: 'Valeur simulée par le harnais.'
  }), 200));
  sample.limits = () => Promise.resolve({ maxPromptBytes: 65536 });
  window.claude = { use: (n) => Promise.resolve(n === 'db' ? db : n === 'sample' ? sample : null) };
};

const nav = await chromium.launch({ executablePath: CHROME });

for (const largeur of [1000, 390]) {
  console.log('\n=== ' + largeur + ' px ===');
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 1000 } });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(fauxServeur, AUJ);
  await pg.goto(PAGE);
  await pg.waitForTimeout(1000);

  const banniere = () => pg.evaluate(() => !!document.querySelector('[role=alert]'));
  const total = () => pg.evaluate(() => document.getElementById('kcalMange').textContent);
  const contient = (t) => pg.evaluate((x) => document.getElementById('repasListe').textContent.includes(x), t);

  // ajout depuis la recherche, avec des favoris venus du serveur gelé
  await pg.fill('#foodSearch', 'blanc de poulet');
  await pg.waitForTimeout(350);
  await pg.click('#foodResults button');
  await pg.click('#pickAdd');
  await pg.waitForTimeout(400);
  verifie('ajout depuis la recherche', await contient('Blanc de poulet'));
  verifie('aucune bannière d\'erreur', !(await banniere()));

  // l'ajout survit aux rediffusions du serveur
  await pg.waitForTimeout(1600);
  verifie('ajout conservé après rediffusions', await contient('Blanc de poulet'),
          'total ' + (await total()));

  // saisie libre, avec virgule décimale
  await pg.click('#panel-alim summary');
  await pg.fill('#libreNom', 'yaourt maison');
  await pg.fill('#libreKcal', '62,5');
  await pg.click('#libreAdd');
  await pg.waitForTimeout(400);
  verifie('saisie libre à virgule décimale', await contient('yaourt maison'));

  // pesée à virgule, puis persistance du profil
  await pg.click('#tab-poids');
  await pg.fill('#poidsInput', '76,4');
  await pg.click('#poidsSave');
  await pg.waitForTimeout(400);
  verifie('pesée enregistrée', (await pg.evaluate(() =>
    document.getElementById('toast').textContent)).includes('76,4'));

  await pg.click('#profilBtn');
  await pg.waitForTimeout(300);
  await pg.fill('#pTaille', '170');
  await pg.waitForTimeout(2400);
  verifie('profil non écrasé par le serveur',
    (await pg.evaluate(() => document.getElementById('pTaille').value)) === '170');

  await pg.reload();
  await pg.waitForTimeout(1300);
  verifie('profil conservé au rechargement',
    (await pg.evaluate(() => document.getElementById('pTaille').value)) === '170');

  // séance de sport aux unités Strava
  await pg.click('#tab-sport');
  await pg.fill('#sportDist', '8,42');
  await pg.fill('#sportDuree', '45:12');
  await pg.waitForTimeout(300);
  verifie('allure calculée depuis la distance',
    (await pg.evaluate(() => document.getElementById('sportApercu').innerText)).includes('5:22'));

  // pas de débordement horizontal, sur tous les onglets
  let deborde = false;
  for (const t of ['alim', 'poids', 'sport']) {
    await pg.click('#tab-' + t);
    await pg.waitForTimeout(300);
    if (await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) deborde = true;
  }
  verifie('aucun débordement horizontal', !deborde);
  verifie('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

  await ctx.close();
}

await nav.close();
console.log('\n' + reussis + ' vérifications passées, ' + echecs + ' en échec');
process.exit(echecs ? 1 : 0);
